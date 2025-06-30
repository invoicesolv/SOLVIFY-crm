import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    const { content, selectedPageId, workspaceId } = await request.json();

    console.log('🔍 Instagram post API called:', { selectedPageId, workspaceId });

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

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the selected Instagram page's access token from database
    const { data: instagramPageAccount, error } = await supabase
      .from('social_accounts')
      .select('access_token, account_id, account_name')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'instagram')
      .eq('account_id', selectedPageId)
      .eq('is_connected', true)
      .single();

    console.log('📊 Database query result:', { 
      error, 
      found: !!instagramPageAccount,
      accountName: instagramPageAccount?.account_name 
    });

    if (error || !instagramPageAccount) {
      console.error('❌ Instagram page not found. Fetching all Instagram accounts for debugging...');
      
      // Debug: Get all Instagram accounts for this workspace
      const { data: allInstagramAccounts } = await supabase
        .from('social_accounts')
        .select('account_id, account_name, platform')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'instagram');
      
      console.error('❌ All Instagram accounts for this workspace:', allInstagramAccounts);
      
      return NextResponse.json(
        { error: 'Instagram page not connected or access token not found' },
        { status: 404 }
      );
    }

    // Generate appsecret_proof for Instagram API security requirement
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || 
                         process.env.META_CLIENT_SECRET || 
                         process.env.FACEBOOK_APP_SECRET;
                         
    if (!clientSecret) {
      console.error('Instagram client secret environment variables check:', {
        FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET ? 'present' : 'missing',
        META_CLIENT_SECRET: process.env.META_CLIENT_SECRET ? 'present' : 'missing',
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ? 'present' : 'missing'
      });
      return NextResponse.json(
        { error: 'Instagram client secret not configured' },
        { status: 500 }
      );
    }

    const appsecret_proof = crypto.createHmac('sha256', clientSecret).update(instagramPageAccount.access_token).digest('hex');

    // Use the selected page directly since we already have its access token
    const pageName = instagramPageAccount.account_name.replace(' (Page)', '');
    console.log(`✅ Posting to Instagram page: ${pageName} (${instagramPageAccount.account_id})`);

    // For Instagram, we need to create media first, then publish it
    // Since this is a text post, we'll use Instagram's text-only post feature
    const response = await fetch(`https://graph.facebook.com/v23.0/${instagramPageAccount.account_id}/media`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        caption: content,
        access_token: instagramPageAccount.access_token,
        appsecret_proof: appsecret_proof
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Instagram API error:', errorData);
      throw new Error(`Instagram API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const mediaData = await response.json();
    console.log('📱 Instagram media created:', mediaData);

    // Now publish the media
    const publishResponse = await fetch(`https://graph.facebook.com/v23.0/${instagramPageAccount.account_id}/media_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: mediaData.id,
        access_token: instagramPageAccount.access_token,
        appsecret_proof: appsecret_proof
      })
    });

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json();
      console.error('❌ Instagram publish error:', errorData);
      throw new Error(`Instagram publish error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const publishResult = await publishResponse.json();
    console.log('✅ Instagram post published successfully:', publishResult);

    return NextResponse.json({
      success: true,
      message: `Posted to Instagram page: ${pageName}`,
      postId: publishResult.id,
      platform: 'instagram'
    });

  } catch (error: any) {
    console.error('❌ Instagram posting error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post to Instagram' },
      { status: 500 }
    );
  }
} 