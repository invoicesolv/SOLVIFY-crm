import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    // Get user's integrations to check token status
    const { data: integrations, error } = await supabaseAdmin
      .from('integrations')
      .select('service_name, access_token, refresh_token, expires_at, updated_at')
      .eq('user_id', user.id);

    if (error) {
      console.error('Error fetching integrations:', error);
      return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
    }

    // Check session details
    const sessionDetails = {
      userId: user.id,
      email: user.email,
      name: user.user_metadata?.name || user.user_metadata?.full_name,
      integrations: integrations.map(integration => ({
        service: integration.service_name,
        hasAccessToken: !!integration.access_token,
        hasRefreshToken: !!integration.refresh_token,
        expiresAt: integration.expires_at,
        lastUpdated: integration.updated_at
      }))
    };

    return NextResponse.json({
      status: 'session_check',
      timestamp: new Date().toISOString(),
      session: sessionDetails,
      message: 'Session information retrieved successfully',
      recommendations: [
        'If access tokens are missing, try reconnecting the integration in Settings',
        'Check if tokens have expired and need refresh',
        'Verify Supabase configuration for token persistence'
      ]
    });

  } catch (error: any) {
    console.error('Auth token check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check auth tokens', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, service } = await request.json();
    
    if (action === 'refresh_integration') {
      if (!service) {
        return NextResponse.json({ error: 'Service name required for refresh' }, { status: 400 });
      }

      // Get the integration to refresh
      const { data: integration, error: fetchError } = await supabaseAdmin
        .from('integrations')
        .select('*')
        .eq('user_id', user.id)
        .eq('service_name', service)
        .single();

      if (fetchError || !integration) {
        return NextResponse.json({ 
          error: 'Integration not found',
          service: service
        }, { status: 404 });
      }

      return NextResponse.json({
        status: 'refresh_info',
        message: `Integration found for ${service}`,
        service: service,
        hasRefreshToken: !!integration.refresh_token,
        expiresAt: integration.expires_at,
        recommendation: 'Use the specific service refresh endpoint or reconnect in Settings'
      });
    }
    
    if (action === 'list_problematic_tokens') {
      // Check for tokens with problematic scope combinations
      const { data: integrations, error } = await supabaseAdmin
        .from('integrations')
        .select('service_name, scopes, expires_at')
        .eq('user_id', user.id);

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 });
      }

      const problematicIntegrations = integrations.filter(integration => {
        const scopes = integration.scopes || [];
        const hasGmailMetadata = scopes.some((scope: string) => scope.includes('gmail.metadata'));
        const hasFullGmail = scopes.some((scope: string) => scope.includes('mail.google.com'));
        return hasGmailMetadata && hasFullGmail;
      });
      
      return NextResponse.json({
        status: 'problematic_tokens_check',
        total: integrations.length,
        problematic: problematicIntegrations.length,
        services: problematicIntegrations.map(i => i.service_name),
        recommendation: problematicIntegrations.length > 0 
          ? 'Reconnect these services to get clean tokens without scope conflicts'
          : 'No problematic token combinations found'
      });
    }
    
    return NextResponse.json({
      error: 'Unknown action',
      availableActions: ['refresh_integration', 'list_problematic_tokens']
    }, { status: 400 });

  } catch (error: any) {
    console.error('Auth token fix action error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform auth fix action', 
      details: error.message 
    }, { status: 500 });
  }
} 