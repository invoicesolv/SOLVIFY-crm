import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { content, selectedPageId, workspaceId } = await request.json();

    console.log('🔍 Facebook post API called:', { selectedPageId, workspaceId });

    if (!content || !selectedPageId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: content, selectedPageId, or workspaceId' },
        { status: 400 }
      );
    }

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Environment variables check:', {
        NEXT_PUBLIC_SUPABASE_URL: supabaseUrl ? 'present' : 'missing',
        NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'present' : 'missing'
      });
      return NextResponse.json(
        { error: 'Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the selected Facebook page's access token from database
    const { data: facebookPageAccount, error } = await supabase
      .from('social_accounts')
      .select('access_token, account_id, account_name')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'facebook')
      .eq('account_id', selectedPageId)
      .eq('is_connected', true)
      .single();

    console.log('📊 Database query result:', { facebookPageAccount: !!facebookPageAccount, error });

    if (error || !facebookPageAccount) {
      // Debug: Get all Facebook accounts for this workspace
      const { data: allFacebookAccounts } = await supabase
        .from('social_accounts')
        .select('*')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'facebook');
      
      console.log('❌ All Facebook accounts for workspace:', allFacebookAccounts);
      
      return NextResponse.json(
        { 
          error: `Facebook page not found. Selected ID: ${selectedPageId}, Error: ${error?.message || 'Unknown'}`,
          availableAccounts: allFacebookAccounts?.map(acc => ({
            id: acc.account_id,
            name: acc.account_name
          }))
        },
        { status: 404 }
      );
    }

    // Generate appsecret_proof for Facebook API security requirement
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || 
                         process.env.META_CLIENT_SECRET || 
                         process.env.FACEBOOK_APP_SECRET;
                         
    if (!clientSecret) {
      console.error('Facebook client secret environment variables check:', {
        FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET ? 'present' : 'missing',
        META_CLIENT_SECRET: process.env.META_CLIENT_SECRET ? 'present' : 'missing',
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ? 'present' : 'missing'
      });
      return NextResponse.json(
        { error: 'Facebook client secret not configured. Checked: FACEBOOK_CLIENT_SECRET, META_CLIENT_SECRET, FACEBOOK_APP_SECRET' },
        { status: 500 }
      );
    }

    const appsecret_proof = crypto.createHmac('sha256', clientSecret).update(facebookPageAccount.access_token).digest('hex');

    // Use the selected page directly since we already have its access token
    const pageName = facebookPageAccount.account_name.replace(' (Page)', '');
    console.log(`✅ Posting to Facebook page: ${pageName} (${facebookPageAccount.account_id})`);

    // Post to the selected page using its access token with appsecret_proof
    const response = await fetch(`https://graph.facebook.com/${facebookPageAccount.account_id}/feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: content,
        access_token: facebookPageAccount.access_token,
        appsecret_proof: appsecret_proof
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Facebook API Error:', errorData);
      
      // Provide more specific error messages
      if (errorData.error?.code === 200) {
        return NextResponse.json(
          { error: 'Insufficient permissions. Make sure you have admin access to the Facebook page and the required permissions are approved.' },
          { status: 403 }
        );
      } else if (errorData.error?.code === 190) {
        return NextResponse.json(
          { error: 'Facebook access token expired. Please reconnect your Facebook account.' },
          { status: 401 }
        );
      } else {
        return NextResponse.json(
          { error: errorData.error?.message || `Failed to post to Facebook page: ${pageName}` },
          { status: 400 }
        );
      }
    }

    const result = await response.json();
    console.log(`Facebook page post successful to ${pageName}:`, result);
    
    return NextResponse.json({
      success: true,
      data: result,
      pageName: pageName
    });

  } catch (error) {
    console.error('Facebook posting error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error occurred' },
      { status: 500 }
    );
  }
} 