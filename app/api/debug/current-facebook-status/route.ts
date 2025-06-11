import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get all social accounts for this user
    const { data: allAccounts, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false });

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Database error', details: dbError }, { status: 500 });
    }

    // Filter Facebook accounts
    const facebookAccounts = allAccounts?.filter(acc => acc.platform === 'facebook') || [];
    
    // Count by type
    const personalAccounts = facebookAccounts.filter(acc => !acc.account_name.includes('(Page)'));
    const pageAccounts = facebookAccounts.filter(acc => acc.account_name.includes('(Page)'));

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      user_id: session.user.id,
      summary: {
        totalAccounts: allAccounts?.length || 0,
        facebookAccounts: facebookAccounts.length,
        personalAccounts: personalAccounts.length,
        pageAccounts: pageAccounts.length
      },
      facebook_accounts: facebookAccounts.map(acc => ({
        id: acc.id,
        account_id: acc.account_id,
        account_name: acc.account_name,
        platform: acc.platform,
        created_at: acc.created_at,
        expires_at: acc.expires_at,
        token_length: acc.access_token?.length || 0
      })),
      all_platforms: allAccounts?.map(acc => acc.platform).filter((v, i, a) => a.indexOf(v) === i) || []
    });

  } catch (error) {
    console.error('Debug error:', error);
    return NextResponse.json({ 
      error: 'Debug failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 