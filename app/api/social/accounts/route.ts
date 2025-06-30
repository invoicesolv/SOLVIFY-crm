import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get workspace ID
    let workspaceId = null;
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL}/api/workspace/leave`);
      if (response.ok) {
        const data = await response.json();
        const workspaces = data.workspaces || [];
        if (workspaces.length > 0) {
          workspaceId = workspaces[0].id;
        }
      }
    } catch (error) {
      console.error('Error getting workspace ID:', error);
    }

    // Query social_accounts table
    let socialAccountsQuery = supabaseAdmin
      .from('social_accounts')
      .select(`
        id,
        platform,
        account_name,
        account_id,
        is_connected,
        followers_count,
        engagement_rate,
        last_post_date,
        created_at,
        updated_at,
        token_expires_at
      `);

    // Use workspace_id if available, otherwise fallback to user_id
    if (workspaceId) {
      socialAccountsQuery = socialAccountsQuery.eq('workspace_id', workspaceId);
    } else {
      socialAccountsQuery = socialAccountsQuery.eq('user_id', user.id);
    }

    const { data: socialAccounts, error: socialError } = await socialAccountsQuery
      .eq('is_connected', true)
      .order('created_at', { ascending: false });

    if (socialError) {
      console.error('Error fetching social accounts:', socialError);
      return NextResponse.json({ 
        error: 'Failed to fetch social accounts',
        details: socialError.message
      }, { status: 500 });
    }

    // Also check for YouTube connection in integrations table
    const { data: youtubeIntegration, error: youtubeError } = await supabaseAdmin
      .from('integrations')
      .select('service_name, created_at, metadata')
      .eq('user_id', user.id)
      .eq('service_name', 'youtube')
      .single();

    let youtubeAccount: any = null;
    if (!youtubeError && youtubeIntegration) {
      youtubeAccount = {
        id: 'youtube-integration',
        platform: 'youtube',
        account_name: 'YouTube Account',
        account_id: 'youtube',
        is_connected: true,
        followers_count: 0,
        engagement_rate: 0,
        created_at: youtubeIntegration.created_at,
        additional_info: youtubeIntegration.metadata || {},
        platform_display_name: 'YouTube',
        account_type: 'Channel',
        is_page: false,
        page_category: null
      };
    }

    // Process social accounts
    const processedAccounts = socialAccounts?.map(account => {
      return {
        ...account,
        additional_info: null,
        platform_display_name: getPlatformDisplayName(account.platform),
        account_type: getAccountType(account, null),
        is_page: account.account_name.includes('(Page)') || false,
        page_category: null
      };
    }) || [];

    // Add YouTube if connected
    const allAccounts = [...processedAccounts];
    if (youtubeAccount) {
      allAccounts.push(youtubeAccount);
    }

    // Group accounts by platform
    const accountsByPlatform = allAccounts.reduce((acc, account) => {
      if (!acc[account.platform]) {
        acc[account.platform] = [];
      }
      acc[account.platform].push(account);
      return acc;
    }, {} as Record<string, any[]>);

    // Generate summary statistics
    const summary = {
      total_accounts: allAccounts.length,
      platforms_connected: Object.keys(accountsByPlatform),
      platform_counts: Object.entries(accountsByPlatform).reduce((acc, [platform, accounts]) => {
        acc[platform] = (accounts as any[]).length;
        return acc;
      }, {} as Record<string, number>),
      last_updated: new Date().toISOString()
    };

    return NextResponse.json({
      success: true,
      summary,
      accounts: allAccounts,
      accounts_by_platform: accountsByPlatform,
      user_id: user.id,
      workspace_id: workspaceId
    });

  } catch (error) {
    console.error('Error in social accounts API:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Helper functions
function getPlatformDisplayName(platform: string): string {
  const platformNames: Record<string, string> = {
    'facebook': 'Facebook',
    'instagram': 'Instagram',
    'threads': 'Threads',
    'linkedin': 'LinkedIn', 
    'x': 'X (Twitter)',
    'twitter': 'X (Twitter)',
    'tiktok': 'TikTok',
    'youtube': 'YouTube'
  };
  
  return platformNames[platform] || platform.charAt(0).toUpperCase() + platform.slice(1);
}

function getAccountType(account: any, additionalInfo: any): string {
  if (additionalInfo?.is_page) {
    return 'Page';
  }
  
  if (account.platform === 'instagram' && account.account_name.includes('(Page)')) {
    return 'Business Account';
  }
  
  if (account.platform === 'linkedin') {
    return 'Professional Account';
  }
  
  return 'Personal Account';
} 