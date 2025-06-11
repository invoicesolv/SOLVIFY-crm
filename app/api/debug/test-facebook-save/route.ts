import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';  
import { createClient } from '@supabase/supabase-js';
import { getActiveWorkspaceId } from '@/lib/permission';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get workspace ID
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 400 });
    }

    // Test saving a Facebook account to see what happens
    const testAccount = {
      user_id: session.user.id,
      workspace_id: workspaceId,
      platform: 'facebook',
      access_token: 'test_token_12345',
      account_id: 'test_facebook_id',
      account_name: 'Test Facebook Account',
      is_connected: true,
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Testing Facebook account save with data:', testAccount);

    const { data, error: saveError } = await supabase
      .from('social_accounts')
      .upsert(testAccount, {
        onConflict: 'workspace_id,platform,account_id'
      })
      .select();

    if (saveError) {
      console.error('Facebook test save error:', saveError);
      return NextResponse.json({ 
        error: 'Failed to save test Facebook account',
        details: saveError,
        test_data: testAccount
      }, { status: 500 });
    }

    // Check if it was actually saved
    const { data: savedAccounts, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .eq('account_id', 'test_facebook_id');

    if (fetchError) {
      return NextResponse.json({ 
        error: 'Failed to fetch saved account',
        details: fetchError
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test Facebook account saved successfully',
      saved_data: data,
      verification: savedAccounts,
      workspace_id: workspaceId,
      user_id: session.user.id
    });

  } catch (error) {
    console.error('Facebook test save error:', error);
    return NextResponse.json({ 
      error: 'Test failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Clean up test data
    const { error: deleteError } = await supabase
      .from('social_accounts')
      .delete()
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .eq('account_id', 'test_facebook_id');

    if (deleteError) {
      return NextResponse.json({ 
        error: 'Failed to delete test account',
        details: deleteError
      }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Test Facebook account deleted successfully'
    });

  } catch (error) {
    console.error('Facebook test delete error:', error);
    return NextResponse.json({ 
      error: 'Delete failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 