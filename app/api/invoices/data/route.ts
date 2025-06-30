import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';

export async function GET(request: NextRequest) {
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

    // Fetch customers - RLS will automatically filter by user's workspace access
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, customer_number, email, organization_number')
      .order('name');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Fetch projects - RLS will automatically filter by user's workspace access
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, customer_name, status, fortnox_project_number, customer_id')
      .order('name');

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Get recent invoices for reference - RLS will automatically filter by user's workspace access
    const { data: recentInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, total, status, created_at')
      .order('created_at', { ascending: false });
      // Removed .limit(10) to show all invoices

    if (invoicesError) {
      console.error('Error fetching recent invoices:', invoicesError);
    }

    // Get recurring invoices with customer data using foreign key relationship - RLS will automatically filter
    const { data: recurringInvoices, error: recurringError } = await supabase
      .from('recurring_invoices')
      .select(`
        id,
        next_invoice_date,
        total,
        status,
        customer_id,
        customers!fk_recurring_invoices_customer_id(name)
      `)
      .eq('status', 'active')
      .order('next_invoice_date');

    if (recurringError) {
      console.error('Error fetching recurring invoices:', recurringError);
    }

    return NextResponse.json({
      success: true,
      data: {
        customers: customers || [],
        projects: projects || [],
        recent_invoices: recentInvoices || [],
        recurring_invoices: recurringInvoices || [],
        stats: {
          total_customers: customers?.length || 0,
          total_projects: projects?.length || 0,
          active_recurring: recurringInvoices?.length || 0
        }
      }
    });

  } catch (error) {
    console.error('Error fetching invoice data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 