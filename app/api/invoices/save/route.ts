import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { createClient } from '@supabase/supabase-js';

// Define customer interface to avoid type errors
interface Customer {
  id: string;
  name?: string | null;
  customer_number?: string | null;
  email?: string | null;
  workspace_id?: string | null;
}

export async function POST(request: NextRequest) {
  try {
    // Get JWT token from Authorization header
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) {
      return NextResponse.json({ error: 'Authorization token required' }, { status: 401 });
    }

    // Create Supabase client with JWT token
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );

    // Verify user authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }

    // Get the JSON body
    const requestData = await request.json();
    console.log('Received request to save invoices:', {
      dataType: typeof requestData,
      hasInvoices: requestData.invoices ? `Yes, count: ${requestData.invoices.length}` : 'No',
      workspaceId: requestData.workspaceId || 'Not provided',
      userId: user.id
    });

    // Check if data is in the expected format with invoices array
    if (!requestData.invoices || !Array.isArray(requestData.invoices)) {
      return NextResponse.json({ error: 'Expected a data object with an invoices array' }, { status: 400 });
    }

    const invoices = requestData.invoices;
    const workspaceId = requestData.workspaceId;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    // Verify user has access to this workspace
    const { data: membership, error: membershipError } = await supabase
      .from('team_members')
      .select('workspace_id, role')
      .eq('user_id', user.id)
      .eq('workspace_id', workspaceId)
      .single();

    if (membershipError || !membership) {
      return NextResponse.json({ error: 'Access denied to this workspace' }, { status: 403 });
    }

    // Log sample of the first invoice for debugging
    if (invoices.length > 0) {
      console.log('Sample invoice data:', JSON.stringify(invoices[0]).substring(0, 500));
    }

    // First, fetch all customers for this workspace to ensure proper linking
    console.log('Fetching customers for workspace:', workspaceId);
    
    // We need to fetch both customers with the specified workspace_id AND customers with NULL workspace_id
    const { data: workspaceCustomers, error: workspaceCustomerError } = await supabase
      .from('customers')
      .select('id, name, customer_number, email')
      .eq('workspace_id', workspaceId);
    
    if (workspaceCustomerError) {
      console.error('Error fetching workspace customers:', workspaceCustomerError);
      return NextResponse.json({ error: `Failed to fetch workspace customers: ${workspaceCustomerError.message}` }, { status: 500 });
    }
    
    // Also fetch customers with NULL workspace_id as they might be usable too
    const { data: nullWorkspaceCustomers, error: nullWorkspaceCustomerError } = await supabase
      .from('customers')
      .select('id, name, customer_number, email')
      .is('workspace_id', null);
    
    if (nullWorkspaceCustomerError) {
      console.error('Error fetching customers with null workspace:', nullWorkspaceCustomerError);
      // Continue anyway, just with workspace customers
    }
    
    // Combine the customers, prioritizing those with matching workspace_id
    const allCustomers: Customer[] = [
      ...(workspaceCustomers as Customer[] || []),
      ...((nullWorkspaceCustomers as Customer[] || []).filter(nullCust => 
        // Only include if there's no workspace customer with the same customer_number
        !workspaceCustomers?.some(wsCust => 
          wsCust.customer_number && wsCust.customer_number === nullCust.customer_number
        )
      ))
    ];
    
    console.log(`Found ${workspaceCustomers?.length || 0} customers in workspace ${workspaceId}`);
    console.log(`Found ${nullWorkspaceCustomers?.length || 0} customers with NULL workspace_id`);
    console.log(`Combined total: ${allCustomers.length} usable customers`);
    
    // Create maps for customer lookup by name, number and email
    const customerMapByName = new Map<string, Customer>();
    const customerMapByNumber = new Map<string, Customer>();
    const customerMapByEmail = new Map<string, Customer>();
    
    allCustomers.forEach(customer => {
      if (customer.name) {
        customerMapByName.set(customer.name.toLowerCase(), customer);
      }
      if (customer.customer_number) {
        customerMapByNumber.set(customer.customer_number, customer);
      }
      if (customer.email && customer.email !== '-') {
        customerMapByEmail.set(customer.email.toLowerCase(), customer);
      }
    });

    // Validate and prepare each invoice
    const validatedInvoices = invoices.map(invoice => {
      // Find the customer ID using multiple methods, prioritizing exact matches
      let customerId: string | null = null;
      let customerRecord: Customer | null = null;
      
      // If invoice has customer_number, try to find by that first (most reliable)
      if (invoice.customer_number) {
        customerRecord = customerMapByNumber.get(invoice.customer_number) || null;
        if (customerRecord) {
          console.log(`Matched invoice to customer by customer_number: ${invoice.customer_number}`);
        }
      }
      
      // If not found by number but we have a customer name, try by name
      if (!customerRecord && invoice.customer_name) {
        const normalizedName = invoice.customer_name.toLowerCase();
        customerRecord = customerMapByName.get(normalizedName) || null;
        if (customerRecord) {
          console.log(`Matched invoice to customer by name: ${invoice.customer_name}`);
        }
      }
      
      // If we have email information, try matching by email
      if (!customerRecord && invoice.email) {
        const normalizedEmail = invoice.email.toLowerCase();
        customerRecord = customerMapByEmail.get(normalizedEmail) || null;
        if (customerRecord) {
          console.log(`Matched invoice to customer by email: ${invoice.email}`);
        }
      }
      
      // If we have a customer_id directly in the invoice, verify it exists
      if (!customerRecord && invoice.customer_id) {
        // Find the customer in our lists
        customerRecord = allCustomers.find(c => c.id === invoice.customer_id) || null;
        if (customerRecord) {
          console.log(`Using provided customer_id: ${invoice.customer_id}`);
        } else {
          console.warn(`Invoice has customer_id ${invoice.customer_id} but it doesn't exist in our customer list`);
        }
      }
      
      // If we found a customer, use their ID
      if (customerRecord) {
        customerId = customerRecord.id;
        
        // If this customer has a null workspace_id, update it with the current workspace
        if (customerRecord.workspace_id === null) {
          console.log(`Updating customer ${customerRecord.id} to set workspace_id to ${workspaceId}`);
          // Update the customer in a separate operation to set the workspace_id
          supabase
            .from('customers')
            .update({ workspace_id: workspaceId })
            .eq('id', customerRecord.id)
            .then(({ error }) => {
              if (error) {
                console.error(`Failed to update customer ${customerRecord.id} workspace:`, error);
              }
            });
        }
      } else {
        console.warn(`Could not find customer for invoice. Document number: ${invoice.document_number}, Customer: ${invoice.customer_name || 'unknown'}, Customer number: ${invoice.customer_number || 'unknown'}`);
      }

      // Use current timestamp if created_at or updated_at is missing
      const now = new Date().toISOString();
      return {
        ...invoice,
        customer_id: customerId,
        workspace_id: workspaceId, // Ensure workspace_id is set
        user_id: user.id, // Set the authenticated user ID
        created_at: invoice.created_at || now,
        updated_at: now,
        status: invoice.status || (invoice.balance > 0 ? 'unpaid' : 'paid') 
      };
    });

    console.log(`Prepared ${validatedInvoices.length} invoices for saving`);
    console.log(`Customer match statistics: ${validatedInvoices.filter(inv => inv.customer_id).length} invoices with matched customers, ${validatedInvoices.filter(inv => !inv.customer_id).length} without matches`);

    // Save to database - RLS will automatically filter based on user's workspace access
    const { data: savedData, error } = await supabase
      .from('invoices')
      .upsert(validatedInvoices, {
        onConflict: 'document_number,workspace_id'
      });

    if (error) {
      console.error('Error saving invoices:', error);
      return NextResponse.json({ error: `Failed to save invoices: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: `Successfully saved ${validatedInvoices.length} invoices, ${validatedInvoices.filter(inv => inv.customer_id).length} with customer links`
    });
  } catch (error) {
    console.error('Error in invoice save endpoint:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'An unknown error occurred' 
    }, { status: 500 });
  }
} 