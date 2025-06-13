import { NextRequest, NextResponse } from 'next/server';
import { supabase, supabaseAdmin } from '@/lib/supabase';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const startTime = Date.now();
    const status = {
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      environment: process.env.NODE_ENV,
      checks: {} as Record<string, any>
    };

    // Database connectivity check
    try {
      const { data: dbTest, error: dbError } = await supabaseAdmin
        .from('profiles')
        .select('count')
        .limit(1);
      
      status.checks.database = {
        status: dbError ? 'error' : 'healthy',
        responseTime: Date.now() - startTime,
        details: dbError ? dbError.message : 'Connected successfully',
        recordCount: dbTest?.length || 0
      };
    } catch (error) {
      status.checks.database = {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown database error'
      };
    }

    // Check workspace functionality
    try {
      const workspaceStart = Date.now();
      const { data: workspaces, error: workspaceError } = await supabaseAdmin
        .from('workspaces')
        .select('id, name')
        .limit(5);
      
      status.checks.workspaces = {
        status: workspaceError ? 'error' : 'healthy',
        responseTime: Date.now() - workspaceStart,
        details: workspaceError ? workspaceError.message : `Found ${workspaces?.length || 0} workspaces`,
        count: workspaces?.length || 0
      };
    } catch (error) {
      status.checks.workspaces = {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown workspace error'
      };
    }

    // Check integrations table
    try {
      const integrationStart = Date.now();
      const { data: integrations, error: integrationError } = await supabaseAdmin
        .from('integrations')
        .select('service_name')
        .limit(10);
      
      const serviceCount = integrations?.reduce((acc, integration) => {
        acc[integration.service_name] = (acc[integration.service_name] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      status.checks.integrations = {
        status: integrationError ? 'error' : 'healthy',
        responseTime: Date.now() - integrationStart,
        details: integrationError ? integrationError.message : 'Integrations accessible',
        services: serviceCount,
        totalCount: integrations?.length || 0
      };
    } catch (error) {
      status.checks.integrations = {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown integration error'
      };
    }

    // Check customers table
    try {
      const customerStart = Date.now();
      const { data: customers, error: customerError } = await supabaseAdmin
        .from('customers')
        .select('id')
        .limit(1);
      
      status.checks.customers = {
        status: customerError ? 'error' : 'healthy',
        responseTime: Date.now() - customerStart,
        details: customerError ? customerError.message : 'Customer data accessible'
      };
    } catch (error) {
      status.checks.customers = {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown customer error'
      };
    }

    // Check projects table
    try {
      const projectStart = Date.now();
      const { data: projects, error: projectError } = await supabaseAdmin
        .from('projects')
        .select('id')
        .limit(1);
      
      status.checks.projects = {
        status: projectError ? 'error' : 'healthy',
        responseTime: Date.now() - projectStart,
        details: projectError ? projectError.message : 'Project data accessible'
      };
    } catch (error) {
      status.checks.projects = {
        status: 'error',
        responseTime: Date.now() - startTime,
        details: error instanceof Error ? error.message : 'Unknown project error'
      };
    }

    // Environment variables check
    const envVars = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      NEXTAUTH_SECRET: !!process.env.NEXTAUTH_SECRET,
      GOOGLE_CLIENT_ID: !!process.env.GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET: !!process.env.GOOGLE_CLIENT_SECRET,
      FORTNOX_CLIENT_ID: !!process.env.FORTNOX_CLIENT_ID,
      FORTNOX_CLIENT_SECRET: !!process.env.FORTNOX_CLIENT_SECRET,
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      FACEBOOK_APP_ID: !!process.env.FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET: !!process.env.FACEBOOK_APP_SECRET
    };

    const missingEnvVars = Object.entries(envVars)
      .filter(([key, value]) => !value)
      .map(([key]) => key);

    status.checks.environment = {
      status: missingEnvVars.length > 0 ? 'warning' : 'healthy',
      responseTime: 1,
      details: missingEnvVars.length > 0 
        ? `Missing: ${missingEnvVars.join(', ')}` 
        : 'All required environment variables present',
      missingVars: missingEnvVars,
      totalVars: Object.keys(envVars).length,
      presentVars: Object.values(envVars).filter(Boolean).length
    };

    status.checks.overall = {
      totalResponseTime: Date.now() - startTime,
      healthyChecks: Object.values(status.checks).filter(check => check.status === 'healthy').length,
      warningChecks: Object.values(status.checks).filter(check => check.status === 'warning').length,
      errorChecks: Object.values(status.checks).filter(check => check.status === 'error').length
    };

    return NextResponse.json(status);
  } catch (error) {
    console.error('System status check failed:', error);
    return NextResponse.json(
      { 
        error: 'System status check failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }, 
      { status: 500 }
    );
  }
} 