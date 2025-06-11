import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get all Facebook accounts for this user
    const { data: allFacebookAccounts, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .order('created_at', { ascending: false });

    if (dbError) {
      return NextResponse.json({ error: 'Database error', details: dbError }, { status: 500 });
    }

    // Categorize accounts
    const personalAccount = allFacebookAccounts?.find(acc => !acc.account_name.includes('(Page)'));
    const pageAccounts = allFacebookAccounts?.filter(acc => acc.account_name.includes('(Page)'));

    // Environment variables check
    const envCheck = {
      FACEBOOK_APP_ID: process.env.FACEBOOK_APP_ID ? 'EXISTS' : 'MISSING',
      FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET ? 'EXISTS' : 'MISSING',
      META_CLIENT_SECRET: process.env.META_CLIENT_SECRET ? 'EXISTS' : 'MISSING',
      FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ? 'EXISTS' : 'MISSING',
      NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'MISSING'
    };

    return NextResponse.json({
      success: true,
      environment: envCheck,
      accounts_summary: {
        total_facebook_accounts: allFacebookAccounts?.length || 0,
        has_personal_account: !!personalAccount,
        page_accounts_count: pageAccounts?.length || 0
      },
      personal_account: personalAccount ? {
        account_id: personalAccount.account_id,
        account_name: personalAccount.account_name,
        created_at: personalAccount.created_at,
        is_connected: personalAccount.is_connected,
        token_length: personalAccount.access_token?.length || 0
      } : null,
      page_accounts: pageAccounts?.map(acc => ({
        account_id: acc.account_id,
        account_name: acc.account_name,
        created_at: acc.created_at,
        is_connected: acc.is_connected,
        token_length: acc.access_token?.length || 0
      })) || [],
      all_accounts_raw: allFacebookAccounts?.map(acc => ({
        id: acc.id,
        account_id: acc.account_id,
        account_name: acc.account_name,
        platform: acc.platform,
        is_connected: acc.is_connected,
        created_at: acc.created_at,
        workspace_id: acc.workspace_id
      })) || []
    });

  } catch (error) {
    console.error('Facebook accounts check error:', error);
    return NextResponse.json({ 
      error: 'Check failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const { action } = await request.json();

    if (action === 'create_personal_account') {
      // Get the first page account to extract the user's Facebook ID and token
      const { data: pageAccounts, error: pageError } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('user_id', session.user.id)
        .eq('platform', 'facebook')
        .ilike('account_name', '%(Page)')
        .limit(1);

      if (pageError || !pageAccounts || pageAccounts.length === 0) {
        return NextResponse.json({ error: 'No page accounts found to extract user info from' }, { status: 400 });
      }

      const pageAccount = pageAccounts[0];
      
      // Use the page's access token to get user info
      const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
      if (!appSecret) {
        return NextResponse.json({ error: 'Facebook app secret not configured' }, { status: 500 });
      }

      const crypto = require('crypto');  
      const appsecret_proof = crypto.createHmac('sha256', appSecret).update(pageAccount.access_token).digest('hex');

      // Try to get user info from Facebook
      const userResponse = await fetch(`https://graph.facebook.com/me?access_token=${pageAccount.access_token}&appsecret_proof=${appsecret_proof}&fields=id,name`);
      
      if (!userResponse.ok) {
        return NextResponse.json({ error: 'Failed to fetch user info from Facebook' }, { status: 400 });
      }

      const userData = await userResponse.json();

      // Create the personal account entry
      const { error: createError } = await supabase
        .from('social_accounts')
        .upsert({
          user_id: session.user.id,
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
        return NextResponse.json({ error: 'Failed to create personal account', details: createError }, { status: 500 });
      }

      return NextResponse.json({ 
        success: true, 
        message: 'Personal Facebook account created',
        account: {
          account_id: userData.id,
          account_name: userData.name
        }
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Facebook accounts creation error:', error);
    return NextResponse.json({ 
      error: 'Creation failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 