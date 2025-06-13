import NextAuth, { AuthOptions, Session, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import FacebookProvider from "next-auth/providers/facebook";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase, supabaseAdmin, isValidUUID } from "@/lib/supabase";
import { JWT } from "next-auth/jwt";
import { syncSupabaseSession } from "@/lib/supabase";

interface GoogleProfile {
  email: string;
  sub: string;
  name?: string;
  picture?: string;
}

// Extend the Session type to include supabaseAccessToken
interface ExtendedSession extends Session {
  supabaseAccessToken?: string;
}

const authOptions: AuthOptions = {
  providers: [
    // Facebook OAuth is handled by custom /api/oauth/facebook route
    // to support business page management and social account storage
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          response_type: "code",
          prompt: "consent",
          included_granted_scopes: true,
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.readonly',
            'https://www.googleapis.com/auth/analytics',
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/analytics.edit',
            'https://www.googleapis.com/auth/analytics.manage.users',
            'https://www.googleapis.com/auth/analytics.manage.users.readonly',
            'https://www.googleapis.com/auth/webmasters',
            'https://www.googleapis.com/auth/webmasters.readonly',
            'https://www.googleapis.com/auth/drive.file',
            'https://www.googleapis.com/auth/drive.appdata',
            'https://www.googleapis.com/auth/drive.readonly',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/gmail.send',
            'https://www.googleapis.com/auth/gmail.compose',
            'https://www.googleapis.com/auth/gmail.modify',
            'https://www.googleapis.com/auth/gmail.settings.basic',
            'https://www.googleapis.com/auth/gmail.labels',
            'https://www.googleapis.com/auth/youtube',
            'https://www.googleapis.com/auth/youtube.upload',
            'https://www.googleapis.com/auth/youtube.readonly',
            'https://www.googleapis.com/auth/youtube.force-ssl'
          ].join(' ')
        }
      }
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.error("[Auth] Missing credentials");
          throw new Error("Missing credentials");
        }

        // Try to authenticate with Supabase first
        try {
          
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error) {
            console.error(`[Auth] Supabase auth error: ${error.message}`);
            console.error(`[Auth] Error details:`, error);
            throw new Error(error.message);
          }

          if (!data.user || !data.session) {
            console.error(`[Auth] Invalid credentials: no user or session returned`);
            console.error(`[Auth] Data received:`, data);
            throw new Error("Invalid credentials");
          }
          

          return {
            id: data.user.id,
            email: data.user.email,
            name: data.user.user_metadata?.name || data.user.email,
            access_token: data.session.access_token,
            refresh_token: data.session.refresh_token,
          };
        } catch (e) {
          console.error(`[Auth] Authentication error:`, e);
          // Return null on error to prevent NextAuth from throwing
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async redirect({ url, baseUrl }) {
      // Redirect to dashboard after successful login
      if (url === baseUrl || url === `${baseUrl}/`) {
        return `${baseUrl}/dashboard`;
      }
      // Allow relative callback URLs
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`;
      }
      // Allow callback URLs on the same origin
      if (new URL(url).origin === baseUrl) {
        return url;
      }
      return `${baseUrl}/dashboard`;
    },
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      
      try {
        
        // Special handling for Google OAuth using our mapping table
        if (account?.provider === 'google') {
          
          // Check our mapping table first
          const { data: mappedUser, error: mappingError } = await supabase
            .from('oauth_provider_mapping')
            .select('user_uuid')
            .eq('provider_id', user.id)
            .eq('provider_name', 'google')
            .single();
            
          if (mappedUser && mappedUser.user_uuid) {
            // We found a mapping, override the ID immediately
            const originalGoogleId = user.id;
            user.id = mappedUser.user_uuid;
            
            // Store original ID for reference
            (user as any).originalGoogleId = originalGoogleId;
            
            // Continue with normal flow using the mapped UUID
          } else if (mappingError && mappingError.code !== 'PGRST116') {
          } else {
            
            // No special cases for specific emails - all users handled the same way
          }
        }
        
        // Look up user by email first, but handle the case of multiple profiles with same email
        let existingUserByEmail: any = null;
        let emailFindError: any = null;
        
        try {
          // First try the standard single() query to get a profile
          const singleResult = await supabase
          .from('profiles')
          .select('id, email, user_id')
          .eq('email', user.email)
          .single();
            
          existingUserByEmail = singleResult.data;
          emailFindError = singleResult.error;
          
          // If we get an error that might indicate multiple rows, try a different approach
          if (emailFindError && emailFindError.message && 
              emailFindError.message.includes('multiple (or no) rows returned')) {
            
            // Get all profiles with this email
            const { data: allProfiles, error: allProfilesError } = await supabase
              .from('profiles')
              .select('id, email, user_id')
              .eq('email', user.email);
            
            if (allProfilesError) {
              console.error("[Auth] Error querying all profiles:", allProfilesError);
            } else if (allProfiles && allProfiles.length > 0) {
              
              // Look for a valid UUID profile
              const validUuidProfile = allProfiles.find(p => isValidUUID(p.id));
              
              if (validUuidProfile) {
                existingUserByEmail = validUuidProfile;
                emailFindError = null;
              } else {
                // Otherwise use the first valid UUID profile
                const validUuidProfile = allProfiles.find(p => isValidUUID(p.id));
                
                if (validUuidProfile) {
                  existingUserByEmail = validUuidProfile;
                  emailFindError = null;
                } else {
                }
              }
            }
          }
        } catch (e) {
          console.error("[Auth] Error during profile lookup:", e);
        }

        if (emailFindError && emailFindError.code !== 'PGRST116') {
        }
        
        // CRITICAL: User exists with this email but is using Google sign-in
        // ALWAYS use the existing Supabase UUID instead of Google's numeric ID
        if (existingUserByEmail) {
          
          // CRITICAL: Override Google's ID with the Supabase UUID
          if (account?.provider === 'google') {
            // Store original ID for logging
            const originalGoogleId = user.id;
            
            // Set the user ID to match the existing account
            user.id = existingUserByEmail.id;
            
            // Store the original Google ID for reference (in case it's needed)
            (user as any).originalGoogleId = originalGoogleId;
            
            // Update token configuration
            if (account.access_token) {
              account.expires_at = Math.floor(Date.now() / 1000) + 3600;
            }
            
            // Create/update mapping in our oauth_provider_mapping table
            const { error: mappingError } = await supabase
              .from('oauth_provider_mapping')
              .upsert({
                provider_id: originalGoogleId,
                provider_name: 'google',
                user_uuid: user.id,
                email: user.email,
                updated_at: new Date().toISOString()
              }, {
                onConflict: 'provider_id,provider_name',
                ignoreDuplicates: false
              });
            
            if (mappingError) {
              console.error('[Auth] Error creating OAuth mapping:', mappingError);
            } else {
            }
          }
        }
        // For credentials login, set the tokens from Supabase session
        else if (account?.provider === 'credentials') {
          account.access_token = (user as any).access_token;
          account.refresh_token = (user as any).refresh_token;
          account.expires_at = Math.floor(Date.now() / 1000) + 3600;
        }

        // Try to find the user with either the Google-provided ID or the credential ID
        const { data: existingUser, error: findError } = await supabase
          .from('profiles')
          .select('id, email, user_id')
          .eq('id', user.id)
          .single();

        if (findError && findError.code !== 'PGRST116') {
        }

        // If user exists, we'll just use it and continue the flow
        if (existingUser) {
          
          // Double-check that user.id matches the existing profile ID for consistent session handling
          if (user.id !== existingUser.id) {
            user.id = existingUser.id;
          }
          
          // Check if user_id is set, update if needed
          if (!existingUser.user_id) {
            const { error: updateError } = await supabase
              .from('profiles')
              .update({
                user_id: user.id,
                updated_at: new Date().toISOString()
              })
              .eq('id', existingUser.id);
              
            if (updateError) {
            }
          }
        } else {
          // Try to update if exists or insert if not with UPSERT operation
          const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
              id: user.id,
              user_id: user.id,
              email: user.email,
              name: user.name || '',
              avatar_url: user.image || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { 
              onConflict: 'id',
              ignoreDuplicates: false
            });

          if (upsertError) {
            console.error("[Auth] Error upserting profile:", upsertError);
            // This is not necessarily fatal, we'll continue the flow
          }
        }

        // Check if user has a workspace, create one if not
        const { data: workspaces, error: workspaceError } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', user.id)
          .limit(1);

        if (workspaceError) {
          console.error("[Auth] Error checking for workspaces:", workspaceError);
        } else if (!workspaces || workspaces.length === 0) {

          // Get user profile data to check for company name
          let companyName = '';
          
          // Try to get company name from profile data if available
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('company')
              .eq('user_id', user.id)
              .single();
              
            if (profileData?.company) {
              companyName = profileData.company;
            }
          } catch (profileErr) {
          }

          // Create a default workspace
          const { data: newWorkspace, error: createWorkspaceError } = await supabase
            .from('workspaces')
            .insert([{
              name: companyName || (user.name ? `${user.name}'s Workspace` : 'Default Workspace'),
                  owner_id: user.id,
              created_at: new Date().toISOString(),
              is_personal: true
            }])
            .select()
            .single();

          if (createWorkspaceError) {
            console.error("[Auth] Error creating workspace:", createWorkspaceError);
          } else if (newWorkspace) {
            // Add user as admin of their workspace
            const { error: teamError } = await supabase
              .from('team_members')
              .insert([{
                    user_id: user.id,
                workspace_id: newWorkspace.id,
                name: user.name || 'User',
                email: user.email,
                is_admin: true,
                permissions: { read: true, write: true, admin: true },
                created_at: new Date().toISOString()
              }]);

            if (teamError) {
              console.error("[Auth] Error adding user to workspace:", teamError);
            } else {
            }
          }
        }

        // If this is a Google sign-in with an access token, save/update the integration
        if (account && account.provider === 'google' && account.access_token) {
          
          const now = new Date();
          const expiresAt = account.expires_at ? new Date(account.expires_at * 1000) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
          const scopes = account.scope?.split(' ') || [];

          // Get user's workspace for linking with integrations
          const { data: userWorkspace, error: userWorkspaceError } = await supabase
            .from('workspaces')
            .select('id')
            .eq('owner_id', user.id)
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

          if (userWorkspaceError) {
            console.error("[Auth] Error getting user workspace for integrations:", userWorkspaceError);
          }

          let workspaceId = userWorkspace?.id;
          if (!workspaceId) {
            console.error("[Auth] No workspace found for user when saving integrations");
            
            // Try to get company name if we have it
            let companyName = '';
            try {
              const { data: profileData } = await supabase
                .from('profiles')
                .select('company')
                .eq('user_id', user.id)
                .single();
                
              if (profileData?.company) {
                companyName = profileData.company;
              }
            } catch (profileErr) {
            }
            
            // If no workspace was found, try to create one now
            
            const { data: newWorkspace, error: createWorkspaceError } = await supabase
              .from('workspaces')
              .insert([{
                name: companyName || (user.name ? `${user.name}'s Workspace` : 'Default Workspace'),
                owner_id: user.id,
                created_at: new Date().toISOString(),
                is_personal: true
              }])
              .select()
              .single();
              
            if (createWorkspaceError) {
              console.error("[Auth] Error creating emergency workspace for integrations:", createWorkspaceError);
            } else if (newWorkspace) {
              
              // Add the user to this emergency workspace
              const { error: memberError } = await supabase
                .from('team_members')
                .insert([{
                  user_id: user.id,
                  workspace_id: newWorkspace.id,
                  name: user.name || 'User',
                  email: user.email,
                  is_admin: true,
                  permissions: { read: true, write: true, admin: true },
                  created_at: new Date().toISOString()
                }]);
                
              if (memberError) {
                console.error("[Auth] Error adding user to emergency workspace:", memberError);
              } else {
                // Use this newly created workspace
                workspaceId = newWorkspace.id;
              }
            }
          }

          // Determine which Google services this token applies to based on scopes
          const servicesToUpdate: string[] = [];
          if (scopes.some(s => s.includes('calendar'))) servicesToUpdate.push('google-calendar');
          if (scopes.some(s => s.includes('analytics'))) servicesToUpdate.push('google-analytics');
          if (scopes.some(s => s.includes('webmasters'))) servicesToUpdate.push('google-searchconsole');
          if (scopes.some(s => s.includes('drive'))) servicesToUpdate.push('google-drive');
          if (scopes.some(s => s.includes('gmail'))) servicesToUpdate.push('google-gmail');
          if (scopes.some(s => s.includes('youtube'))) servicesToUpdate.push('youtube');


          for (const service of servicesToUpdate) {
            const { error: integrationError } = await supabase
              .from('integrations')
              .upsert({
                user_id: user.id,
                service_name: service,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: expiresAt.toISOString(),
                scopes: scopes,
                created_at: now.toISOString(),
                updated_at: now.toISOString(),
                workspace_id: workspaceId  // Associate integration with user's workspace
              }, {
                onConflict: 'user_id,service_name,workspace_id'
              });

            if (integrationError) {
              console.error(`[Auth] Error saving integration for ${service}:`, integrationError);
            } else {
            }
          }
        }

        return true;
      } catch (error) {
        console.error("[Auth] General signIn error:", error);
        return false;
      }
    },
    async jwt({ token, user, account }) {
      
      // Log account information during token processing
      if (account) {
        
        // More detailed debug info for Google auth
        if (account.provider === 'google') {
        }
      } else {
      }
      
      if (user) {
        
        // For Google auth, ensure we're using the mapped UUID
        if (account?.provider === 'google' && !isValidUUID(user.id)) {
          try {
            // Check mapping table first
            const { data: mappedUser, error: mappingError } = await supabase
              .from('oauth_provider_mapping')
              .select('user_uuid')
              .eq('provider_id', user.id)
              .eq('provider_name', 'google')
              .single();
              
            if (mappingError && mappingError.code !== 'PGRST116') {
              console.error(`[Auth JWT] Error checking OAuth mapping:`, mappingError.code, mappingError.message);
            } else if (mappedUser && mappedUser.user_uuid) {
              token.id = mappedUser.user_uuid;
              token.originalGoogleId = user.id;
            } else {
              token.id = user.id;
            }
          } catch (error) {
            console.error(`[Auth JWT] Error processing Google auth:`, error);
            token.id = user.id;
          }
        } else {
          token.id = user.id;
        }
        
        token.email = user.email || '';
        
        // Store the original Google ID if it exists
        if ((user as any).originalGoogleId) {
          token.originalGoogleId = (user as any).originalGoogleId;
        }
        
        if (account) {
          
          // Track if we're receiving tokens from the provider
          const hasAccessToken = !!account.access_token;
          const hasRefreshToken = !!account.refresh_token;
          const hasExpiry = !!account.expires_at;
          
          if (hasAccessToken) {
            token.access_token = account.access_token || '';
          } else {
            console.warn("[AUTH DEBUG] No access token provided by auth provider");
          }
          
          if (hasRefreshToken) {
            token.refresh_token = account.refresh_token || '';
          } else {
            console.warn("[AUTH DEBUG] No refresh token provided by auth provider");
          }
          
          if (hasExpiry) {
            token.expires_at = account.expires_at || 0;
          } else {
            console.warn("[AUTH DEBUG] No token expiry provided by auth provider");
          }
          
          // For Google auth, always save tokens to the integrations table directly
          if (account.provider === 'google' && account.access_token) {
            try {
              const now = new Date();
              const expiresAt = account.expires_at ? new Date(account.expires_at * 1000) : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 1 week
              const scopes = account.scope?.split(' ') || [];
              
              // Determine which Google services this token applies to based on scopes
              const servicesToUpdate: string[] = [];
              if (scopes.some(s => s.includes('calendar'))) servicesToUpdate.push('google-calendar');
              if (scopes.some(s => s.includes('analytics'))) servicesToUpdate.push('google-analytics');
              if (scopes.some(s => s.includes('webmasters'))) servicesToUpdate.push('google-searchconsole');
              if (scopes.some(s => s.includes('drive'))) servicesToUpdate.push('google-drive');
              if (scopes.some(s => s.includes('gmail'))) servicesToUpdate.push('google-gmail');
              if (scopes.some(s => s.includes('youtube'))) servicesToUpdate.push('youtube');
              
              
              // If no specific scopes found but we have a token, at least save it for basic Google access
              if (servicesToUpdate.length === 0 && account.access_token) {
                servicesToUpdate.push('google-account');
              }
              
              // Make sure user ID is valid before saving
              if (!token.id || !isValidUUID(token.id.toString())) {
                console.error(`[AUTH DEBUG] Cannot save tokens - invalid user ID: ${token.id}`);
                token.integrationSaveError = 'Invalid user ID';
              } else {
                for (const service of servicesToUpdate) {
                  
                  const { error: integrationError } = await supabase
                    .from('integrations')
                    .upsert({
                      user_id: token.id as string,
                      service_name: service,
                      access_token: account.access_token,
                      refresh_token: account.refresh_token || null,
                      expires_at: expiresAt.toISOString(),
                      scopes: scopes,
                      created_at: now.toISOString(),
                      updated_at: now.toISOString()
                    }, {
                      onConflict: 'user_id,service_name'
                    });
                    
                  if (integrationError) {
                    console.error(`[AUTH DEBUG] Error saving ${service} integration:`, integrationError.code, integrationError.message);
                    token.integrationSaveError = `${integrationError.code}: ${integrationError.message}`;
                  } else {
                    token.integrationSaved = true;
                  }
                }
              }
            } catch (error) {
              console.error('[AUTH DEBUG] Unexpected error saving integrations:', error);
              if (error instanceof Error) {
                token.integrationSaveError = error.message;
              }
            }
          }
        }
      }

      return token;
    },
    async session({ session, token }) {

      if (session.user && session.user.email) {
        try {
          // Add OAuth tokens to the session - using any type for debugging purposes
          if (token.access_token) {
            (session as any).access_token = token.access_token;
          } else {
            console.warn("[AUTH DEBUG] No access_token in token to add to session");
          }
          
          if (token.refresh_token) {
            (session as any).refresh_token = token.refresh_token;
          } else {
            console.warn("[AUTH DEBUG] No refresh_token in token to add to session");
          }
          
          if (token.expires_at) {
            (session as any).expires_at = token.expires_at;
          } else {
            console.warn("[AUTH DEBUG] No expires_at in token to add to session");
          }
          
          // Always ensure user ID is properly set from token
          if (token.id) {
            
            // First check if this is a Google numeric ID - if so, use our mapping table
            if (token.id && !isValidUUID(token.id.toString())) {
              
              const { data: mappedUser, error: mappingError } = await supabase
                .from('oauth_provider_mapping')
                .select('user_uuid')
                .eq('provider_id', token.id)
                .eq('provider_name', 'google')
                .single();
                
              if (mappingError) {
                console.error("[AUTH DEBUG] Error checking mapping:", mappingError.code, mappingError.message);
              }
                
              if (mappedUser && mappedUser.user_uuid) {
                session.user.id = mappedUser.user_uuid;
                // Store original ID
                (session.user as any).originalGoogleId = token.id;
              } else {
                // Fall back to token ID if no mapping found
                session.user.id = token.id as string;
                
                // Also store the original Google ID if available
                if (token.originalGoogleId) {
                  (session.user as any).originalGoogleId = token.originalGoogleId;
                }
              }
            } else {
              // Normal UUID case
              session.user.id = token.id as string;
            
              // Also store the original Google ID if available
              if (token.originalGoogleId) {
                (session.user as any).originalGoogleId = token.originalGoogleId;
              }
            }
          } else {
            console.error("[AUTH DEBUG] No ID in token to set on session user");
          }
          
          // Double-check with database to ensure consistency
          
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', session.user.email)
            .single();

          if (profileError) {
            console.error("[Auth Session Callback] Error fetching profile:", profileError.code, profileError.message);
          } else if (!profile) {
            console.warn(`[Auth Session Callback] Profile not found for email: ${session.user.email}`);
            
            // Create profile if it doesn't exist - IMPORTANT to make workspace loading work
            if (session.user.id) {
              // CHECK IF PROFILE WITH THIS ID ALREADY EXISTS
              const { data: existingProfileById, error: existingProfileByIdError } = await supabase
                .from('profiles')
                .select('id')
                .eq('id', session.user.id)
                .single();

              if (existingProfileByIdError && existingProfileByIdError.code !== 'PGRST116') {
                console.error("[Auth Session Callback] Error checking for existing profile by ID:", existingProfileByIdError.code, existingProfileByIdError.message);
              } else if (existingProfileById) {
              } else {
                const profileResult = await safeUpsertProfile({
                    id: session.user.id,
                    email: session.user.email,
                  name: session.user.name || session.user.email?.split('@')[0] || 'User'
                });

                if (profileResult) {
                } else {
                }
              }
            }
          } else {
            
            // CRITICAL: For consistent auth flow, ALWAYS use the profile ID from Supabase
            // This ensures Google auth and credential auth use the same ID
            if (profile.id !== session.user.id) {
              console.log(`[Auth Session Callback] ID mismatch - updating session ID.
                Current: ${session.user.id} 
                Profile: ${profile.id}`);
              session.user.id = profile.id;
              
              // If this was a Google auth, update the mapping
              if (token.originalGoogleId) {
                try {
                  const { error: mappingError } = await supabase
                    .from('oauth_provider_mapping')
                    .upsert({
                      provider_id: token.originalGoogleId as string,
                      provider_name: 'google',
                      user_uuid: profile.id,
                      email: session.user.email,
                      updated_at: new Date().toISOString(),
                      created_at: new Date().toISOString()
                    }, {
                      onConflict: 'provider_id,provider_name',
                      ignoreDuplicates: false
                    });
                    
                  if (mappingError) {
                    console.error("[Auth Session Callback] Error updating OAuth mapping:", mappingError.code, mappingError.message);
                  } else {
                  }
                } catch (error) {
                  console.error("[Auth Session Callback] Unexpected error updating mapping:", error);
                }
              }
            }
          }
          
          // Sync Supabase session
          try {
            const supabaseSession = await syncSupabaseSession((session as any).access_token);
            if (supabaseSession) {
              (session as ExtendedSession).supabaseAccessToken = supabaseSession.access_token;
            } else {
              console.error("[AUTH DEBUG] Failed to sync with Supabase session");
            }
          } catch (supabaseError) {
            console.error("[AUTH DEBUG] Error syncing Supabase session:", supabaseError);
            if (supabaseError instanceof Error) {
              console.error("[AUTH DEBUG] Supabase sync error details:", {
                name: supabaseError.name,
                message: supabaseError.message,
                stack: supabaseError.stack
              });
            }
          }
          
        } catch (error) {
          console.error("[Auth Session Callback] Error processing session:", error);
          if (error instanceof Error) {
            console.error("[AUTH DEBUG] Session error details:", {
              name: error.name,
              message: error.message,
              stack: error.stack
            });
          }
        }
      } else {
        console.error("[AUTH DEBUG] No user in session or missing email");
      }
      
      return session;
    }
  },
  session: {
    strategy: "jwt"
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
};

async function safeUpsertProfile(user) {
  try {
    if (!user.id || !user.email) {
      return false;
    }
    
    
    // First check if profile exists to avoid RLS issues
    const { data: existingProfile, error: lookupError } = await supabaseAdmin
      .from('profiles')
      .select('id, email')
      .eq('id', user.id)
      .maybeSingle();
      
    if (lookupError && lookupError.code !== 'PGRST116') {
      console.error('[Auth] Error checking for existing profile:', lookupError);
      return false;
    }
    
    if (existingProfile) {
      
      // Profile exists, update it using admin client to bypass RLS
      const { error: updateError } = await supabaseAdmin
        .from('profiles')
        .update({
          name: user.name || '',
          email: user.email,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);
        
      if (updateError) {
        console.error('[Auth] Error updating profile:', updateError);
        return false;
      }
      
      return true;
    } else {
      
      // Profile doesn't exist, create it with admin client
      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: user.id,
          name: user.name || '',
          email: user.email,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          // Add minimal required fields depending on your schema
          phone: '',
          company: '',
          role: '',
          address: '',
          city: '',
          country: '',
          website: '',
          password: '',
        });
        
      if (insertError) {
        console.error('[Auth] Error creating profile:', insertError);
        return false;
      }
      
      return true;
    }
  } catch (error) {
    console.error('[Auth] Unexpected error in safeUpsertProfile:', error);
    return false;
  }
}

export default authOptions; 