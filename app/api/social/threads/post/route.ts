import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { content, selectedPageId, workspaceId } = await request.json();

    if (!content || !selectedPageId || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: content, selectedPageId, or workspaceId' },
        { status: 400 }
      );
    }

    console.log('🧵 [THREADS POST] Starting post creation:', {
      userId: user.id,
      workspaceId: workspaceId,
      selectedPageId: selectedPageId,
      contentLength: content.length
    });

    // Get the Threads account from database
    const { data: threadsPageAccount, error } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'threads')
      .eq('account_id', selectedPageId)
      .single();

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

    // Generate appsecret_proof for Facebook API security requirement (Threads uses Facebook infrastructure)
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
    // Using Facebook Graph API endpoints since Threads is integrated with Facebook
    const containerParams = new URLSearchParams({
      media_type: 'TEXT',
      text: content,
      access_token: threadsPageAccount.access_token,
      appsecret_proof: appsecret_proof
    });

    // Try using Facebook Graph API for Threads (since Threads uses Facebook infrastructure)
    const response = await fetch(`https://graph.facebook.com/v23.0/${threadsPageAccount.account_id}/threads`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: containerParams
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Threads API error:', errorData);
      
      // If Facebook endpoint doesn't work, try the direct Threads endpoint
      console.log('🔄 Trying direct Threads API endpoint...');
      
      const threadsResponse = await fetch(`https://graph.threads.net/v1.0/${threadsPageAccount.account_id}/threads`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          media_type: 'TEXT',
          text: content,
          access_token: threadsPageAccount.access_token
        })
      });

      if (!threadsResponse.ok) {
        const threadsErrorData = await threadsResponse.json();
        console.error('❌ Direct Threads API error:', threadsErrorData);
        throw new Error(`Threads API error: ${threadsErrorData.error?.message || 'Unknown error'}`);
      }

      const containerData = await threadsResponse.json();
      console.log('🧵 Threads container created via direct API:', containerData);

      // Now publish the container using direct Threads API
      const publishParams = new URLSearchParams({
        creation_id: containerData.id,
        access_token: threadsPageAccount.access_token
      });

      const publishResponse = await fetch(`https://graph.threads.net/v1.0/${threadsPageAccount.account_id}/threads_publish`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: publishParams
      });

      if (!publishResponse.ok) {
        const publishErrorData = await publishResponse.json();
        console.error('❌ Threads publish error:', publishErrorData);
        throw new Error(`Threads publish error: ${publishErrorData.error?.message || 'Unknown error'}`);
      }

      const publishResult = await publishResponse.json();
      console.log('✅ Threads post published successfully via direct API:', publishResult);

      return NextResponse.json({
        success: true,
        message: `Posted to Threads page: ${pageName}`,
        postId: publishResult.id,
        platform: 'threads'
      });
    }

    const containerData = await response.json();
    console.log('🧵 Threads container created:', containerData);

    // Now publish the container using Facebook Graph API
    const publishParams = new URLSearchParams({
      creation_id: containerData.id,
      access_token: threadsPageAccount.access_token,
      appsecret_proof: appsecret_proof
    });

    const publishResponse = await fetch(`https://graph.facebook.com/v23.0/${threadsPageAccount.account_id}/threads_publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: publishParams
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

  } catch (error) {
    console.error('❌ Threads posting error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to post to Threads',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 