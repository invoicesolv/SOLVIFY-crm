import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const { content, selectedPageId, workspaceId } = await request.json();

    console.log('🔍 Threads post API called:', { selectedPageId, workspaceId });

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

    // Get the selected Threads page's access token from database
    const { data: threadsPageAccount, error } = await supabase
      .from('social_accounts')
      .select('access_token, account_id, account_name')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'threads')
      .eq('account_id', selectedPageId)
      .eq('is_connected', true)
      .single();

    console.log('📊 Database query result:', { 
      error, 
      found: !!threadsPageAccount,
      accountName: threadsPageAccount?.account_name 
    });

    if (error || !threadsPageAccount) {
      console.error('❌ Threads page not found. Fetching all Threads accounts for debugging...');
      
      // Debug: Get all Threads accounts for this workspace
      const { data: allThreadsAccounts } = await supabase
        .from('social_accounts')
        .select('account_id, account_name, platform')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'threads');
      
      console.error('❌ All Threads accounts for this workspace:', allThreadsAccounts);
      
      return NextResponse.json(
        { error: 'Threads page not connected or access token not found' },
        { status: 404 }
      );
    }

    // Generate appsecret_proof for Threads API security requirement
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || 
                         process.env.META_CLIENT_SECRET || 
                         process.env.FACEBOOK_APP_SECRET;
                         
    if (!clientSecret) {
      console.error('Threads client secret environment variables check:', {
        FACEBOOK_CLIENT_SECRET: process.env.FACEBOOK_CLIENT_SECRET ? 'present' : 'missing',
        META_CLIENT_SECRET: process.env.META_CLIENT_SECRET ? 'present' : 'missing',
        FACEBOOK_APP_SECRET: process.env.FACEBOOK_APP_SECRET ? 'present' : 'missing'
      });
      return NextResponse.json(
        { error: 'Threads client secret not configured' },
        { status: 500 }
      );
    }

    const appsecret_proof = crypto.createHmac('sha256', clientSecret).update(threadsPageAccount.access_token).digest('hex');

    // Use the selected page directly since we already have its access token
    const pageName = threadsPageAccount.account_name.replace(' (Page)', '');
    console.log(`✅ Posting to Threads page: ${pageName} (${threadsPageAccount.account_id})`);

    // For Threads, we need to create a container first, then publish it
    const response = await fetch(`https://graph.threads.net/v1.0/${threadsPageAccount.account_id}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        media_type: 'TEXT',
        text: content,
        access_token: threadsPageAccount.access_token,
        appsecret_proof: appsecret_proof
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Threads API error:', errorData);
      throw new Error(`Threads API error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const containerData = await response.json();
    console.log('🧵 Threads container created:', containerData);

    // Now publish the container
    const publishResponse = await fetch(`https://graph.threads.net/v1.0/${threadsPageAccount.account_id}/threads_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        creation_id: containerData.id,
        access_token: threadsPageAccount.access_token,
        appsecret_proof: appsecret_proof
      })
    });

    if (!publishResponse.ok) {
      const errorData = await publishResponse.json();
      console.error('❌ Threads publish error:', errorData);
      throw new Error(`Threads publish error: ${errorData.error?.message || 'Unknown error'}`);
    }

    const publishResult = await publishResponse.json();
    console.log('✅ Threads post published successfully:', publishResult);

    return NextResponse.json({
      success: true,
      message: `Posted to Threads page: ${pageName}`,
      postId: publishResult.id,
      platform: 'threads'
    });

  } catch (error: any) {
    console.error('❌ Threads posting error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to post to Threads' },
      { status: 500 }
    );
  }
} 