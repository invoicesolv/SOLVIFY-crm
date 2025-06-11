import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const results: {
    environment: any;
    oauth_url_test: any;
    api_tests: any;
    recommendations: string[];
  } = {
    environment: {},
    oauth_url_test: {},
    api_tests: {},
    recommendations: []
  };

  // 1. Environment Check
  results.environment = {
    facebook_app_id: process.env.FACEBOOK_APP_ID || 'MISSING',
    facebook_app_secret: !!process.env.FACEBOOK_APP_SECRET,
    nextauth_url: process.env.NEXTAUTH_URL || 'MISSING',
    node_env: process.env.NODE_ENV || 'development'
  };

  // 2. OAuth URL Generation Test
  const clientId = process.env.FACEBOOK_APP_ID;
  const redirectUri = `${process.env.NEXTAUTH_URL}/api/oauth/facebook/callback`;
  
  results.oauth_url_test = {
    client_id: clientId,
    redirect_uri: redirectUri,
    redirect_uri_issues: redirectUri.includes('//api/') ? ['DOUBLE SLASH DETECTED'] : [],
    api_version: 'v23.0',
    scopes: [
      'public_profile',
      'email', 
      'pages_show_list',
      'pages_read_engagement',
      'pages_manage_posts',
      'pages_manage_engagement',
      'pages_manage_metadata',
      'pages_read_user_content',
      'business_management',
      'read_insights'
    ]
  };

  // 3. Test Facebook Graph API Access (without permissions)
  if (clientId) {
    try {
      // Test basic app info endpoint
      const appInfoUrl = `https://graph.facebook.com/v23.0/${clientId}?fields=name,company,category,restrictions,app_domains,website_url,privacy_policy_url,terms_of_service_url&access_token=${clientId}|${process.env.FACEBOOK_APP_SECRET}`;
      
      const appResponse = await fetch(appInfoUrl);
      const appData = await appResponse.json();
      
      results.api_tests.app_info = {
        status: appResponse.status,
        success: appResponse.ok,
        data: appData,
        issues: appData.error ? [appData.error.message] : []
      };
    } catch (error) {
      results.api_tests.app_info = {
        status: 'ERROR',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        issues: ['Failed to connect to Facebook Graph API']
      };
    }

    // Test permissions endpoint (this might reveal permission issues)
    try {
      const permissionsUrl = `https://graph.facebook.com/v23.0/${clientId}/permissions?access_token=${clientId}|${process.env.FACEBOOK_APP_SECRET}`;
      
      const permResponse = await fetch(permissionsUrl);
      const permData = await permResponse.json();
      
      results.api_tests.app_permissions = {
        status: permResponse.status,
        success: permResponse.ok,
        data: permData,
        issues: permData.error ? [permData.error.message] : []
      };
    } catch (error) {
      results.api_tests.app_permissions = {
        status: 'ERROR',
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        issues: ['Failed to check app permissions']
      };
    }
  }

  // 4. Generate Recommendations
  if (results.oauth_url_test.redirect_uri_issues.length > 0) {
    results.recommendations.push('FIX REDIRECT URI: Remove double slash in NEXTAUTH_URL environment variable');
  }

  if (results.api_tests.app_info?.data?.error) {
    results.recommendations.push(`FACEBOOK APP ISSUE: ${results.api_tests.app_info.data.error.message}`);
  }

  if (results.environment.node_env === 'development') {
    results.recommendations.push('CHECK APP MODE: Ensure Facebook app is in LIVE mode, not Development mode');
  }

  results.recommendations.push('VERIFY FACEBOOK APP SETTINGS:');
  results.recommendations.push('1. App Mode: Should be "Live"');
  results.recommendations.push(`2. Redirect URI: Must include exactly "${redirectUri}"`);
  results.recommendations.push('3. App Domain: Should be "crm.solvify.se"');
  results.recommendations.push('4. Business Verification: Must be completed');
  results.recommendations.push('5. All permissions: Must be "Advanced Access" approved');

  // 5. Generate test OAuth URL
  if (clientId) {
    const testUrl = new URL('https://www.facebook.com/v23.0/dialog/oauth');
    testUrl.searchParams.set('client_id', clientId);
    testUrl.searchParams.set('redirect_uri', redirectUri);
    testUrl.searchParams.set('scope', results.oauth_url_test.scopes.join(','));
    testUrl.searchParams.set('response_type', 'code');
    testUrl.searchParams.set('state', JSON.stringify({test: true}));
    testUrl.searchParams.set('extras', JSON.stringify({feature: 'login_for_business'}));
    
    results.oauth_url_test.test_url = testUrl.toString();
  }

  return NextResponse.json(results, { 
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
} 