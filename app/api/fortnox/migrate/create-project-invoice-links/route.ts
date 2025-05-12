import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Migration to create the project_invoice_links table
 * 
 * This table helps link Fortnox invoices to projects in our internal system
 */
export async function POST(req: NextRequest) {
  console.log('\n=== Running Migration: Create Project Invoice Links ===');
  
  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Use supabaseAdmin methods instead of direct SQL
    // Create the project_invoice_links table using the API call
    const { error } = await supabaseAdmin.from('project_invoice_links').select('id').limit(1);
    
    // If the table doesn't exist, we'll get an error
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log('Project invoice links table does not exist, creating it via proper channels');
      
      // Instead of creating it directly here, notify the user
      return NextResponse.json({ 
        message: 'Table needs to be created via Supabase dashboard or migrations',
        needsCreation: true,
        instructions: 'Please use Supabase dashboard or migration system to create the table with the schema: project_id UUID, invoice_id UUID, invoice_number TEXT, etc.'
      });
    } else if (error) {
      console.error('Error checking project_invoice_links table:', error);
      return NextResponse.json({ 
        error: 'Error checking table existence', 
        details: error.message
      }, { status: 500 });
    }
    
    // Table exists
    return NextResponse.json({ 
      message: 'Project invoice links table already exists',
      success: true
    });
  } catch (error) {
    console.error('Error in create_project_invoice_links migration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 