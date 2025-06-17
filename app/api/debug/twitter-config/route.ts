import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const baseUrl = process.env.NEXTAUTH_URL || 'https://crm.solvify.se';
  
  // Check environment variables
  const envCheck = {
    TWITTER_CLIENT_ID: process.env.TWITTER_CLIENT_ID ? 'SET' : 'MISSING',
    TWITTER_CLIENT_SECRET: process.env.TWITTER_CLIENT_SECRET ? 'SET' : 'MISSING',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING'
  };

  const allEnvSet = Object.values(envCheck).every(status => status === 'SET');

  return NextResponse.json({
    title: 'X (Twitter) OAuth Configuration',
    timestamp: new Date().toISOString(),
    
    status: {
      ready: allEnvSet,
      message: allEnvSet ? '✅ X OAuth is ready to use!' : '❌ Missing environment variables'
    },

    environment: envCheck,

    requiredSetup: {
      step1: {
        title: 'Create X Developer App',
        instructions: [
          '1. Go to https://developer.twitter.com/en/portal/dashboard',
          '2. Create a new app or use existing app',
          '3. Go to App Settings > User authentication settings',
          '4. Enable OAuth 2.0',
          '5. Set App permissions to "Read and write"',
          '6. Set Type of App to "Web App"'
        ]
      },
      step2: {
        title: 'Configure Redirect URIs',
        instructions: [
          '1. In X Developer Portal > App Settings > User authentication settings',
          '2. Add these Callback URIs:',
          `   - ${baseUrl}/api/oauth/twitter/callback`,
          '   - http://localhost:3000/api/oauth/twitter/callback',
          '3. Add Website URL: https://crm.solvify.se',
          '4. Save settings'
        ]
      },
      step3: {
        title: 'Get API Keys',
        instructions: [
          '1. Go to Keys and tokens tab',
          '2. Copy OAuth 2.0 Client ID',
          '3. Generate OAuth 2.0 Client Secret',
          '4. Add to your .env file:'
        ],
        envVars: [
          'TWITTER_CLIENT_ID=your_oauth2_client_id',
          'TWITTER_CLIENT_SECRET=your_oauth2_client_secret'
        ]
      }
    },

    currentConfig: {
      clientId: process.env.TWITTER_CLIENT_ID ? `${process.env.TWITTER_CLIENT_ID.substring(0, 8)}***` : 'NOT SET',
      redirectUris: [
        `${baseUrl}/api/oauth/twitter/callback`,
        'http://localhost:3000/api/oauth/twitter/callback'
      ],
      scopes: [
        'tweet.read',
        'tweet.write', 
        'users.read',
        'offline.access'
      ],
      authFlow: 'OAuth 2.0 with PKCE'
    },

    testUrls: {
      startOAuth: `${baseUrl}/api/oauth/twitter?state=test`,
      debugStatus: `${baseUrl}/api/debug/twitter-config`,
      settingsPage: `${baseUrl}/settings`
    },

    troubleshooting: {
      commonIssues: [
        'Client ID/Secret not set in environment variables',
        'Redirect URI not added to X Developer Portal',
        'App permissions not set to "Read and write"',
        'OAuth 2.0 not enabled in X app settings',
        'NEXTAUTH_SECRET missing (required for session handling)'
      ],
      solutions: [
        'Double-check environment variables are loaded',
        'Restart your development server after adding env vars',
        'Verify redirect URIs match exactly (including http/https)',
        'Make sure X app is not in restricted mode',
        'Check X Developer Portal for any app restrictions'
      ]
    },

    nextSteps: allEnvSet ? [
      '1. X OAuth is configured and ready!',
      '2. Go to /settings and click "Connect" next to X (Twitter)',
      '3. Or test directly: /api/oauth/twitter?state=test',
      '4. Grant permissions when prompted',
      '5. You should be redirected back with success message'
    ] : [
      '1. Set up X Developer App (see steps above)',
      '2. Add environment variables to .env file',
      '3. Restart your development server',
      '4. Check this endpoint again to verify setup',
      '5. Test the OAuth flow'
    ]
  });
} 