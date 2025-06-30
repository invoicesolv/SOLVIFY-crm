import { NextRequest, NextResponse } from 'next/server';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseClient as supabase } from '@/lib/supabase-client';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await getUserFromToken(request);
  
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  console.log('Manual Facebook pages restore starting...');

  try {
    // Get the user's personal Facebook token
    const { data: personalAccount, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .not('account_name', 'like', '%(Page)%')
      .single();

    if (dbError || !personalAccount) {
      console.error('No personal Facebook account found:', dbError);
      return NextResponse.json({ error: 'No personal Facebook account found' }, { status: 400 });
    }

    // Get app secret for appsecret_proof
    const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      console.error('Missing Facebook app secret');
      return NextResponse.json({ error: 'Missing Facebook app secret' }, { status: 500 });
    }

    // Generate appsecret_proof
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(personalAccount.access_token).digest('hex');

    // Fetch Facebook pages using personal token
    const pagesUrl = new URL('https://graph.facebook.com/v23.0/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,access_token,category,category_list,tasks');
    pagesUrl.searchParams.set('access_token', personalAccount.access_token);
    pagesUrl.searchParams.set('appsecret_proof', appsecretProof);

    console.log('Fetching Facebook pages from:', pagesUrl.toString().replace(personalAccount.access_token, '[REDACTED]'));

    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok) {
      console.error('Facebook API error:', pagesData);
      return NextResponse.json({ error: 'Facebook API error', details: pagesData }, { status: 400 });
    }

    console.log('Facebook pages response:', JSON.stringify(pagesData, null, 2));
    console.log('Raw pages data array:', pagesData.data);
    console.log('Pages array length:', pagesData.data?.length || 0);

    const pages = pagesData.data || [];
    
    if (pages.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook pages found for this account',
        debug: {
          facebook_response: pagesData,
          personal_account_id: personalAccount.account_id,
          personal_account_name: personalAccount.account_name,
          token_length: personalAccount.access_token?.length
        }
      }, { status: 400 });
    }

    // Delete existing page accounts for this user to avoid duplicates
    const { error: deleteError } = await supabase
      .from('social_accounts')
      .delete()
      .eq('user_id', user.id)
      .eq('platform', 'facebook')
      .like('account_name', '%(Page)%');

    if (deleteError) {
      console.error('Error deleting old page accounts:', deleteError);
    }

    // Save each page as a separate social account
    const savedPages: Array<{id: string, name: string, category?: string}> = [];
    for (const page of pages) {
      const pageData = {
        user_id: user.id,
        platform: 'facebook',
        account_id: page.id,
        account_name: `${page.name} (Page)`,
        access_token: page.access_token,
        refresh_token: null,
        expires_at: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(), // 60 days from now
        profile_data: {
          id: page.id,
          name: page.name,
          category: page.category,
          category_list: page.category_list,
          tasks: page.tasks
        }
      };

      const { data: savedPage, error: saveError } = await supabase
        .from('social_accounts')
        .insert(pageData)
        .single();

      if (saveError) {
        console.error(`Error saving page ${page.name}:`, saveError);
      } else {
        console.log(`✅ Saved page: ${page.name}`);
        savedPages.push({
          id: page.id,
          name: page.name,
          category: page.category
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Facebook pages restored successfully',
      pages_restored: savedPages.length,
      pages: savedPages
    });

  } catch (error) {
    console.error('Manual restore error:', error);
    return NextResponse.json({ 
      error: 'Manual restore failed', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 