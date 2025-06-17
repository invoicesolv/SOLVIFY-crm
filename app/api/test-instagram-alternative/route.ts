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

    console.log('[Alternative Instagram] Starting alternative Instagram discovery for user:', session.user.id);

    // Get existing Facebook accounts from social_accounts table
    const { data: facebookAccounts, error: fbError } = await supabase
      .from('social_accounts')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('platform', 'facebook');

    if (fbError || !facebookAccounts || facebookAccounts.length === 0) {
      return NextResponse.json({ 
        error: 'No Facebook account found',
        details: fbError?.message 
      }, { status: 404 });
    }

    const fbAccount = facebookAccounts[0];
    const accessToken = fbAccount.access_token;
    const appSecret = process.env.FACEBOOK_APP_SECRET!;
    const appsecretProof = crypto.createHmac('sha256', appSecret).update(accessToken).digest('hex');

    console.log('[Alternative Instagram] Using Facebook token to try alternative Instagram discovery methods');

    const results: any = {
      methods_tried: [],
      instagram_accounts: [],
      debug_info: {}
    };

    // Method 1: Try direct Instagram accounts endpoint
    console.log('[Alternative Instagram] Method 1: Direct Instagram accounts endpoint');
    try {
      const directInstagramResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/instagram_accounts?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      
      const directInstagramData = await directInstagramResponse.json();
      results.methods_tried.push({
        method: 'Direct Instagram Accounts',
        status: directInstagramResponse.status,
        success: directInstagramResponse.ok,
        data: directInstagramData
      });

      if (directInstagramResponse.ok && directInstagramData.data) {
        for (const igAccount of directInstagramData.data) {
          console.log('[Alternative Instagram] Found direct Instagram account:', igAccount.id);
          results.instagram_accounts.push({
            id: igAccount.id,
            source: 'direct_instagram_accounts',
            raw_data: igAccount
          });
        }
      }
    } catch (error) {
      results.methods_tried.push({
        method: 'Direct Instagram Accounts',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Method 2: Try pages with different field combinations
    console.log('[Alternative Instagram] Method 2: Pages with different field combinations');
    const fieldCombinations = [
      'id,name,instagram_business_account',
      'id,name,instagram_business_account{id,username}',
      'id,name,connected_instagram_account',
      'id,name,instagram_accounts',
      'id,name,accounts'
    ];

    for (const fields of fieldCombinations) {
      try {
        const pagesResponse = await fetch(
          `https://graph.facebook.com/v18.0/me/accounts?fields=${encodeURIComponent(fields)}&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
        );
        
        const pagesData = await pagesResponse.json();
        results.methods_tried.push({
          method: `Pages with fields: ${fields}`,
          status: pagesResponse.status,
          success: pagesResponse.ok,
          data: pagesData,
          pages_count: pagesData.data?.length || 0
        });

        if (pagesResponse.ok && pagesData.data) {
          for (const page of pagesData.data) {
            // Check for any Instagram-related fields
            const instagramFields = Object.keys(page).filter(key => 
              key.toLowerCase().includes('instagram')
            );
            
            if (instagramFields.length > 0) {
              console.log('[Alternative Instagram] Found Instagram fields on page:', page.name, instagramFields);
              results.instagram_accounts.push({
                page_id: page.id,
                page_name: page.name,
                instagram_fields: instagramFields,
                source: `pages_${fields}`,
                raw_data: page
              });
            }
          }
        }
      } catch (error) {
        results.methods_tried.push({
          method: `Pages with fields: ${fields}`,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    // Method 3: Try individual page inspection for each page
    console.log('[Alternative Instagram] Method 3: Individual page inspection');
    try {
      const basicPagesResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/accounts?fields=id,name,access_token&access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      
      if (basicPagesResponse.ok) {
        const basicPagesData = await basicPagesResponse.json();
        const pages = basicPagesData.data || [];
        
        for (const page of pages) {
          console.log('[Alternative Instagram] Inspecting page:', page.name);
          
          // Use page access token if available
          let pageToken = page.access_token || accessToken;
          let pageProof = crypto.createHmac('sha256', appSecret).update(pageToken).digest('hex');
          
          // Try to get Instagram account directly from page
          try {
            const pageInstagramResponse = await fetch(
              `https://graph.facebook.com/v18.0/${page.id}?fields=instagram_business_account,instagram_accounts&access_token=${pageToken}&appsecret_proof=${pageProof}`
            );
            
            const pageInstagramData = await pageInstagramResponse.json();
            results.methods_tried.push({
              method: `Individual page inspection: ${page.name}`,
              status: pageInstagramResponse.status,
              success: pageInstagramResponse.ok,
              data: pageInstagramData
            });

            if (pageInstagramResponse.ok) {
              if (pageInstagramData.instagram_business_account) {
                console.log('[Alternative Instagram] Found Instagram business account on page:', page.name);
                results.instagram_accounts.push({
                  page_id: page.id,
                  page_name: page.name,
                  instagram_account: pageInstagramData.instagram_business_account,
                  source: 'individual_page_inspection',
                  raw_data: pageInstagramData
                });
              }
              
              if (pageInstagramData.instagram_accounts) {
                console.log('[Alternative Instagram] Found Instagram accounts on page:', page.name);
                results.instagram_accounts.push({
                  page_id: page.id,
                  page_name: page.name,
                  instagram_accounts: pageInstagramData.instagram_accounts,
                  source: 'individual_page_inspection',
                  raw_data: pageInstagramData
                });
              }
            }
          } catch (error) {
            results.methods_tried.push({
              method: `Individual page inspection: ${page.name}`,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    } catch (error) {
      results.methods_tried.push({
        method: 'Individual page inspection',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    // Method 4: Try Business Manager approach
    console.log('[Alternative Instagram] Method 4: Business Manager approach');
    try {
      const businessResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
      );
      
      const businessData = await businessResponse.json();
      results.methods_tried.push({
        method: 'Business Manager',
        status: businessResponse.status,
        success: businessResponse.ok,
        data: businessData
      });

      if (businessResponse.ok && businessData.data) {
        for (const business of businessData.data) {
          try {
            const businessInstagramResponse = await fetch(
              `https://graph.facebook.com/v18.0/${business.id}/instagram_accounts?access_token=${accessToken}&appsecret_proof=${appsecretProof}`
            );
            
            const businessInstagramData = await businessInstagramResponse.json();
            results.methods_tried.push({
              method: `Business Instagram accounts: ${business.name}`,
              status: businessInstagramResponse.status,
              success: businessInstagramResponse.ok,
              data: businessInstagramData
            });

            if (businessInstagramResponse.ok && businessInstagramData.data) {
              for (const igAccount of businessInstagramData.data) {
                console.log('[Alternative Instagram] Found Instagram account via business:', igAccount.id);
                results.instagram_accounts.push({
                  business_id: business.id,
                  business_name: business.name,
                  instagram_account: igAccount,
                  source: 'business_manager',
                  raw_data: igAccount
                });
              }
            }
          } catch (error) {
            results.methods_tried.push({
              method: `Business Instagram accounts: ${business.name}`,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
    } catch (error) {
      results.methods_tried.push({
        method: 'Business Manager',
        error: error instanceof Error ? error.message : String(error)
      });
    }

    return NextResponse.json({
      success: true,
      message: `Alternative Instagram discovery completed. Found ${results.instagram_accounts.length} potential Instagram accounts.`,
      results,
      debug: {
        userId: session.user.id,
        facebookAccountId: fbAccount.id,
        timestamp: new Date().toISOString(),
        methods_tried_count: results.methods_tried.length
      }
    });

  } catch (error) {
    console.error('[Alternative Instagram] Error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
} 