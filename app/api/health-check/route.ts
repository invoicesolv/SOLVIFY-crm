import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient as supabase } from '@/lib/supabase-client';

export const dynamic = 'force-dynamic';

interface DatabaseStatus {
  status: string;
  connection: boolean;
  error?: string;
  workspaceCount?: number;
}

interface ApiKeysStatus {
  status: string;
  count: number;
  workspaceIds: string[];
  error?: string;
}

export async function GET(req: NextRequest) {
  console.log('[Health Check] Endpoint called');
  
  const healthStatus = {
    status: 'running',
    timestamp: new Date().toISOString(),
    components: {
      application: {
        status: 'ok'
      },
      database: {
        status: 'unknown',
        connection: false
      } as DatabaseStatus,
      environment: {
        node_env: process.env.NODE_ENV,
        hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasSupabaseAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        hasSiteUrl: !!process.env.NEXT_PUBLIC_SITE_URL,
      },
      apiKeys: {
        status: 'unknown',
        count: 0,
        workspaceIds: []
      } as ApiKeysStatus
    }
  };
  
  // Test database connection
  try {
    console.log('[Health Check] Testing database connection');
    const { count, error } = await supabase
      .from('workspaces')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('[Health Check] Database connection error:', error);
      healthStatus.components.database = {
        status: 'error',
        connection: false,
        error: error.message
      };
    } else {
      console.log('[Health Check] Database connection successful');
      healthStatus.components.database = {
        status: 'ok',
        connection: true,
        workspaceCount: count
      };
      
      // Check API keys if database connection is successful
      try {
        console.log('[Health Check] Checking API keys in workspace_settings');
        const { data: settings, error: settingsError } = await supabase
          .from('workspace_settings')
          .select('workspace_id, created_at, updated_at')
          .not('openai_api_key', 'is', null)
          .not('openai_api_key', 'eq', '');
        
        if (settingsError) {
          console.error('[Health Check] API key check error:', settingsError);
          healthStatus.components.apiKeys = {
            status: 'error',
            count: 0,
            workspaceIds: [],
            error: settingsError.message
          };
        } else {
          console.log('[Health Check] API key check successful, found:', settings?.length || 0);
          healthStatus.components.apiKeys = {
            status: 'ok',
            count: settings?.length || 0,
            workspaceIds: settings?.map(s => s.workspace_id) || []
          };
        }
      } catch (error: any) {
        console.error('[Health Check] API key check failed:', error);
        healthStatus.components.apiKeys = {
          status: 'error',
          count: 0,
          workspaceIds: [],
          error: error.message
        };
      }
    }
  } catch (error: any) {
    console.error('[Health Check] Database test failed:', error);
    healthStatus.components.database = {
      status: 'error',
      connection: false,
      error: error.message
    };
  }
  
  return NextResponse.json(healthStatus);
} 