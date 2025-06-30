import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient } from '@/lib/supabase-client';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  const supabase = supabaseClient;
  const user = await getUserFromToken(request);
  
  if (!user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get all Facebook accounts for this user
    const { data: allFacebookAccounts, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .order('created_at', { ascending: false });

    if (dbError) {
      return NextResponse.json({ error: 'Database error', details: dbError }, { status: 500 });
    }

    // Environment check
    const envCheck = {
      FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ? 'EXISTS' : 'MISSING',
      FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET ? 'EXISTS' : 'MISSING',
      META_CLIENT_SECRET: process.env.META_CLIENT_SECRET ? 'EXISTS' : 'MISSING',
      FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ? 'EXISTS' : 'MISSING',
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL || 'MISSING'
    };

    // Categorize accounts
    const personalAccount = allFacebookAccounts?.find(acc => !acc.account_name.includes('(Page)'));
    const pageAccounts = allFacebookAccounts?.filter(acc => acc.account_name.includes('(Page)'));

    return NextResponse.json({
      success: true,
      environment: envCheck,
      accounts: {
        total: allFacebookAccounts?.length || 0,
        has_personal: !!personalAccount,
        pages_count: pageAccounts?.length || 0,
        personal_account: personalAccount ? {
          account_id: personalAccount.account_id,
          account_name: personalAccount.account_name,
          created_at: personalAccount.created_at
        } : null,
        page_accounts: pageAccounts?.map(acc => ({
          account_id: acc.account_id,
          account_name: acc.account_name,
          created_at: acc.created_at
        })) || []
      },
      solution: !personalAccount && pageAccounts && pageAccounts.length > 0 
        ? 'POST to this endpoint to create missing personal account from page data'
        : personalAccount 
        ? 'Personal account exists - no action needed'
        : 'No Facebook accounts found - need to reconnect Facebook'
    });

  } catch (error) {
    console.error('Facebook personal account check error:', error);
    return NextResponse.json({ 
      error: 'Check failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const supabase = supabaseClient;
  const user = await getUserFromToken(request);
  
  if (!user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get the first page account to extract user info from
    const { data: pageAccounts, error: pageError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .ilike('account_name', '%(Page)')
      .limit(1);

    if (pageError || !pageAccounts || pageAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook page accounts found',
        message: 'Need at least one Facebook page account to extract user info from'
      }, { status: 400 });
    }

    const pageAccount = pageAccounts[0];
    
    // Determine which app secret to use (prioritize META_CLIENT_SECRET and FACEBOOK_APP_SECRET)
    const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET || process.env.FACEBOOK_CLIENT_SECRET;
    if (!appSecret) {
      return NextResponse.json({ 
        error: 'Facebook app secret not configured',
        message: 'Need META_CLIENT_SECRET, FACEBOOK_APP_SECRET, or FACEBOOK_CLIENT_SECRET'
      }, { status: 500 });
    }

    // Generate appsecret_proof for secure Facebook API call
    const appsecret_proof = crypto.createHmac('sha256', appSecret).update(pageAccount.access_token).digest('hex');

    // Get user info from Facebook using the page's access token
    const userUrl = new URL('https://graph.facebook.com/v23.0/me');
    userUrl.searchParams.set('fields', 'id,name');
    userUrl.searchParams.set('access_token', pageAccount.access_token);
    userUrl.searchParams.set('appsecret_proof', appsecret_proof);

    const userResponse = await fetch(userUrl.toString());
    
    if (!userResponse.ok) {
      const errorText = await userResponse.text();
      return NextResponse.json({ 
        error: 'Failed to fetch user info from Facebook',
        facebook_error: errorText,
        status: userResponse.status
      }, { status: 400 });
    }

    const userData = await userResponse.json();

    // Create the personal account entry
    const { error: createError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: user.id,
        workspace_id: pageAccount.workspace_id,
        platform: 'facebook',
        access_token: pageAccount.access_token, // Use same token as page
        account_id: userData.id,
        account_name: userData.name || 'Facebook Account',
        is_connected: true,
        token_expires_at: pageAccount.token_expires_at,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,platform,account_id'
      });

    if (createError) {
      return NextResponse.json({ 
        error: 'Failed to create personal account',
        details: createError
      }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      message: 'Personal Facebook account created successfully',
      account: {
        account_id: userData.id,
        account_name: userData.name,
        workspace_id: pageAccount.workspace_id
      }
    });

  } catch (error) {
    console.error('Facebook personal account creation error:', error);
    return NextResponse.json({ 
      error: 'Creation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 