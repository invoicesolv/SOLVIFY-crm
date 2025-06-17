import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[Facebook Config Test] Starting test for user:', session.user.id);

    // Get existing Facebook accounts from social_accounts table
    const { data: facebookAccounts, error: fbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook');

    if (fbError) {
      return NextResponse.json({ 
        error: 'Database error',
        details: fbError.message 
      }, { status: 500 });
    }

    if (!facebookAccounts || facebookAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook account found',
        message: 'Please connect your Facebook account first'
      }, { status: 404 });
    }

    const fbAccount = facebookAccounts[0];
    const accessToken = fbAccount.access_token;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;

    // Generate appsecret_proof
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');

    const results = {
      success: true,
      message: `Testing Facebook account: ${fbAccount.name}`,
      facebookAccounts: facebookAccounts.map(acc => ({
        id: acc.account_id,
        name: acc.name,
        access_token: acc.access_token ? `${acc.access_token.substring(0, 20)}...` : null,
        created_at: acc.created_at
      })),
      tests: [] as any[],
      permissions: [] as string[]
    };

    // Test 1: Check token validity and permissions
    try {
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v23.0/me?fields=id,name&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      const tokenData = await tokenResponse.json();

      if (tokenResponse.ok) {
        results.tests.push({
          test: 'Token Validity',
          status: 'SUCCESS',
          result: `Valid token for ${tokenData.name} (${tokenData.id})`
        });

        // Test 2: Check permissions
        const permissionsResponse = await fetch(
          `https://graph.facebook.com/v23.0/me/permissions?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );
        const permissionsData = await permissionsResponse.json();

        if (permissionsResponse.ok && permissionsData.data) {
          const grantedPermissions = permissionsData.data
            .filter((perm: any) => perm.status === 'granted')
            .map((perm: any) => perm.permission);

          results.permissions = grantedPermissions;
          results.tests.push({
            test: 'Permissions Check',
            status: 'SUCCESS',
            result: `Found ${grantedPermissions.length} granted permissions`,
            permissions: grantedPermissions
          });

          // Check for Instagram-specific permissions
          const instagramPermissions = grantedPermissions.filter((perm: string) => 
            perm.includes('instagram') || perm.includes('pages_')
          );

          results.tests.push({
            test: 'Instagram Permissions',
            status: instagramPermissions.length > 0 ? 'SUCCESS' : 'WARNING',
            result: `Found ${instagramPermissions.length} Instagram-related permissions`,
            permissions: instagramPermissions
          });

        } else {
          results.tests.push({
            test: 'Permissions Check',
            status: 'FAILED',
            error: permissionsData.error?.message || 'Failed to fetch permissions'
          });
        }

        // Test 3: Check Facebook pages
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v23.0/me/accounts?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );
        const pagesData = await pagesResponse.json();

        if (pagesResponse.ok && pagesData.data) {
          results.tests.push({
            test: 'Facebook Pages',
            status: 'SUCCESS',
            result: `Found ${pagesData.data.length} Facebook pages`,
            pages: pagesData.data.map((page: any) => ({
              id: page.id,
              name: page.name,
              access_token: page.access_token ? `${page.access_token.substring(0, 20)}...` : null
            }))
          });
        } else {
          results.tests.push({
            test: 'Facebook Pages',
            status: 'FAILED',
            error: pagesData.error?.message || 'Failed to fetch pages'
          });
        }

      } else {
        results.tests.push({
          test: 'Token Validity',
          status: 'FAILED',
          error: tokenData.error?.message || 'Invalid token'
        });
      }

    } catch (error) {
      results.tests.push({
        test: 'API Request',
        status: 'FAILED',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return NextResponse.json(results);

  } catch (error) {
    console.error('[Facebook Config Test] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to test Facebook configuration',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 