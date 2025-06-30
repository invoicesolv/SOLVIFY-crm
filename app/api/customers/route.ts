import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/global-auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export const GET = withAuth(async (request: NextRequest, { user }) => {
  try {
    console.log(`[Customers API] Fetching customers for user: ${user.email} (${user.id})`);
    
    // NextAuth: No RLS context needed, using manual workspace filtering
    
    // Get query parameters for pagination and filtering
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '50');
    const search = searchParams.get('search') || '';
    const orderBy = searchParams.get('orderBy') || 'name';
    const orderDir = searchParams.get('orderDir') || 'asc';
    
    // Calculate offset based on page number
    const offset = (page - 1) * pageSize;
    
    // Get user's workspace for manual filtering and workspace info
    const { data: userWorkspaces } = await supabaseAdmin
      .from('team_members')
      .select('workspace_id, workspaces(id, name)')
      .eq('user_id', user.id);
    
    if (!userWorkspaces || userWorkspaces.length === 0) {
      console.error('[Customers API] No workspace access for user');
      return NextResponse.json({ error: 'No workspace found for user' }, { status: 404 });
    }
    
    const workspaceIds = userWorkspaces.map(w => w.workspace_id);
    const workspaceInfo = userWorkspaces[0]?.workspaces;
    const workspaceId = workspaceIds[0]; // Use first workspace for backward compatibility
    console.log(`[Customers API] User workspaces:`, workspaceIds, 'Current workspace:', workspaceInfo);
    
    // Build query with manual workspace filtering (service role bypasses RLS)
    let query = supabaseAdmin
      .from('customers')
      .select(`
        *,
        projects (*),
        invoices (*)
      `, { count: 'exact' })
      .eq('workspace_id', workspaceId); // Manual workspace filtering
    
    if (search) {
      query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,customer_number.ilike.%${search}%`);
    }
    
    // Add ordering
    query = query.order(orderBy, { ascending: orderDir === 'asc' });
    
    // Add pagination
    query = query.range(offset, offset + pageSize - 1);
    
    // Execute query
    const { data: customers, error, count } = await query;
    
    if (error) {
      console.error('Error fetching customers:', error);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }
    
    console.log(`[Customers API] Found ${customers?.length || 0} customers (total: ${count})`);
    
    // Calculate total pages
    const totalPages = count ? Math.ceil(count / pageSize) : 0;
    
    return NextResponse.json({
      customers: customers || [],
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
        customerCount: customers?.length || 0,
        workspaceInfo: workspaceInfo,
        workspaceIds: workspaceIds
      }
    });
  } catch (error) {
    console.error('Error in GET /api/customers:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
});
