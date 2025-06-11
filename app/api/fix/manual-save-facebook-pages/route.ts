import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';
import crypto from 'crypto';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  console.log('Manual Facebook Pages Save: Starting...');

  try {
    // Get the user's personal Facebook token
    const { data: personalAccount, error: dbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .not('account_name', 'like', '%(Page)')
      .single();

    if (dbError || !personalAccount) {
      return NextResponse.json({ 
        error: 'No personal Facebook account found',
        details: 'Please connect Facebook first',
        dbError: dbError?.message
      }, { status: 400 });
    }

    console.log('Found personal Facebook account:', personalAccount.account_name);

    // Get app secret and create appsecret_proof
    const appSecret = process.env.META_CLIENT_SECRET || process.env.FACEBOOK_CLIENT_SECRET || process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      return NextResponse.json({ error: 'Missing Facebook app secret' }, { status: 400 });
    }

    const appsecret_proof = crypto
      .createHmac('sha256', appSecret)
      .update(personalAccount.access_token)
      .digest('hex');

    console.log('Generated appsecret_proof for API calls');

    // Fetch Facebook pages - EXACT same call that works in debug
    const pagesUrl = new URL('https://graph.facebook.com/v23.0/me/accounts');
    pagesUrl.searchParams.set('fields', 'id,name,access_token,category,category_list,tasks');
    pagesUrl.searchParams.set('access_token', personalAccount.access_token);
    pagesUrl.searchParams.set('appsecret_proof', appsecret_proof);

    console.log('Fetching pages with URL:', pagesUrl.toString().replace(personalAccount.access_token, '[REDACTED]'));

    const pagesResponse = await fetch(pagesUrl.toString());
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok) {
      console.error('Facebook API error:', pagesData);
      return NextResponse.json({ 
        error: 'Facebook API error', 
        details: pagesData,
        status: pagesResponse.status
      }, { status: 400 });
    }

    console.log('Facebook API success! Found pages:', pagesData.data?.length || 0);
    console.log('Pages data:', JSON.stringify(pagesData.data, null, 2));

    const pages = pagesData.data || [];
    
    if (pages.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook pages found',
        facebook_response: pagesData,
        help: 'Your Facebook token has the right permissions, but no pages are returned by Facebook API'
      });
    }

    // Get workspace ID
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No active workspace found' }, { status: 400 });
    }

    // Save each page as a separate social account - EXACTLY like the callback does
    const savedPages: Array<{id: string, name: string, saved: boolean, error?: string}> = [];
    
    for (const page of pages) {
      console.log('Saving page:', {
        id: page.id,
        name: page.name,
        has_access_token: !!page.access_token,
        category: page.category
      });

      try {
        // Calculate expiration (60 days for page tokens)
        const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();
        
        const { error: pageError } = await supabase
          .from('social_accounts')
          .upsert({
            user_id: session.user.id,
            workspace_id: workspaceId,
            platform: 'facebook',
            access_token: page.access_token || personalAccount.access_token,
            account_id: page.id,
            account_name: `${page.name} (Page)`,
            is_connected: true,
            token_expires_at: expiresAt,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'workspace_id,platform,account_id'
          });

        if (pageError) {
          console.error('Error saving page:', page.name, pageError);
          savedPages.push({
            id: page.id,
            name: page.name,
            saved: false,
            error: pageError.message
          });
        } else {
          console.log('Successfully saved page:', page.name);
          savedPages.push({
            id: page.id,
            name: page.name,
            saved: true
          });
        }
      } catch (pageError: any) {
        console.error('Exception saving page:', page.name, pageError);
        savedPages.push({
          id: page.id,
          name: page.name,
          saved: false,
          error: pageError.message || 'Unknown error'
        });
      }
    }

    const successCount = savedPages.filter(p => p.saved).length;
    const failureCount = savedPages.filter(p => !p.saved).length;

    console.log(`Manual Facebook Pages Save: Complete! ${successCount} saved, ${failureCount} failed`);

    return NextResponse.json({
      success: true,
      message: `Successfully saved ${successCount} Facebook pages`,
      pages_found: pages.length,
      pages_saved: successCount,
      pages_failed: failureCount,
      saved_pages: savedPages,
      next_step: 'Refresh your settings page to see the Facebook business pages'
    });

  } catch (error: any) {
    console.error('Manual Facebook Pages Save error:', error);
    return NextResponse.json({ 
      error: 'Failed to save Facebook pages', 
      details: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
} 