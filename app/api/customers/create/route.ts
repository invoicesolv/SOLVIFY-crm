import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { getUserFromToken } from '@/lib/auth-utils';
import { getOrCreateWorkspaceForAPI } from '@/lib/workspace';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('API: Processing customer creation for user:', {
      id: user.id,
      email: user.email
    });

    // Parse request body
    const customerData = await request.json();
    console.log('API: Customer data received:', customerData);

    // Validate required fields
    if (!customerData.name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    // Use the workspace utility to get or create a workspace
    const workspaceId = await getOrCreateWorkspaceForAPI(
      user.id,
      user.email || '',
      user.user_metadata.name || ''
    );

    if (!workspaceId) {
      console.error('API: Failed to get or create workspace');
      return NextResponse.json({ 
        error: 'No workspace found',
        details: 'Could not find or create a workspace for your account. Please contact support.'
      }, { status: 404 });
    }

    console.log('API: Using workspace ID:', workspaceId);

    // Prepare customer data with workspace and user IDs
    const customer = {
      name: customerData.name,
      customer_number: customerData.customer_number || null,
      email: customerData.email || null,
      phone: customerData.phone || null,
      contact_person: customerData.contact_person || null,
      position: customerData.position || null,
      address: customerData.address || null,
      address2: customerData.address2 || null,
      city: customerData.city || null,
      zip_code: customerData.zip_code || null,
      organization_number: customerData.organization_number || null,
      country: customerData.country || null,
      birthday: customerData.birthday || null,
      workspace_id: workspaceId,
      user_id: user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    console.log('API: Creating customer with data:', {
      name: customer.name,
      workspace_id: workspaceId
    });

    // Insert the customer into the database
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('API: Failed to initialize Supabase admin client');
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    
    const { data, error } = await supabaseAdmin
      .from('customers')
      .insert([customer])
      .select()
      .single();

    if (error) {
      console.error('API: Error creating customer:', error);
      return NextResponse.json({ error: 'Failed to create customer', details: error.message }, { status: 500 });
    }

    console.log('API: Customer created successfully:', data);
    return NextResponse.json({ success: true, customer: data });
  } catch (error) {
    console.error('API: Unexpected error creating customer:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 