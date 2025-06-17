import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - please log in'
      }, { status: 401 });
    }

    console.log('[Facebook Token Debug] Checking for Facebook integration for user:', session.user.id);
    
    // Check social_accounts table for Facebook connection
    const { data: facebookAccount, error: fbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .single();

    if (fbError || !facebookAccount) {
      return NextResponse.json({
        success: false,
        error: 'No Facebook connection found',
        message: 'Please connect Facebook first at /settings',
        debug: {
          error: fbError?.message,
          userId: session.user.id
        }
      }, { status: 404 });
    }

    // Return the token info (be careful with this in production!)
    return NextResponse.json({
      success: true,
      message: 'Facebook token found!',
      data: {
        platform: facebookAccount.platform,
        account_id: facebookAccount.account_id,
        account_name: facebookAccount.account_name,
        is_connected: facebookAccount.is_connected,
        token_expires_at: facebookAccount.token_expires_at,
        created_at: facebookAccount.created_at,
        // Show first/last 10 chars of token for security
        access_token_preview: facebookAccount.access_token 
          ? `${facebookAccount.access_token.substring(0, 10)}...${facebookAccount.access_token.substring(facebookAccount.access_token.length - 10)}`
          : 'No token',
        // Full token for debugging (REMOVE IN PRODUCTION!)
        full_access_token: facebookAccount.access_token
      },
      curl_examples: {
        test_token: `curl "https://graph.facebook.com/me?access_token=${facebookAccount.access_token}"`,
        get_pages: `curl "https://graph.facebook.com/me/accounts?access_token=${facebookAccount.access_token}"`,
        get_instagram_accounts: `curl "https://graph.facebook.com/me/accounts?fields=id,name,instagram_business_account&access_token=${facebookAccount.access_token}"`
      }
    });

  } catch (error) {
    console.error('[Facebook Token Debug] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 