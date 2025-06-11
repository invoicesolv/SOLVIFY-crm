import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';
import { getActiveWorkspaceId } from '@/lib/permission';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Test 1: Check if we can get workspace ID
    console.log('Test 1: Getting workspace ID for user:', session.user.id);
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    console.log('Test 1 result - workspace ID:', workspaceId);
    
    if (!workspaceId) {
      return NextResponse.json({ 
        error: 'No active workspace found for user',
        step: 'workspace_id_check',
        user_id: session.user.id
      }, { status: 400 });
    }

    // Test 2: Try to save a test Facebook account
    console.log('Test 2: Attempting to save test Facebook account');
    const testAccount = {
      user_id: session.user.id,
      workspace_id: workspaceId,
      platform: 'facebook',
      access_token: 'test_token_123',
      account_id: 'test_facebook_id_123',
      account_name: 'Test Facebook Account',
      is_connected: true,
      token_expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    console.log('Test 2: Saving account data:', JSON.stringify(testAccount, null, 2));

    const { data: insertData, error: dbError } = await supabase
      .from('social_accounts')
      .upsert(testAccount, {
        onConflict: 'workspace_id,platform,account_id'
      })
      .select();

    if (dbError) {
      console.error('Test 2 error:', dbError);
      return NextResponse.json({ 
        error: 'Database save failed',
        step: 'database_save_test',
        db_error: dbError,
        account_data: testAccount
      }, { status: 500 });
    }

    console.log('Test 2 success - inserted data:', insertData);

    // Test 3: Verify the account was saved
    console.log('Test 3: Verifying account was saved');
    const { data: savedAccount, error: fetchError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('account_id', 'test_facebook_id_123')
      .single();

    if (fetchError) {
      console.error('Test 3 error:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to verify saved account',
        step: 'account_verification',
        fetch_error: fetchError
      }, { status: 500 });
    }

    console.log('Test 3 success - found saved account:', savedAccount);

    // Test 4: Clean up test account
    console.log('Test 4: Cleaning up test account');
    const { error: deleteError } = await supabase
      .from('social_accounts')
      .delete()
      .eq('account_id', 'test_facebook_id_123');

    if (deleteError) {
      console.warn('Test 4 warning - cleanup failed:', deleteError);
    }

    return NextResponse.json({ 
      success: true,
      message: 'All tests passed - OAuth callback should work correctly',
      test_results: {
        workspace_id: workspaceId,
        account_saved: !!insertData,
        account_verified: !!savedAccount,
        cleanup_success: !deleteError
      }
    });

  } catch (error: any) {
    console.error('OAuth test error:', error);
    return NextResponse.json({ 
      error: 'Test failed with exception',
      step: 'exception_caught',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 