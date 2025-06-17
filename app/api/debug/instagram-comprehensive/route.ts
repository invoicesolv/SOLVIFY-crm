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
      return NextResponse.json({ 
        success: false, 
        error: 'Unauthorized - please log in'
      }, { status: 401 });
    }

    const debugResults: {
      user_id: string;
      timestamp: string;
      tests: any[];
      facebook_accounts: any[];
      instagram_findings: any[];
      recommendations: string[];
    } = {
      user_id: session.user.id,
      timestamp: new Date().toISOString(),
      tests: [],
      facebook_accounts: [],
      instagram_findings: [],
      recommendations: []
    };

    // Get all Facebook accounts for this user
    const { data: facebookAccounts, error: fbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook')
      .order('created_at', { ascending: false });

    if (fbError) {
      debugResults.tests.push({
        test: 'Database Query',
        status: 'FAILED',
        error: fbError.message
      });
      return NextResponse.json(debugResults, { status: 500 });
    }

    debugResults.facebook_accounts = facebookAccounts.map(acc => ({
      account_id: acc.account_id,
      account_name: acc.account_name,
      created_at: acc.created_at,
      token_preview: acc.access_token ? `${acc.access_token.substring(0, 10)}...` : 'No token'
    }));

    debugResults.tests.push({
      test: 'Database Query',
      status: 'SUCCESS',
      result: `Found ${facebookAccounts.length} Facebook accounts`
    });

    if (facebookAccounts.length === 0) {
      debugResults.recommendations.push('No Facebook accounts found. Connect Facebook first.');
      return NextResponse.json(debugResults);
    }

    const appSecret = process.env.FACEBOOK_APP_SECRET;
    if (!appSecret) {
      debugResults.tests.push({
        test: 'App Secret Check',
        status: 'FAILED',
        error: 'FACEBOOK_APP_SECRET not configured'
      });
      return NextResponse.json(debugResults, { status: 500 });
    }

    // Test each Facebook account
    for (const account of facebookAccounts) {
      const accountTest: {
        account_id: string;
        account_name: string;
        tests: any[];
      } = {
        account_id: account.account_id,
        account_name: account.account_name,
        tests: []
      };

      const accessToken = account.access_token;
      const appsecretProof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');

      // Test 1: Check token validity
      try {
        const userResponse = await fetch(
          `https://graph.facebook.com/me?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );
        
        if (userResponse.ok) {
          const userData = await userResponse.json();
          accountTest.tests.push({
            test: 'Token Validity',
            status: 'SUCCESS',
            result: `Valid token for ${userData.name} (${userData.id})`
          });
        } else {
          const errorText = await userResponse.text();
          accountTest.tests.push({
            test: 'Token Validity',
            status: 'FAILED',
            error: `${userResponse.status}: ${errorText}`
          });
          continue;
        }
      } catch (error) {
        accountTest.tests.push({
          test: 'Token Validity',
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        });
        continue;
      }

      // Test 2: Check permissions
      try {
        const permResponse = await fetch(
          `https://graph.facebook.com/me/permissions?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );
        
        if (permResponse.ok) {
          const permData = await permResponse.json();
          const grantedPerms = permData.data?.filter((p: any) => p.status === 'granted').map((p: any) => p.permission) || [];
          
          const instagramPerms = grantedPerms.filter((p: string) => p.includes('instagram'));
          const pagePerms = grantedPerms.filter((p: string) => p.includes('pages'));
          
          accountTest.tests.push({
            test: 'Permissions Check',
            status: 'SUCCESS',
            result: {
              total_permissions: grantedPerms.length,
              instagram_permissions: instagramPerms,
              page_permissions: pagePerms,
              has_instagram_basic: grantedPerms.includes('instagram_basic'),
              has_pages_show_list: grantedPerms.includes('pages_show_list')
            }
          });
        }
      } catch (error) {
        accountTest.tests.push({
          test: 'Permissions Check',
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Test 3: Try to get pages (if this is a user token)
      try {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/me/accounts?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );
        
        if (pagesResponse.ok) {
          const pagesData = await pagesResponse.json();
          accountTest.tests.push({
            test: 'Pages Access',
            status: 'SUCCESS',
            result: `Found ${pagesData.data?.length || 0} pages`
          });

          // Test 4: Check each page for Instagram
          if (pagesData.data && pagesData.data.length > 0) {
            for (const page of pagesData.data) {
              try {
                const instagramResponse = await fetch(
                  `https://graph.facebook.com/${page.id}?fields=instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
                );
                
                if (instagramResponse.ok) {
                  const instagramData = await instagramResponse.json();
                  if (instagramData.instagram_business_account) {
                    debugResults.instagram_findings.push({
                      facebook_page: {
                        id: page.id,
                        name: page.name
                      },
                      instagram_account: instagramData.instagram_business_account,
                      source_account: account.account_name
                    });
                  }
                }
              } catch (error) {
                // Continue checking other pages
              }
            }
          }
        } else {
          const errorText = await pagesResponse.text();
          accountTest.tests.push({
            test: 'Pages Access',
            status: 'FAILED',
            error: `${pagesResponse.status}: ${errorText}`
          });
        }
      } catch (error) {
        accountTest.tests.push({
          test: 'Pages Access',
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      // Test 5: Direct Instagram check (if this is a page token)
      try {
        const directInstagramResponse = await fetch(
          `https://graph.facebook.com/${account.account_id}?fields=instagram_business_account{id,username,name,profile_picture_url,followers_count,media_count}&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );
        
        if (directInstagramResponse.ok) {
          const directInstagramData = await directInstagramResponse.json();
          if (directInstagramData.instagram_business_account) {
            debugResults.instagram_findings.push({
              facebook_page: {
                id: account.account_id,
                name: account.account_name
              },
              instagram_account: directInstagramData.instagram_business_account,
              source_account: account.account_name,
              method: 'direct_page_check'
            });
          }
          accountTest.tests.push({
            test: 'Direct Instagram Check',
            status: 'SUCCESS',
            result: directInstagramData.instagram_business_account ? 'Instagram account found' : 'No Instagram account'
          });
        }
      } catch (error) {
        accountTest.tests.push({
          test: 'Direct Instagram Check',
          status: 'FAILED',
          error: error instanceof Error ? error.message : String(error)
        });
      }

      debugResults.tests.push(accountTest);
    }

    // Generate recommendations
    if (debugResults.instagram_findings.length === 0) {
      debugResults.recommendations.push('No Instagram Business accounts found through any method');
      debugResults.recommendations.push('Check if your Instagram accounts are set to Business (not Personal)');
      debugResults.recommendations.push('Verify Instagram accounts are properly connected to Facebook pages');
      debugResults.recommendations.push('Try the Instagram Business OAuth flow with updated permissions');
    } else {
      debugResults.recommendations.push(`Found ${debugResults.instagram_findings.length} Instagram Business accounts!`);
      debugResults.recommendations.push('Instagram Business OAuth should work now');
    }

    return NextResponse.json(debugResults);

  } catch (error) {
    console.error('[Instagram Comprehensive Debug] Error:', error);
    return NextResponse.json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 