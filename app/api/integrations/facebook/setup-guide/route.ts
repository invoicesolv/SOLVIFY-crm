import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const setupGuide = {
    title: 'Facebook App Setup Guide',
    steps: [
      {
        step: 1,
        title: 'Create Facebook App',
        description: 'Go to Facebook Developers and create a new app',
        url: 'https://developers.facebook.com/apps/',
        actions: [
          'Click "Create App"',
          'Choose "Consumer" or "Business" depending on your use case',
          'Fill in app name and contact email'
        ]
      },
      {
        step: 2,
        title: 'Configure Basic Settings',
        description: 'Set up basic app information',
        actions: [
          'Go to Settings > Basic',
          'Note down your App ID (this is FACEBOOK_APP_ID)',
          'Note down your App Secret (this is FACEBOOK_APP_SECRET)',
          'Add your domain to App Domains'
        ]
      },
      {
        step: 3,
        title: 'Enable Facebook Login',
        description: 'Add Facebook Login product to your app',
        actions: [
          'Go to Products > + Add Product',
          'Find "Facebook Login" and click Setup',
          'Go to Facebook Login > Settings',
          'Add your redirect URIs'
        ]
      },
      {
        step: 4,
        title: 'Configure Valid OAuth Redirect URIs',
        description: 'Set up the callback URLs for authentication',
        redirect_uris: [
          'https://crm.solvify.se/api/auth/callback/facebook',
          'http://localhost:3000/api/auth/callback/facebook (for development)'
        ],
        actions: [
          'Add the redirect URIs to Valid OAuth Redirect URIs',
          'Save changes'
        ]
      },
      {
        step: 5,
        title: 'Set Environment Variables',
        description: 'Add the credentials to your application',
        environment_variables: {
          FACEBOOK_APP_ID: 'Your App ID from step 2',
          FACEBOOK_APP_SECRET: 'Your App Secret from step 2',
          NEXT_PUBLIC_SITE_URL: 'https://crm.solvify.se'
        },
        deployment_instructions: {
          vercel: 'Add via Vercel Dashboard > Project > Settings > Environment Variables',
          netlify: 'Add via Netlify Dashboard > Site Settings > Environment Variables',
          local_development: 'Add to .env.local file in your project root'
        }
      },
      {
        step: 6,
        title: 'Test Integration',
        description: 'Verify everything works',
        actions: [
          'Restart your application after adding environment variables',
          'Visit /api/integrations/facebook/fix to check configuration',
          'Try logging in with Facebook from your settings page'
        ]
      }
    ],
    permissions_needed: [
      'public_profile (default)',
      'email (for user identification)',
      'pages_manage_posts (for posting to Facebook pages)',
      'business_management (for Instagram integration)',
      'instagram_content_publish (for Instagram posting)'
    ],
    common_issues: [
      {
        issue: 'App is in development mode',
        solution: 'Submit app for review or add test users in Roles > Test Users'
      },
      {
        issue: 'Invalid redirect URI',
        solution: 'Ensure redirect URIs match exactly (including https/http)'
      },
      {
        issue: 'App secret is not showing',
        solution: 'Click "Show" next to App Secret and confirm with your password'
      }
    ],
    test_endpoint: '/api/integrations/facebook/fix',
    documentation: 'https://developers.facebook.com/docs/facebook-login/web'
  };

  return NextResponse.json({
    status: 'setup_guide',
    timestamp: new Date().toISOString(),
    guide: setupGuide,
    next_steps: [
      'Follow the setup guide above to create your Facebook App',
      'Add the environment variables to your deployment',
      'Test the integration using the provided endpoints'
    ]
  });
} 