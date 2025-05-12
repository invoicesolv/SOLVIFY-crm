import { NextRequest, NextResponse } from 'next/server';
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

// Function to validate email format
function isValidEmail(email: string): boolean {
  if (!email) return false;
  
  // Very basic email validation (has @ and at least one period after @)
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
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

    console.log(`Processing request to delete customers without emails for workspace ${workspaceId}`);
    const supabase = getSupabaseAdmin();
    
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return NextResponse.json({ error: 'Database connection failed' }, { status: 500 });
    }
    
    // First, find customers without emails - either NULL, empty string, or dash
    console.log('Querying for customers without emails or with placeholder emails...');
    const { data: customers, error: fetchError } = await supabase
      .from('customers')
      .select('id, email')
      .eq('workspace_id', workspaceId);
    
    if (fetchError) {
      console.error('Error fetching customers:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to query customers', 
        details: fetchError.message 
      }, { status: 500 });
    }
    
    // Filter customers with no email, empty email, dash, or not valid email format
    const invalidEmails = customers.filter(c => {
      // Check for null, empty string, dash, or invalid email format
      return !c.email || c.email === '' || c.email === '-' || !isValidEmail(c.email);
    });
    
    console.log(`Found ${customers.length} total customers, ${invalidEmails.length} with invalid or missing emails`);
    
    if (!invalidEmails || invalidEmails.length === 0) {
      console.log('No customers with missing/invalid emails found');
      return NextResponse.json({ 
        message: 'No customers with missing/invalid emails found', 
        count: 0 
      });
    }
    
    // Get list of IDs to delete
    const idsToDelete = invalidEmails.map(c => c.id);
    console.log(`Preparing to delete ${idsToDelete.length} customer records`);
    
    // Delete in smaller batches to avoid query limitations
    let totalDeleted = 0;
    const batchSize = 10;
    
    for (let i = 0; i < idsToDelete.length; i += batchSize) {
      const batchIds = idsToDelete.slice(i, i + batchSize);
      console.log(`Deleting batch ${i/batchSize + 1}, size: ${batchIds.length}`);
      
      const { error: deleteError, count } = await supabase
        .from('customers')
        .delete()
        .in('id', batchIds)
        .select('count');
      
      if (deleteError) {
        console.error(`Error deleting batch ${i/batchSize + 1}:`, deleteError);
        // Continue with other batches
      } else {
        console.log(`Successfully deleted ${count} records in this batch`);
        totalDeleted += count || 0;
      }
    }
    
    console.log(`Operation complete. Total records deleted: ${totalDeleted}`);
    
    return NextResponse.json({ 
      message: `Successfully deleted ${totalDeleted} customers without emails`, 
      customers_removed: totalDeleted 
    });
  } catch (error) {
    console.error('Unhandled error in delete-blank-emails endpoint:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
} 