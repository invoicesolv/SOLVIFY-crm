import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

type MigrationResult = {
  migration: string;
  success: boolean;
  status?: number;
  data?: any;
  error?: string;
};

export async function POST(req: NextRequest) {
  console.log('\n=== Running Fortnox Migrations ===');
  
  // Authentication check
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    // Instead of running migrations with SQL, we'll check tables and suggest actions
    const results: MigrationResult[] = [];
    
    // Check project_invoice_links table
    const { error: projectInvoiceLinksError } = await supabaseAdmin
      .from('project_invoice_links')
      .select('id')
      .limit(1);
      
    results.push({
      migration: 'project_invoice_links',
      success: !projectInvoiceLinksError,
      error: projectInvoiceLinksError ? projectInvoiceLinksError.message : undefined,
      data: {
        tableExists: !projectInvoiceLinksError || projectInvoiceLinksError.code !== '42P01',
        needsCreation: projectInvoiceLinksError && projectInvoiceLinksError.code === '42P01'
      }
    });
    
    // Check invoice_task_links table
    const { error: invoiceTaskLinksError } = await supabaseAdmin
      .from('invoice_task_links')
      .select('id')
      .limit(1);
      
    results.push({
      migration: 'invoice_task_links',
      success: !invoiceTaskLinksError,
      error: invoiceTaskLinksError ? invoiceTaskLinksError.message : undefined,
      data: {
        tableExists: !invoiceTaskLinksError || invoiceTaskLinksError.code !== '42P01',
        needsCreation: invoiceTaskLinksError && invoiceTaskLinksError.code === '42P01'
      }
    });
    
    // Return the results and instructions
    return NextResponse.json({
      message: 'Migration check completed',
      results,
      instructions: `
To complete the migrations, please use the Supabase dashboard to create the following tables if they don't exist:

1. project_invoice_links
   - id: UUID PRIMARY KEY with uuid_generate_v4() default
   - project_id: UUID NOT NULL
   - invoice_id: UUID
   - invoice_number: TEXT
   - fortnox_project_number: TEXT
   - task_id: TEXT
   - task_details: TEXT
   - created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
   - updated_at: TIMESTAMPTZ
   
2. invoice_task_links
   - id: UUID PRIMARY KEY with uuid_generate_v4() default
   - invoice_number: TEXT NOT NULL
   - invoice_id: UUID
   - task_id: TEXT NOT NULL
   - project_id: UUID
   - created_at: TIMESTAMPTZ NOT NULL DEFAULT NOW()
   - updated_at: TIMESTAMPTZ
   - UNIQUE constraint on (invoice_number, task_id)
   
For both tables, enable RLS and set up policies for SELECT, INSERT, UPDATE, and DELETE
based on the user's access to the project.
      `
    });
  } catch (error) {
    console.error('Error in migrations:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
} 