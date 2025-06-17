import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://crm.solvify.se';
  const appId = process.env.FACEBOOK_APP_ID;

  return NextResponse.json({
    title: 'Facebook App Configuration Debug',
    timestamp: new Date().toISOString(),
    
    currentError: {
      swedish: 'Fel vid inloggning - Det gick inte att logga in till applikationen',
      english: 'Login error - Could not log in to the application',
      likelyCauses: [
        'Redirect URI not whitelisted in Facebook App',
        'App not in development mode or missing permissions',
        'Configuration ID not properly set up',
        'App domain restrictions'
      ]
    },

    facebookAppInfo: {
      appId: appId ? `${appId.substring(0, 8)}***` : 'NOT SET',
      appUrl: appId ? `https://developers.facebook.com/apps/${appId}` : 'N/A',
      currentConfigId: '2197969850643897'
    },

    requiredRedirectUris: {
      production: 'https://crm.solvify.se/api/oauth/threads/callback',
      development: 'http://localhost:3000/api/oauth/threads/callback',
      note: 'Both URIs should be added to Facebook Login settings'
    },

    fixSteps: {
      step1: {
        title: 'Add Redirect URIs to Facebook App',
        instructions: [
          `1. Go to https://developers.facebook.com/apps/${appId || 'YOUR_APP_ID'}`,
          '2. Click on "Facebook Login" in the left sidebar',
          '3. Click on "Settings" under Facebook Login',
          '4. In "Valid OAuth Redirect URIs", add:',
          '   - https://crm.solvify.se/api/oauth/threads/callback',
          '   - http://localhost:3000/api/oauth/threads/callback',
          '5. Click "Save Changes"'
        ]
      },
      step2: {
        title: 'Verify App Settings',
        instructions: [
          '1. Go to App Settings > Basic',
          '2. Make sure App Domains includes: crm.solvify.se',
          '3. Make sure the app is not in "Development Mode" or add your Facebook account as a test user',
          '4. Verify the app is "Live" for public use'
        ]
      },
      step3: {
        title: 'Check Configuration ID',
        instructions: [
          '1. Go to Facebook Login > Settings',
          '2. Look for "Login Configurations"',
          '3. Verify configuration ID 2197969850643897 exists and is active',
          '4. If not, create a new configuration with required permissions'
        ]
      }
    },

    testUrls: {
      threadsOAuth: `${baseUrl}/api/oauth/threads?state=test`,
      debugStatus: `${baseUrl}/api/debug/threads-status`,
      testPage: `${baseUrl}/test-threads`
    },

    permissions: {
      required: [
        'public_profile',
        'email', 
        'pages_show_list',
        'pages_manage_posts',
        'pages_read_engagement',
        'business_management'
      ],
      note: 'These should be included in configuration ID 2197969850643897'
    },

    troubleshooting: {
      ifStillFailing: [
        '1. Try using a different configuration ID',
        '2. Create a new Facebook Login configuration',
        '3. Check if your Facebook account has admin access to the app',
        '4. Verify the app is approved for the required permissions',
        '5. Try testing with a different Facebook account'
      ],
      commonSolutions: [
        'Clear browser cache and cookies',
        'Try in incognito/private browsing mode',
        'Check if Facebook is blocking the app due to policy violations',
        'Ensure the app has been reviewed and approved by Meta if using advanced permissions'
      ]
    }
  });
} 