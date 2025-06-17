import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the base URL (handle missing NEXTAUTH_URL)
  const baseUrl = process.env.NEXTAUTH_URL || 'https://crm.solvify.se';
  const cleanBaseUrl = baseUrl.replace(/\/$/, '');
  
  return NextResponse.json({
    title: 'OAuth Configuration Debug',
    timestamp: new Date().toISOString(),
    
    environment: {
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
      FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ? `${process.env.FACEBOOK_APP_ID.substring(0, 8)}***` : 'NOT SET',
      NODE_ENV: process.env.NODE_ENV,
      base_url_used: cleanBaseUrl
    },
    
    required_facebook_redirect_uris: [
      `${cleanBaseUrl}/api/oauth/facebook/callback`,
      `${cleanBaseUrl}/api/oauth/instagram/callback`,
      `${cleanBaseUrl}/api/oauth/threads/callback`,
      // Development URIs
      'http://localhost:3000/api/oauth/facebook/callback',
      'http://localhost:3000/api/oauth/instagram/callback',
      'http://localhost:3000/api/oauth/threads/callback'
    ],
    
    facebook_configuration_steps: {
      step_1: 'Go to https://developers.facebook.com/apps/',
      step_2: `Select your app (ID: ${process.env.FACEBOOK_APP_ID || 'YOUR_APP_ID'})`,
      step_3: 'Go to Facebook Login > Settings',
      step_4: 'Add the redirect URIs above to "Valid OAuth Redirect URIs"',
      step_5: 'Save changes',
      step_6: 'Test Instagram OAuth again'
    },
    
    current_error_analysis: {
      swedish_error: 'Omdirigeringen misslyckades eftersom URI:n för omdirigering inte är vitlistad',
      english_translation: 'The redirect failed because the redirect URI is not whitelisted',
      likely_cause: 'Instagram OAuth redirect URI not added to Facebook app settings',
      solution: 'Add the Instagram callback URI to Facebook Developer Console'
    },
    
    test_urls: {
      instagram_oauth: `${cleanBaseUrl}/api/oauth/instagram`,
      facebook_oauth: `${cleanBaseUrl}/api/oauth/facebook`,
      debug_instagram: `${cleanBaseUrl}/api/debug/instagram-oauth-debug`
    }
  });
} 