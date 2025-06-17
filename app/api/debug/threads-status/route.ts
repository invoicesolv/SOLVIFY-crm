import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Get workspace ID
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    
    // Check for Threads connections
    const { data: threadsAccounts, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'threads');

    if (error) {
      console.error('Error fetching Threads accounts:', error);
      return NextResponse.json({ error: 'Database error' }, { status: 500 });
    }

    // Check environment variables
    const envCheck = {
      FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ? 'SET' : 'MISSING',
      FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ? 'SET' : 'MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET'
    };

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      session: {
        userId: session.user.id,
        email: session.user.email,
        name: session.user.name
      },
      workspace: {
        workspaceId: workspaceId
      },
      threadsAccounts: threadsAccounts || [],
      threadsConnectionCount: threadsAccounts?.length || 0,
      environment: envCheck,
      apiConfiguration: {
        note: 'Threads API uses Facebook OAuth infrastructure',
        oauthEndpoint: 'https://www.facebook.com/v23.0/dialog/oauth',
        tokenEndpoint: 'https://graph.facebook.com/v23.0/oauth/access_token',
        userInfoEndpoint: 'https://graph.facebook.com/me',
        threadsPostEndpoint: 'https://graph.facebook.com/v23.0/{user-id}/threads (fallback to graph.threads.net)',
        threadsPublishEndpoint: 'https://graph.facebook.com/v23.0/{user-id}/threads_publish'
      },
      requiredPermissions: [
        'public_profile',
        'email',
        'pages_show_list',
        'pages_manage_posts',
        'pages_read_engagement',
        'business_management'
      ],
      facebookAppConfiguration: {
        appId: process.env.FACEBOOK_APP_ID ? `${process.env.FACEBOOK_APP_ID.substring(0, 8)}***` : 'NOT SET',
        requiredRedirectUris: [
          `${process.env.NEXTAUTH_URL || 'https://crm.solvify.se'}/api/oauth/threads/callback`,
          'http://localhost:3000/api/oauth/threads/callback'
        ],
        configurationSteps: [
          '1. Go to https://developers.facebook.com/apps/',
          '2. Select your app and go to Facebook Login > Settings',
          '3. Add the redirect URIs above to "Valid OAuth Redirect URIs"',
          '4. Make sure your app has the required permissions enabled',
          '5. Test the connection using /test-threads'
        ]
      },
      nextSteps: threadsAccounts?.length === 0 ? [
        '1. Ensure Facebook App is configured with proper redirect URIs',
        '2. Go to /test-threads to test the connection',
        '3. Click "Connect to Threads" to start OAuth flow',
        '4. Grant the required permissions',
        '5. Check this endpoint again to verify connection'
      ] : [
        '1. Connection found! You can now post to Threads',
        '2. Use the /social-media page to create posts',
        '3. Or test posting via /test-threads page',
        '4. Note: Threads API may still be in limited access'
      ],
      troubleshooting: {
        commonIssues: [
          'App ID not sent: Ensure FACEBOOK_APP_ID is set correctly',
          'Redirect URI mismatch: Add callback URL to Facebook App settings',
          'Permission denied: Make sure app has required permissions',
          'Threads API access: Threads API may require special approval from Meta'
        ],
        debugEndpoints: [
          '/api/debug/threads-status - This endpoint',
          '/test-threads - Test connection and posting',
          '/api/debug/oauth-config - General OAuth configuration'
        ]
      }
    });

  } catch (error) {
    console.error('Threads status check error:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 