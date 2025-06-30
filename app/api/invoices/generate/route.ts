import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';

export async function POST(request: NextRequest) {
  try {
    // Get JWT token from Authorization header
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
    }

    // Create Supabase client with JWT token
    const supabase = supabaseClient;

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    const body = await request.json();
    const { 
      customer_id, 
      project_id, 
      invoice_type = 'standard',
      is_recurring = false,
      recurring_frequency = 'monthly'
    } = body;

    // Get customer data - RLS will automatically filter by user's workspace access
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', customer_id)
      .single();

    if (customerError || !customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
    }

    // Get project data if project_id is provided - RLS will automatically filter
    let project = null;
    if (project_id) {
      const { data: projectData, error: projectError } = await supabase
        .from('projects')
        .select('*')
        .eq('id', project_id)
        .single();

      if (!projectError && projectData) {
        project = projectData;
      }
    }

    // Generate invoice number - RLS will automatically filter
    const { data: lastInvoice } = await supabase
      .from('invoices')
      .select('invoice_number')
      .order('created_at', { ascending: false })
      .limit(1);

    let nextInvoiceNumber = '1001';
    if (lastInvoice && lastInvoice.length > 0) {
      const lastNumber = parseInt(lastInvoice[0].invoice_number || '1000');
      nextInvoiceNumber = (lastNumber + 1).toString();
    }

    // Calculate invoice dates
    const invoiceDate = new Date();
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30); // 30 days payment terms

    // Calculate total (this would be based on project hours, fixed price, etc.)
    let total = 0;
    let description = 'Services rendered';
    
    if (project) {
      // For project-based invoices, you could calculate based on:
      // - Project fixed price
      // - Hours worked * hourly rate
      // - Milestone completion
      total = 5000; // Placeholder - implement your pricing logic
      description = `Project: ${(project as any).name}`;
    } else {
      // Standard invoice
      total = 1000; // Placeholder - implement your pricing logic
    }

    // Get user's workspace ID for the invoice
    const { data: membership } = await supabase
      .from('team_members')
      .select('workspace_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    const workspaceId = membership?.workspace_id;

    // Create the invoice - RLS will automatically enforce workspace access
    const { data: newInvoice, error: invoiceError } = await supabase
      .from('invoices')
      .insert({
        invoice_number: nextInvoiceNumber,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_number: customer.customer_number,
        project_id: (project as any)?.id || null,
        invoice_date: invoiceDate.toISOString().split('T')[0],
        due_date: dueDate.toISOString().split('T')[0],
        total: total,
        balance: total,
        status: 'draft',
        source: 'automation',
        external_reference: (project as any)?.fortnox_project_number || null,
        user_id: user.id,
        workspace_id: workspaceId
      })
      .select()
      .single();

    if (invoiceError) {
      console.error('Error creating invoice:', invoiceError);
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }

    // If this is a recurring invoice, create the recurring record
    if (is_recurring) {
      const nextDate = new Date();
      if (recurring_frequency === 'monthly') {
        nextDate.setMonth(nextDate.getMonth() + 1);
      } else if (recurring_frequency === 'quarterly') {
        nextDate.setMonth(nextDate.getMonth() + 3);
      } else if (recurring_frequency === 'yearly') {
        nextDate.setFullYear(nextDate.getFullYear() + 1);
      }

      await supabase
        .from('recurring_invoices')
        .insert({
          original_invoice_id: newInvoice.id,
          customer_id: customer.id,
          next_invoice_date: nextDate.toISOString().split('T')[0],
          total: total,
          status: 'active',
          user_id: user.id
        });
    }

    return NextResponse.json({
      success: true,
      invoice: newInvoice,
      message: `Invoice ${nextInvoiceNumber} generated successfully${is_recurring ? ' with recurring schedule' : ''}`
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 