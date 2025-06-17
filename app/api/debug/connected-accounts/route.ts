import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Connected Accounts] Checking connected accounts for user:', session.user.id);

    // Get all social accounts for this user
    const { data: socialAccounts, error: socialError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (socialError) {
      console.error('[Connected Accounts] Error fetching social accounts:', socialError);
      return NextResponse.json({ 
        error: 'Failed to fetch social accounts',
        details: socialError.message
      }, { status: 500 });
    }

    // Group by platform
    const accountsByPlatform = socialAccounts?.reduce((acc, account) => {
      if (!acc[account.platform]) {
        acc[account.platform] = [];
      }
      acc[account.platform].push({
        id: account.id,
        account_id: account.account_id,
        account_name: account.account_name,
        is_connected: account.is_connected,
        token_expires_at: account.token_expires_at,
        created_at: account.created_at,
        has_access_token: !!account.access_token
      });
      return acc;
    }, {} as Record<string, any[]>) || {};

    const summary = {
      total_accounts: socialAccounts?.length || 0,
      platforms: Object.keys(accountsByPlatform),
      accounts_by_platform: accountsByPlatform,
      user_id: session.user.id,
      timestamp: new Date().toISOString()
    };

    console.log('[Connected Accounts] Summary:', {
      total: summary.total_accounts,
      platforms: summary.platforms,
      facebook_accounts: accountsByPlatform.facebook?.length || 0,
      instagram_accounts: accountsByPlatform.instagram?.length || 0
    });

    return NextResponse.json({
      success: true,
      message: `Found ${summary.total_accounts} connected accounts`,
      ...summary
    });

  } catch (error) {
    console.error('[Connected Accounts] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check connected accounts',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 