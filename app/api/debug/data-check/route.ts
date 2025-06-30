import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 Checking available data in Supabase...');
    
    const results: any = {
      timestamp: new Date().toISOString(),
      tables: {},
      totalRecords: 0
    };

    // List of tables to check
    const tablesToCheck = [
      'customers',
      'projects', 
      'invoices',
      'profiles',
      'workspaces',
      'team_members',
      'settings',
      'user_fortnox_tokens',
      'google_integrations'
    ];

    for (const table of tablesToCheck) {
      try {
        const { data, error, count } = await supabaseAdmin
          .from(table)
          .select('*', { count: 'exact' })
          .limit(5); // Just get first 5 records for preview

        if (error) {
          results.tables[table] = {
            error: error.message,
            exists: false
          };
        } else {
          results.tables[table] = {
            exists: true,
            count: count || 0,
            sampleData: data?.slice(0, 2) || [], // Just first 2 records
            columns: data && data.length > 0 ? Object.keys(data[0]) : []
          };
          results.totalRecords += count || 0;
        }
      } catch (tableError) {
        results.tables[table] = {
          error: tableError instanceof Error ? tableError.message : 'Unknown error',
          exists: false
        };
      }
    }

    // Check for user mapping
    console.log('🔍 Checking user mappings...');
    try {
      const { data: profiles, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .select('id, email, name')
        .limit(10);

      if (!profilesError && profiles) {
        results.userMappings = profiles;
      }
    } catch (error) {
      console.error('Error checking profiles:', error);
    }

    // Check workspace structure
    try {
      const { data: workspaces, error: workspacesError } = await supabaseAdmin
        .from('workspaces')
        .select('id, name, owner_id')
        .limit(5);

      if (!workspacesError && workspaces) {
        results.workspaces = workspaces;
      }
    } catch (error) {
      console.error('Error checking workspaces:', error);
    }

    console.log('✅ Data check completed');
    
    return NextResponse.json(results);
    
  } catch (error) {
    console.error('❌ Data check failed:', error);
    return NextResponse.json({
      error: 'Data check failed',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
