import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log(`[Invoices API] Fetching invoices for user: ${user.email} (${user.id})`);
    
    // NextAuth: Use manual workspace filtering instead of RLS context
    
    // Get query parameters for pagination and filtering
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10000'); // Increased to show more invoices
    const search = searchParams.get('search') || '';
    const orderBy = searchParams.get('orderBy') || 'invoice_date';
    const orderDir = searchParams.get('orderDir') || 'desc';
    const status = searchParams.get('status') || 'all';
    const dateRange = searchParams.get('dateRange') || 'all';
    
    // Calculate offset based on page number
    const offset = (page - 1) * pageSize;
    
    // Get user's workspace for manual filtering
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id, workspaces(id, name)')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.log('[Invoices API] No workspace access for user');
      return NextResponse.json({ 
        error: 'No workspace found',
        invoices: [],
        stats: { totalAmount: 0, totalCount: 0, paidCount: 0, unpaidCount: 0, overdueCount: 0 },
        pagination: { page: 1, pageSize: 10000, totalPages: 0, totalCount: 0, hasMore: false }
      });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    const workspaceInfo = userWorkspaces[0]?.workspaces;
    console.log(`[Invoices API] User workspaces:`, workspaceIds, 'Current workspace:', workspaceInfo);
    
    // Build query with manual workspace filtering (service role bypasses RLS)
    let query = supabaseAdmin
      .from('invoices')
      .select(`
        *,
        customers (
          id,
          name,
          customer_number,
          email
        ),
        currencies (
          code,
          symbol
        ),
        invoice_types (
          name
        )
      `, { count: 'exact' })
      .in('workspace_id', workspaceIds); // Manual workspace filtering
    
    // Apply search filter
    if (search) {
      query = query.or(`document_number.ilike.%${search}%,customer_name.ilike.%${search}%`);
    }
    
    // Apply status filter
    if (status !== 'all') {
      switch (status) {
        case 'paid':
          query = query.eq('balance', 0);
          break;
        case 'unpaid':
          query = query.gt('balance', 0);
          break;
        case 'overdue':
          query = query.gt('balance', 0).lt('due_date', new Date().toISOString());
          break;
      }
    }
    
    // Apply date range filter
    if (dateRange !== 'all') {
      const now = new Date();
      let startDate: Date;
      
      switch (dateRange) {
        case 'thisMonth':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          query = query.gte('invoice_date', startDate.toISOString());
          break;
        case 'lastMonth':
          const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 1);
          query = query.gte('invoice_date', lastMonthStart.toISOString())
                       .lt('invoice_date', lastMonthEnd.toISOString());
          break;
        case 'thisYear':
          startDate = new Date(now.getFullYear(), 0, 1);
          query = query.gte('invoice_date', startDate.toISOString());
          break;
      }
    }
    
    // Add ordering
    query = query.order(orderBy, { ascending: orderDir === 'asc' });
    
    // Add pagination
    query = query.range(offset, offset + pageSize - 1);
    
    // Execute query
    const { data: invoices, error, count } = await query;
    
    if (error) {
      console.error('Error fetching invoices:', error);
      return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 });
    }
    
    console.log(`[Invoices API] Found ${invoices?.length || 0} invoices (total: ${count})`);
    
    // Transform data to match frontend expectations
    const transformedInvoices = (invoices || []).map(invoice => ({
      id: invoice.id,
      DocumentNumber: invoice.document_number,
      InvoiceDate: invoice.invoice_date,
      CustomerName: invoice.customer_name || invoice.customers?.name || 'Unknown',
      Total: parseFloat(invoice.total) || 0,
      Balance: parseFloat(invoice.balance) || 0,
      DueDate: invoice.due_date,
      Currency: invoice.currencies?.code || 'SEK',
      InvoiceType: invoice.invoice_types?.name || 'Standard',
      PaymentWay: 'Bank Transfer',
      ExternalInvoiceReference1: invoice.external_reference || '',
      Status: invoice.status || 'unpaid',
      // Include original data for future use
      _original: invoice
    }));
    
    // Calculate statistics
    const now = new Date();
    const stats = transformedInvoices.reduce((acc, invoice) => {
      const dueDate = new Date(invoice.DueDate);
      
      acc.totalAmount += invoice.Total;
      acc.totalCount++;
      
      if (invoice.Balance === 0) {
        acc.paidCount++;
      } else {
        acc.unpaidCount++;
        if (dueDate < now) {
          acc.overdueCount++;
        }
      }
      
      return acc;
    }, {
      totalAmount: 0,
      totalCount: 0,
      paidCount: 0,
      unpaidCount: 0,
      overdueCount: 0
    });
    
    // Calculate total pages
    const totalPages = count ? Math.ceil(count / pageSize) : 0;
    
    return NextResponse.json({
      invoices: transformedInvoices,
      stats,
      pagination: {
        page,
        pageSize,
        totalPages,
        totalCount: count || 0,
        hasMore: page < totalPages
      },
      debug: {
        userEmail: user.email,
        userId: user.id,
        invoiceCount: transformedInvoices.length,
        workspaceInfo: workspaceInfo,
        workspaceIds: workspaceIds
      }
    });
  } catch (error) {
    console.error('Error in GET /api/invoices:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
