import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  console.log('[API Key Test] Endpoint called');
  
  // Get workspace ID from the URL search parameters
  const searchParams = req.nextUrl.searchParams;
  const workspaceId = searchParams.get('workspace_id');
  const bypassRls = searchParams.get('bypass_rls') === 'true';
  
  // Choose client based on whether to bypass RLS
  const client = bypassRls ? supabaseAdmin : supabase;
  console.log(`[API Key Test] Using ${bypassRls ? 'admin client (bypassing RLS)' : 'regular client (respecting RLS)'}`);

  // If no workspace ID provided, return all workspaces with API keys
  if (!workspaceId) {
    try {
      console.log('[API Key Test] No workspace ID provided, checking all API keys');
      const { data, error } = await client
        .from('workspace_settings')
        .select('workspace_id, created_at, updated_at')
        .not('openai_api_key', 'is', null)
        .not('openai_api_key', 'eq', '');
      
      if (error) {
        console.error('[API Key Test] Database query error:', error);
        return NextResponse.json({ 
          status: 'error', 
          error: error.message,
        }, { status: 500 });
      }
      
      console.log('[API Key Test] Found API keys for workspaces:', data?.map(d => d.workspace_id));
      return NextResponse.json({ 
        status: 'success',
        workspaces: data?.map(d => ({
          workspace_id: d.workspace_id,
          has_api_key: true,
          updated_at: d.updated_at,
        })) || []
      });
    } catch (error: any) {
      console.error('[API Key Test] Unexpected error:', error);
      return NextResponse.json({ 
        status: 'error', 
        error: error.message 
      }, { status: 500 });
    }
  }
  
  // Check specific workspace with detailed diagnostics
  try {
    console.log(`[API Key Test] Checking API key for workspace: ${workspaceId}`);
    
    // Perform a direct query with both clients for comparison
    // 1. Regular client (respects RLS)
    const regularResult = await supabase
      .from('workspace_settings')
      .select('id, openai_api_key, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    
    // 2. Admin client (bypasses RLS)  
    const adminResult = await supabaseAdmin
      .from('workspace_settings')
      .select('id, openai_api_key, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    
    const comparisonResults = {
      regularClient: {
        success: !regularResult.error,
        hasData: !!regularResult.data,
        hasKey: !!regularResult.data?.openai_api_key,
        error: regularResult.error?.message,
        keyLength: regularResult.data?.openai_api_key?.length || 0
      },
      adminClient: {
        success: !adminResult.error,
        hasData: !!adminResult.data,
        hasKey: !!adminResult.data?.openai_api_key, 
        error: adminResult.error?.message,
        keyLength: adminResult.data?.openai_api_key?.length || 0
      },
      discrepancy: {
        differentResults: 
          !!regularResult.data !== !!adminResult.data || 
          !!regularResult.data?.openai_api_key !== !!adminResult.data?.openai_api_key,
        likelyRlsIssue: !regularResult.data && !!adminResult.data
      }
    };
    
    console.log('[API Key Test] Client comparison results:', comparisonResults);
    
    // Use the selected client for the actual response
    const { data, error } = await client
      .from('workspace_settings')
      .select('id, openai_api_key, created_at, updated_at')
      .eq('workspace_id', workspaceId)
      .maybeSingle();
    
    if (error) {
      console.error('[API Key Test] Database query error:', error);
      return NextResponse.json({ 
        status: 'error', 
        error: error.message,
        clientComparison: comparisonResults
      }, { status: 500 });
    }
    
    // Check if API key exists and return appropriate response
    const hasApiKey = !!data?.openai_api_key;
    console.log(`[API Key Test] API key exists for workspace ${workspaceId}: ${hasApiKey}`);
    
    return NextResponse.json({
      status: 'success',
      workspace_id: workspaceId,
      has_api_key: hasApiKey,
      api_key_format: hasApiKey ? {
        starts_with_sk: data.openai_api_key.startsWith('sk-'),
        starts_with_sk_proj: data.openai_api_key.startsWith('sk-proj-'),
        starts_with_sk_org: data.openai_api_key.startsWith('sk-org-'),
        length: data.openai_api_key.length
      } : null,
      last_updated: data?.updated_at,
      clientComparison: comparisonResults
    });
  } catch (error: any) {
    console.error('[API Key Test] Unexpected error:', error);
    return NextResponse.json({ 
      status: 'error', 
      error: error.message 
    }, { status: 500 });
  }
} 