import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { getActiveWorkspaceId } from '@/lib/permission';
import crypto from 'crypto';

export async function GET(request: NextRequest) {
  console.log('🔍 Debug: Facebook pages endpoint called');
  
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    // Get workspace ID
    const workspaceId = await getActiveWorkspaceId(session.user.id);
    if (!workspaceId) {
      return NextResponse.json({ error: 'No workspace found' }, { status: 404 });
    }

    // Get Facebook access token from database
    const { data: facebookAccount, error } = await supabase
      .from('social_accounts')
      .select('access_token, account_id, account_name')
      .eq('workspace_id', workspaceId)
      .eq('platform', 'facebook')
      .eq('is_connected', true);

    if (error || !facebookAccount || facebookAccount.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook account connected',
        debug: { workspaceId, facebookAccounts: facebookAccount }
      }, { status: 404 });
    }

    console.log('🔍 Found Facebook accounts:', facebookAccount.length);

    // Use the first Facebook account token to fetch pages
    const userToken = facebookAccount[0].access_token;

    // Generate appsecret_proof for Facebook API security requirement
    const clientSecret = process.env.FACEBOOK_CLIENT_SECRET || 
                         process.env.META_CLIENT_SECRET || 
                         process.env.FACEBOOK_APP_SECRET;
                         
    if (!clientSecret) {
      return NextResponse.json({
        error: 'Facebook client secret not configured',
        debug: 'Missing FACEBOOK_CLIENT_SECRET, META_CLIENT_SECRET, or FACEBOOK_APP_SECRET'
      }, { status: 500 });
    }

    const appsecret_proof = crypto.createHmac('sha256', clientSecret).update(userToken).digest('hex');

    // Test the token by getting user info first
    console.log('🔍 Testing user token...');
    const userResponse = await fetch(`https://graph.facebook.com/me?access_token=${userToken}&appsecret_proof=${appsecret_proof}`);
    const userData = await userResponse.json();
    
    if (!userResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to validate user token',
        details: userData
      }, { status: 400 });
    }

    console.log('🔍 User token valid for:', userData.name);

    // Check permissions
    console.log('🔍 Checking permissions...');
    const permissionsResponse = await fetch(`https://graph.facebook.com/me/permissions?access_token=${userToken}&appsecret_proof=${appsecret_proof}`);
    const permissionsData = await permissionsResponse.json();
    
    const grantedPermissions = permissionsData.data?.filter((perm: any) => perm.status === 'granted').map((perm: any) => perm.permission) || [];
    console.log('🔍 Granted permissions:', grantedPermissions);

    // Fetch pages with all fields
    console.log('🔍 Fetching Facebook pages...');
    const pagesResponse = await fetch(`https://graph.facebook.com/me/accounts?fields=id,name,access_token,category,link&access_token=${userToken}&appsecret_proof=${appsecret_proof}`);
    const pagesData = await pagesResponse.json();

    if (!pagesResponse.ok) {
      return NextResponse.json({ 
        error: 'Failed to fetch pages',
        details: pagesData,
        permissions: grantedPermissions
      }, { status: 400 });
    }

    console.log('🔍 Facebook pages response:', JSON.stringify(pagesData, null, 2));

    return NextResponse.json({
      success: true,
      userInfo: userData,
      permissions: grantedPermissions,
      pagesCount: pagesData.data?.length || 0,
      pages: pagesData.data?.map((page: any) => ({
        id: page.id,
        name: page.name,
        category: page.category,
        hasAccessToken: !!page.access_token,
        link: page.link
      })) || [],
      rawPagesData: pagesData,
      connectedAccounts: facebookAccount
    });

  } catch (error: any) {
    console.error('🔍 Debug error:', error);
    return NextResponse.json({ 
      error: 'Debug failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
} 