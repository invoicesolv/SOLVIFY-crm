import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  console.log('=== FACEBOOK FULL DEBUG START ===');

  try {
    // 1. Check all environment variables
    const envDebug = {
      FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ? `${process.env.FACEBOOK_APP_ID.substring(0, 10)}...` : 'MISSING',
      FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET ? 'EXISTS' : 'MISSING',
      META_CLIENT_SECRET: process.env.META_CLIENT_SECRET ? 'EXISTS' : 'MISSING', 
      FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ? 'EXISTS' : 'MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'MISSING'
    };

    console.log('Environment variables:', envDebug);

    // 2. Get user's Facebook accounts from database
    const { data: allFacebookAccounts, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Database error', details: dbError }, { status: 500 });
    }

    console.log('Found Facebook accounts:', allFacebookAccounts?.length || 0);

    const personalAccount = allFacebookAccounts?.find(acc => !acc.account_name.includes('(Page)'));
    const pageAccounts = allFacebookAccounts?.filter(acc => acc.account_name.includes('(Page)'));

    if (!personalAccount) {
      return NextResponse.json({ 
        error: 'No personal Facebook account found',
        envDebug,
        allAccounts: allFacebookAccounts?.map(acc => ({
          account_name: acc.account_name,
          account_id: acc.account_id,
          created_at: acc.created_at
        }))
      }, { status: 400 });
    }

    // 3. Determine which app secret to use
    const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET;
    if (!appSecret) {
      return NextResponse.json({ 
        error: 'No Facebook app secret found in environment',
        envDebug,
        message: 'Checked: META_CLIENT_SECRET, FACEBOOK_APP_SECRET, FACEBOOK_CLIENT_SECRET'
      }, { status: 500 });
    }

    console.log('Using app secret from:', 
      process.env.META_CLIENT_SECRET ? 'META_CLIENT_SECRET' :
      process.env.FACEBOOK_APP_SECRET ? 'FACEBOOK_APP_SECRET' :
      process.env.FACEBOOK_CLIENT_SECRET ? 'FACEBOOK_CLIENT_SECRET' : 'NONE'
    );

    // 4. Generate appsecret_proof
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(personalAccount.access_token).digest('hex');

    // 5. Test different Facebook API calls
    const tests: Array<any> = [];

    // Test 1: Basic user info
    try {
      const userUrl = new URL('https://graph.facebook.com/v23.0/me');
      userUrl.searchParams.set('fields', 'id,name,email');
      userUrl.searchParams.set('access_token', personalAccount.access_token);
      userUrl.searchParams.set('appsecret_proof', appsecretProof);

      const userResponse = await fetch(userUrl.toString());
      const userData = await userResponse.json();
      
      tests.push({
        name: 'User Info Test',
        url: userUrl.toString().replace(personalAccount.access_token, '[REDACTED]'),
        status: userResponse.status,
        success: userResponse.ok,
        data: userData
      });
    } catch (error) {
      tests.push({
        name: 'User Info Test',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 2: Pages with minimal fields
    try {
      const pagesUrl = new URL('https://graph.facebook.com/v23.0/me/accounts');
      pagesUrl.searchParams.set('fields', 'id,name');
      pagesUrl.searchParams.set('access_token', personalAccount.access_token);
      pagesUrl.searchParams.set('appsecret_proof', appsecretProof);

      const pagesResponse = await fetch(pagesUrl.toString());
      const pagesData = await pagesResponse.json();
      
      tests.push({
        name: 'Pages Minimal Test',
        url: pagesUrl.toString().replace(personalAccount.access_token, '[REDACTED]'),
        status: pagesResponse.status,
        success: pagesResponse.ok,
        data: pagesData,
        pages_count: pagesData.data?.length || 0
      });
    } catch (error) {
      tests.push({
        name: 'Pages Minimal Test',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 3: Pages with full fields
    try {
      const pagesUrl = new URL('https://graph.facebook.com/v23.0/me/accounts');
      pagesUrl.searchParams.set('fields', 'id,name,access_token,category,category_list,tasks');
      pagesUrl.searchParams.set('access_token', personalAccount.access_token);
      pagesUrl.searchParams.set('appsecret_proof', appsecretProof);

      const pagesResponse = await fetch(pagesUrl.toString());
      const pagesData = await pagesResponse.json();
      
      tests.push({
        name: 'Pages Full Test',
        url: pagesUrl.toString().replace(personalAccount.access_token, '[REDACTED]'),
        status: pagesResponse.status,
        success: pagesResponse.ok,
        data: pagesData,
        pages_count: pagesData.data?.length || 0
      });
    } catch (error) {
      tests.push({
        name: 'Pages Full Test',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    // Test 4: Check token permissions
    try {
      const permissionsUrl = new URL('https://graph.facebook.com/v23.0/me/permissions');
      permissionsUrl.searchParams.set('access_token', personalAccount.access_token);
      permissionsUrl.searchParams.set('appsecret_proof', appsecretProof);

      const permissionsResponse = await fetch(permissionsUrl.toString());
      const permissionsData = await permissionsResponse.json();
      
      tests.push({
        name: 'Token Permissions Test',
        url: permissionsUrl.toString().replace(personalAccount.access_token, '[REDACTED]'),
        status: permissionsResponse.status,
        success: permissionsResponse.ok,
        data: permissionsData,
        granted_permissions: permissionsData.data?.filter((p: any) => p.status === 'granted').map((p: any) => p.permission) || []
      });
    } catch (error) {
      tests.push({
        name: 'Token Permissions Test',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    console.log('=== FACEBOOK FULL DEBUG END ===');

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      user_id: session.user.id,
      environment: envDebug,
      personal_account: {
        account_id: personalAccount.account_id,
        account_name: personalAccount.account_name,
        created_at: personalAccount.created_at,
        token_length: personalAccount.access_token?.length || 0,
        expires_at: personalAccount.expires_at
      },
      existing_page_accounts: pageAccounts?.map(acc => ({
        account_name: acc.account_name,
        account_id: acc.account_id,
        created_at: acc.created_at
      })) || [],
      api_tests: tests
    });

  } catch (error) {
    console.error('Full debug error:', error);
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 