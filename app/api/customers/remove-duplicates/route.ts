import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
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
    const userId = request.headers.get('user-id');
    const workspaceId = request.headers.get('workspace-id');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize database connection' }, { status: 500 });
    }
    
    console.log(`Finding customers without emails in workspace ${workspaceId}`);
    
    // First, let's check if we can access the customers table
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('id, email')
      .eq('workspace_id', workspaceId)
      .is('email', null)
      .limit(100);
    
    if (fetchError) {
      console.error('Error fetching customers without emails:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch customers without emails', 
        details: fetchError 
      }, { status: 500 });
    }
    
    if (!customers || customers.length === 0) {
      return NextResponse.json({ 
        message: 'No customers without emails found', 
        customers_removed: 0 
      });
    }
    
    console.log(`Found ${customers.length} customers without emails, preparing to delete`);
    
    // Get the IDs of customers without emails
    const customerIds = customers.map(customer => customer.id);
    
    // Delete the customers without emails
    const { error: deleteError } = await supabase
      .from('customers')
      .delete()
      .in('id', customerIds);
    
    if (deleteError) {
      console.error('Error deleting customers without emails:', deleteError);
      return NextResponse.json({ 
        error: 'Failed to delete customers without emails', 
        details: deleteError 
      }, { status: 500 });
    }
    
    return NextResponse.json({ 
      message: `Successfully removed ${customers.length} customers without emails`, 
      customers_removed: customers.length 
    });
  } catch (error) {
    console.error('Error removing customers without emails:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'An error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 