import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { content, workspaceId, selectedAccountId } = await request.json();

    if (!content || !workspaceId) {
      return NextResponse.json(
        { error: 'Missing required fields: content or workspaceId' },
        { status: 400 }
      );
    }

    console.log('🐦 [X POST] Starting tweet creation:', {
      userId: session.user.id,
      workspaceId: workspaceId,
      selectedAccountId: selectedAccountId,
      contentLength: content.length
    });

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing required environment variables' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the X (Twitter) account from database
    let query = supabase
      .from('social_accounts')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'x')
      .eq('is_connected', true);

    // If specific account selected, filter by account_id
    if (selectedAccountId) {
      query = query.eq('account_id', selectedAccountId);
    }

    const { data: twitterAccounts, error } = await query;

    if (error || !twitterAccounts || twitterAccounts.length === 0) {
      console.error('❌ X account not found. Fetching all X accounts for debugging...');
      
      // Debug: Get all X accounts for this workspace
      const { data: allXAccounts } = await supabase
        .from('social_accounts')
        .select('account_id, account_name, platform')
        .eq('workspace_id', workspaceId)
        .eq('platform', 'x');
      
      console.error('❌ All X accounts for this workspace:', allXAccounts);
      
      return NextResponse.json(
        { error: 'X (Twitter) account not connected or access token not found' },
        { status: 404 }
      );
    }

    // Use the selected account or first available account
    const twitterAccount = twitterAccounts[0];

    console.log(`✅ Posting to X account: @${twitterAccount.account_name} (${twitterAccount.account_id})`);

    // Post tweet using Twitter API v2
    const response = await fetch('https://api.twitter.com/2/tweets', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${twitterAccount.access_token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: content
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ X API error:', errorData);
      
      // Provide more specific error messages
      if (errorData.status === 401) {
        return NextResponse.json(
          { error: 'X access token expired. Please reconnect your X account.' },
          { status: 401 }
        );
      } else if (errorData.status === 403) {
        return NextResponse.json(
          { error: 'Insufficient permissions. Make sure your X app has write permissions.' },
          { status: 403 }
        );
      } else if (errorData.detail) {
        return NextResponse.json(
          { error: errorData.detail },
          { status: 400 }
        );
      } else {
        return NextResponse.json(
          { error: errorData.title || 'Failed to post to X (Twitter)' },
          { status: 400 }
        );
      }
    }

    const result = await response.json();
    console.log('✅ X post successful:', result);

    return NextResponse.json({
      success: true,
      message: `Posted to X account: @${twitterAccount.account_name}`,
      postId: result.data.id,
      platform: 'x',
      tweetUrl: `https://twitter.com/${twitterAccount.account_name}/status/${result.data.id}`
    });

  } catch (error) {
    console.error('❌ X posting error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to post to X (Twitter)',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 