import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { createClient } from '@supabase/supabase-js';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// LinkedIn OAuth callback
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    console.error('LinkedIn OAuth callback: No user session found');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/login`));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('LinkedIn OAuth error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=linkedin_auth_failed`));
  }

  if (!code) {
    console.error('LinkedIn OAuth callback: No authorization code received');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=no_code`));
  }

  try {
    console.log('LinkedIn OAuth: Exchanging code for access token');
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/linkedin/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('LinkedIn OAuth: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('LinkedIn OAuth token error:', tokenData);
      throw new Error(tokenData.error_description || 'Failed to exchange code for token');
    }

    console.log('LinkedIn OAuth: Successfully received access token');

    // Fetch user profile information
    const profileResponse = await fetch('https://api.linkedin.com/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
      },
    });

    const profileData = await profileResponse.json();
    console.log('LinkedIn OAuth: Profile response status:', profileResponse.status);

    if (!profileResponse.ok) {
      console.error('LinkedIn OAuth profile error:', profileData);
      throw new Error('Failed to fetch user profile');
    }

    console.log('LinkedIn OAuth: User profile data:', {
      id: profileData.sub,
      name: profileData.name,
      email: profileData.email
    });

    // Get workspace ID for the user
    console.log('LinkedIn OAuth: Looking up workspace for user:', session.user.id);
    
    // Create admin client for database operations
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get workspace ID for the user (use same logic as UI - exclude deleted workspaces)
    const { data: allWorkspaces, error: workspaceError } = await supabase
      .from('team_members')
      .select('workspace_id, role')
      .eq('user_id', session.user.id)
      .neq('workspace_id', '4251bc40-5a36-493a-9f85-eb728c4d86fa') // Exclude deleted workspace
      .order('role', { ascending: true }) // admin comes before member
      .order('created_at', { ascending: false }); // most recent first

    if (workspaceError) {
      console.error('LinkedIn OAuth: Workspace lookup error:', workspaceError);
      throw new Error(`Failed to find workspace for user: ${workspaceError.message}`);
    }

    if (!allWorkspaces || allWorkspaces.length === 0) {
      console.error('LinkedIn OAuth: No workspace found for user:', session.user.id);
      throw new Error('User is not a member of any workspace');
    }

    // Use the first workspace (prioritized by admin role, then most recent)
    const workspaceData = allWorkspaces[0];
    const workspaceId = workspaceData?.workspace_id;
    console.log('LinkedIn OAuth: Workspace ID found:', workspaceId, '(admin:', workspaceData?.role === 'admin', ')');
    console.log('LinkedIn OAuth: Available workspaces:', allWorkspaces.length);

    // Save LinkedIn connection to database
    const { data: saveData, error: saveError } = await supabase
      .from('social_accounts')
      .upsert({
        user_id: session.user.id,
        workspace_id: workspaceId,
        platform: 'linkedin',
        access_token: tokenData.access_token,
        account_id: profileData.sub,
        account_name: profileData.name || profileData.email,
        display_name: profileData.name,
        is_connected: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'workspace_id,platform,account_id'
      })
      .select();

    if (saveError) {
      console.error('LinkedIn OAuth: Database save error:', saveError);
      throw new Error(`Failed to save LinkedIn connection: ${saveError.message}`);
    }

    console.log('LinkedIn OAuth: Database save successful');
    console.log('LinkedIn OAuth: Saved data:', saveData);
    
    // NOTE: Organization/company page fetching is commented out because it requires 
    // the 'r_organization_admin' scope which needs special LinkedIn approval
    // Uncomment this section once you get LinkedIn approval for organization access
    
    /*
    // Now fetch LinkedIn organizations/company pages that the user manages
    console.log('🔵 [LINKEDIN OAUTH] Attempting to fetch LinkedIn organizations user manages');
    
    try {
      // Use LinkedIn organizationAcls API to find organizations user has ADMINISTRATOR role for
      const organizationsResponse = await fetch(
        'https://api.linkedin.com/rest/organizationAcls?q=roleAssignee&role=ADMINISTRATOR&state=APPROVED',
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'X-Restli-Protocol-Version': '2.0.0',
            'LinkedIn-Version': '202501'
          }
        }
      );

      console.log('🔵 [LINKEDIN OAUTH] Organizations API response status:', organizationsResponse.status);
      
      if (organizationsResponse.ok) {
        const organizationsData = await organizationsResponse.json();
        console.log('🟢 [LINKEDIN OAUTH] Found', organizationsData.elements?.length || 0, 'LinkedIn organizations');
        console.log('🔵 [LINKEDIN OAUTH] Organizations data:', JSON.stringify(organizationsData, null, 2));
        
        if (organizationsData.elements && organizationsData.elements.length > 0) {
          // For each organization, fetch detailed info and save as separate account
          for (const orgAcl of organizationsData.elements) {
            const organizationUrn = orgAcl.organization || orgAcl.organizationTarget;
            if (!organizationUrn) continue;
            
            // Extract organization ID from URN (urn:li:organization:12345)
            const orgIdMatch = organizationUrn.match(/urn:li:organization:(\d+)/);
            if (!orgIdMatch) continue;
            
            const orgId = orgIdMatch[1];
            
            try {
              // Fetch organization details
              const orgDetailsResponse = await fetch(
                `https://api.linkedin.com/rest/organizations/${orgId}`,
                {
                  method: 'GET',
                  headers: {
                    'Authorization': `Bearer ${tokenData.access_token}`,
                    'X-Restli-Protocol-Version': '2.0.0',
                    'LinkedIn-Version': '202501'
                  }
                }
              );
              
              if (orgDetailsResponse.ok) {
                const orgDetails = await orgDetailsResponse.json();
                console.log('🔵 [LINKEDIN OAUTH] Processing organization:', {
                  id: orgDetails.id,
                  name: orgDetails.localizedName || orgDetails.name?.localized?.en_US,
                  vanityName: orgDetails.vanityName
                });
                
                // Save organization as separate LinkedIn account
                const { data: orgInsertData, error: orgError } = await supabase
                  .from('social_accounts')
                  .upsert({
                    user_id: session.user.id,
                    workspace_id: workspaceId,
                    platform: 'linkedin',
                    access_token: tokenData.access_token, // Use same token for organizations
                    account_id: orgDetails.id.toString(),
                    account_name: `${orgDetails.localizedName || orgDetails.name?.localized?.en_US} (Company)`,
                    display_name: orgDetails.localizedName || orgDetails.name?.localized?.en_US,
                    is_connected: true,
                    token_expires_at: tokenData.expires_at,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                  }, {
                    onConflict: 'workspace_id,platform,account_id'
                  })
                  .select();

                if (orgError) {
                  console.error('🔴 [LINKEDIN OAUTH] Error saving organization:', orgDetails.localizedName, orgError);
                } else {
                  console.log('🟢 [LINKEDIN OAUTH] Successfully saved organization:', orgDetails.localizedName);
                }
              } else {
                console.error('🔴 [LINKEDIN OAUTH] Failed to fetch organization details for:', orgId);
              }
            } catch (orgError) {
              console.error('🔴 [LINKEDIN OAUTH] Error processing organization:', orgId, orgError);
            }
          }
        } else {
          console.log('🟡 [LINKEDIN OAUTH] No LinkedIn organizations found for this user');
        }
      } else {
        const errorText = await organizationsResponse.text();
        console.error('🔴 [LINKEDIN OAUTH] Organizations API error:', organizationsResponse.status, errorText);
      }
    } catch (error) {
      console.error('🔴 [LINKEDIN OAUTH] Error fetching LinkedIn organizations:', error);
    }
    */
    
    console.log('LinkedIn OAuth: Redirecting to settings with success');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?success=linkedin_connected`));
  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=linkedin_auth_failed`));
  }
} 