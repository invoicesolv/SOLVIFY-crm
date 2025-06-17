import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch customers
    const { data: customers, error: customersError } = await supabase
      .from('customers')
      .select('id, name, customer_number, email, organization_number')
      .eq('user_id', session.user.id)
      .order('name');

    if (customersError) {
      console.error('Error fetching customers:', customersError);
      return NextResponse.json({ error: 'Failed to fetch customers' }, { status: 500 });
    }

    // Fetch projects
    const { data: projects, error: projectsError } = await supabase
      .from('projects')
      .select('id, name, customer_name, status, fortnox_project_number, customer_id')
      .eq('user_id', session.user.id)
      .order('name');

    if (projectsError) {
      console.error('Error fetching projects:', projectsError);
      return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
    }

    // Get recent invoices for reference
    const { data: recentInvoices, error: invoicesError } = await supabase
      .from('invoices')
      .select('id, invoice_number, customer_name, total, status, created_at')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (invoicesError) {
      console.error('Error fetching recent invoices:', invoicesError);
    }

    // Get recurring invoices with customer data using foreign key relationship
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
      .eq('user_id', session.user.id)
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