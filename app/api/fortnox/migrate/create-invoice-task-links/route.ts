import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * Migration to create the invoice_task_links table and set up permissions
 * 
 * This allows storing relationships between invoices and specific tasks
 * for more detailed invoice tracking.
 */
export async function POST(req: NextRequest) {
  console.log('\n=== Running Migration: Create Invoice Task Links Table ===');
  
  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Check if the table already exists (by trying to query it)
    const { error } = await supabaseAdmin
      .from('invoice_task_links')
      .select('id')
      .limit(1);
    
    // If table doesn't exist, we need to create it through proper channels
    if (error && error.code === '42P01') { // Table doesn't exist
      console.log('Invoice task links table does not exist, needs to be created');
      
      return NextResponse.json({
        message: 'Table needs to be created via Supabase dashboard or migrations',
        needsCreation: true,
        tableSchema: {
          name: 'invoice_task_links',
          fields: [
            { name: 'id', type: 'uuid', isPrimary: true, default: 'uuid_generate_v4()' },
            { name: 'invoice_number', type: 'text', isRequired: true },
            { name: 'invoice_id', type: 'uuid' },
            { name: 'task_id', type: 'text', isRequired: true },
            { name: 'project_id', type: 'uuid' },
            { name: 'created_at', type: 'timestamptz', isRequired: true, default: 'now()' },
            { name: 'updated_at', type: 'timestamptz' }
          ],
          uniqueConstraints: [
            { fields: ['invoice_number', 'task_id'] }
          ],
          indexes: [
            { fields: ['invoice_id'] },
            { fields: ['task_id'] },
            { fields: ['project_id'] }
          ]
        },
        rlsInstructions: 'Please enable RLS and set up policies for SELECT, INSERT, UPDATE, and DELETE based on the user\'s access to the project'
      });
    } else if (error) {
      console.error('Error checking invoice_task_links table:', error);
      return NextResponse.json({
        error: 'Error checking table existence',
        details: error.message
      }, { status: 500 });
    }
    
    // Table exists
    return NextResponse.json({
      message: 'Invoice task links table already exists',
      success: true
    });
  } catch (error) {
    console.error('Error in invoice_task_links migration:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 