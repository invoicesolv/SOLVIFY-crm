import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

function generateAppSecretProof(accessToken: string, appSecret: string): string {
  return crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - please log in'
      }, { status: 401 });
    }

    const debugSteps: string[] = [];
    const apiResponses: any = {};
    const errors: any[] = [];

    debugSteps.push('Getting Facebook access token from database');

    // Get Facebook access token
    const { data: facebookIntegration, error: fbError } = await supabase
      .from('integrations')
      .select('access_token')
      .eq('user_id', session.user.id)
      .eq('service_name', 'facebook')
      .single();

    if (fbError || !facebookIntegration?.access_token) {
      return NextResponse.json({
        success: false,
        error: 'No Facebook access token found',
        debug: { steps: debugSteps }
      }, { status: 404 });
    }

    const accessToken = facebookIntegration.access_token;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const appsecretProof = generateAppSecretProof(accessToken, appSecret);

    debugSteps.push('Testing multiple Facebook Graph API endpoints');

    // Test 1: Get user info
    debugSteps.push('1. Testing /me endpoint');
    try {
      const userResponse = await fetch(
        `https://graph.facebook.com/v18.0/me?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      const userData = await userResponse.json();
      apiResponses.userInfo = {
        status: userResponse.status,
        ok: userResponse.ok,
        data: userData
      };
    } catch (error) {
      errors.push({ endpoint: '/me', error: error instanceof Error ? error.message : String(error) });
    }

    // Test 2: Get accounts with instagram_business_account field
    debugSteps.push('2. Testing /me/accounts with instagram_business_account field');
    try {
      const accountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      const accountsData = await accountsResponse.json();
      apiResponses.accounts = {
        status: accountsResponse.status,
        ok: accountsResponse.ok,
        data: accountsData
      };
    } catch (error) {
      errors.push({ endpoint: '/me/accounts', error: error instanceof Error ? error.message : String(error) });
    }

    // Test 3: Get accounts with connected_instagram_account field
    debugSteps.push('3. Testing /me/accounts with connected_instagram_account field');
    try {
      const connectedResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,connected_instagram_account&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      const connectedData = await connectedResponse.json();
      apiResponses.connectedAccounts = {
        status: connectedResponse.status,
        ok: connectedResponse.ok,
        data: connectedData
      };
    } catch (error) {
      errors.push({ endpoint: '/me/accounts (connected)', error: error instanceof Error ? error.message : String(error) });
    }

    // Test 4: Get accounts with all Instagram-related fields
    debugSteps.push('4. Testing /me/accounts with all Instagram fields');
    try {
      const allFieldsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token,instagram_business_account,connected_instagram_account,instagram_accounts&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      const allFieldsData = await allFieldsResponse.json();
      apiResponses.allFields = {
        status: allFieldsResponse.status,
        ok: allFieldsResponse.ok,
        data: allFieldsData
      };
    } catch (error) {
      errors.push({ endpoint: '/me/accounts (all fields)', error: error instanceof Error ? error.message : String(error) });
    }

    // Test 5: Try to get Instagram accounts directly
    debugSteps.push('5. Testing /me/instagram_accounts endpoint');
    try {
      const igAccountsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/instagram_accounts?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      const igAccountsData = await igAccountsResponse.json();
      apiResponses.instagramAccounts = {
        status: igAccountsResponse.status,
        ok: igAccountsResponse.ok,
        data: igAccountsData
      };
    } catch (error) {
      errors.push({ endpoint: '/me/instagram_accounts', error: error instanceof Error ? error.message : String(error) });
    }

    // Test 6: Check permissions
    debugSteps.push('6. Testing /me/permissions endpoint');
    try {
      const permissionsResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/permissions?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      const permissionsData = await permissionsResponse.json();
      apiResponses.permissions = {
        status: permissionsResponse.status,
        ok: permissionsResponse.ok,
        data: permissionsData
      };
    } catch (error) {
      errors.push({ endpoint: '/me/permissions', error: error instanceof Error ? error.message : String(error) });
    }

    debugSteps.push('Completed all API tests');

    // Analyze results
    const instagramAccountsFound: any[] = [];
    
    // Check accounts response for Instagram connections
    if (apiResponses.accounts?.data?.data) {
      for (const page of apiResponses.accounts.data.data) {
        if (page.instagram_business_account) {
          instagramAccountsFound.push({
            source: 'instagram_business_account',
            pageId: page.id,
            pageName: page.name,
            instagramAccount: page.instagram_business_account
          });
        }
      }
    }

    // Check connected accounts response
    if (apiResponses.connectedAccounts?.data?.data) {
      for (const page of apiResponses.connectedAccounts.data.data) {
        if (page.connected_instagram_account) {
          instagramAccountsFound.push({
            source: 'connected_instagram_account',
            pageId: page.id,
            pageName: page.name,
            instagramAccount: page.connected_instagram_account
          });
        }
      }
    }

    // Check direct Instagram accounts
    if (apiResponses.instagramAccounts?.data?.data) {
      for (const account of apiResponses.instagramAccounts.data.data) {
        instagramAccountsFound.push({
          source: 'direct_instagram_accounts',
          instagramAccount: account
        });
      }
    }

    const result = {
      success: instagramAccountsFound.length > 0,
      message: instagramAccountsFound.length > 0 
        ? `Found ${instagramAccountsFound.length} Instagram account(s) via Graph API`
        : 'No Instagram accounts found via Graph API',
      instagramAccountsFound,
      debug: {
        steps: debugSteps,
        apiResponses,
        errors: errors.length > 0 ? errors : undefined,
        userId: session.user.id,
        timestamp: new Date().toISOString()
      }
    };

    return NextResponse.json(result);

  } catch (error) {
    console.error('[Facebook Graph API Debug] Unexpected error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 