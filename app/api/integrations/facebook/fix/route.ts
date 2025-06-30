import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check Facebook environment variables
    const facebookConfig = {
      FACEBOOK_APP_ID: !!process.env.FACEBOOK_APP_ID,
      FACEBOOK_APP_SECRET: !!process.env.FACEBOOK_APP_SECRET
    };

    const missingFacebookVars = Object.entries(facebookConfig)
      .filter(([key, present]) => !present)
      .map(([key]) => key);

    const status = missingFacebookVars.length === 0 ? 'ready' : 'missing_config';

    return NextResponse.json({
      status,
      facebook_config: facebookConfig,
      missing_variables: missingFacebookVars,
      required_actions: missingFacebookVars.length > 0 ? [
        'Add FACEBOOK_APP_ID to your environment variables',
        'Add FACEBOOK_APP_SECRET to your environment variables',
        'Restart your application after adding the variables'
      ] : [
        'Facebook OAuth is properly configured',
        'Users can now authenticate with Facebook/Instagram/Threads'
      ],
      facebook_oauth_url: '/api/oauth/facebook',
      environment_setup_guide: {
        development: 'Add to .env.local file',
        production: 'Add to your hosting platform environment variables',
        vercel: 'Add via Vercel dashboard > Project > Settings > Environment Variables',
        netlify: 'Add via Netlify dashboard > Site > Environment variables'
      }
    });

  } catch (error: any) {
    console.error('Facebook integration fix error:', error);
    return NextResponse.json({ 
      error: 'Failed to check Facebook integration', 
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

    const { action, app_id, app_secret } = await request.json();
    
    if (action === 'test_config') {
      // Test if provided Facebook credentials would work
      if (!app_id || !app_secret) {
        return NextResponse.json({
          error: 'Missing app_id or app_secret for testing'
        }, { status: 400 });
      }

      // Basic validation
      const isValidAppId = /^\d+$/.test(app_id); // Facebook App IDs are numeric
      
      return NextResponse.json({
        status: 'test_complete',
        app_id_format: isValidAppId ? 'valid' : 'invalid',
        app_secret_format: app_secret.length > 20 ? 'valid' : 'too_short',
        message: isValidAppId && app_secret.length > 20 ? 
          'Credentials format looks correct' : 
          'Please check your Facebook App credentials'
      });
    }

    return NextResponse.json({
      error: 'Unknown action'
    }, { status: 400 });

  } catch (error: any) {
    console.error('Facebook integration fix action error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform Facebook fix action', 
      details: error.message 
    }, { status: 500 });
  }
} 