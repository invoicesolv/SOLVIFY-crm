import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.TWITTER_CLIENT_ID;
    const clientSecret = process.env.TWITTER_CLIENT_SECRET;
    
    console.log('=== TWITTER CREDENTIALS DEBUG ===');
    console.log('Client ID exists:', !!clientId);
    console.log('Client Secret exists:', !!clientSecret);
    console.log('Client ID length:', clientId?.length);
    console.log('Client Secret length:', clientSecret?.length);
    console.log('Client ID preview:', clientId?.substring(0, 10) + '...');
    console.log('Client Secret preview:', clientSecret?.substring(0, 10) + '...');
    
    if (clientId && clientSecret) {
      // Create Basic auth header - Twitter API v2 requires BOTH auth header AND body params
      const credentials = `${clientId}:${clientSecret}`;
      const encodedCredentials = Buffer.from(credentials).toString('base64');
      console.log('Basic auth header length:', encodedCredentials.length);
      
      // Test credentials using Twitter API v2 client credentials flow
      // For Twitter API v2, we need BOTH Basic auth header AND body parameters
      console.log('Testing credentials with Twitter API v2 client credentials flow...');
      const testResponse = await fetch('https://api.twitter.com/2/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${encodedCredentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: clientId,
          client_secret: clientSecret,
          client_type: 'third_party_app',
          scope: 'tweet.read tweet.write users.read',
        }),
      });
      
      console.log('Test response status:', testResponse.status);
      const testResult = await testResponse.text();
      console.log('Test response:', testResult);
      
      // If successful, try to use the bearer token to make a simple API call
      let apiTestResult: any = null;
      if (testResponse.ok) {
        try {
          const tokenData = JSON.parse(testResult);
          if (tokenData.access_token) {
            console.log('Got bearer token, testing API call...');
            const apiResponse = await fetch('https://api.twitter.com/2/users/by/username/twitter', {
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
              },
            });
            console.log('API test response status:', apiResponse.status);
            const apiResult = await apiResponse.text();
            apiTestResult = {
              status: apiResponse.status,
              response: apiResult.substring(0, 200) + '...' // Truncate for brevity
            };
          }
        } catch (error) {
          console.log('API test failed:', error);
          apiTestResult = { error: error instanceof Error ? error.message : 'Unknown error' };
        }
      }
      
      return NextResponse.json({
        status: 'debug',
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
        clientIdLength: clientId?.length,
        clientSecretLength: clientSecret?.length,
        testResponseStatus: testResponse.status,
        testResponse: testResult,
        apiTest: apiTestResult,
        note: testResponse.status === 200 ? '✅ Credentials are valid!' : '❌ Credentials test failed',
        endpoint: 'Using Twitter API v2 endpoint: /2/oauth2/token with client_secret in body'
      });
    }
    
    return NextResponse.json({
      status: 'error',
      message: 'Missing Twitter credentials',
      hasClientId: !!clientId,
      hasClientSecret: !!clientSecret
    });
    
  } catch (error) {
    console.error('Twitter credentials debug error:', error);
    return NextResponse.json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
} 