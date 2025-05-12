import NextAuth, { AuthOptions, Session, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";
import { JWT } from "next-auth/jwt";
import { syncSupabaseSession } from "@/lib/supabase";

interface GoogleProfile {
  email: string;
  sub: string;
  name?: string;
  picture?: string;
}

const authOptions: AuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          access_type: "offline",
          response_type: "code",
          prompt: "consent",
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
            'https://www.googleapis.com/auth/gmail.labels'
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
          throw new Error("Missing credentials");
        }

        // Try to authenticate with Supabase first
        try {
          const { data, error } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password,
          });

          if (error) {
            throw new Error(error.message);
          }

          if (!data.user || !data.session) {
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
          // Return null on error
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email) return false;
      
      try {
        // First check if user exists
        const { data: existingUser, error: findError } = await supabase
          .from('profiles')
          .select('id, email')
          .eq('email', user.email)
          .single();

        if (findError && findError.code !== 'PGRST116') {
          console.error("[Auth] Error finding profile:", findError);
          return false;
        }

        const userId = existingUser?.id || user.id;

        // For credentials login, set the tokens from Supabase session
        if (account?.provider === 'credentials') {
          account.access_token = (user as any).access_token;
          account.refresh_token = (user as any).refresh_token;
          account.expires_at = Math.floor(Date.now() / 1000) + 3600;
        }

        if (!existingUser) {
          // Create new user profile
          const { error: createError } = await supabase
            .from('profiles')
            .insert([{
              id: userId,
              email: user.email,
              name: user.name || '',
              avatar_url: user.image || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (createError) {
            console.error("[Auth] Error creating profile:", createError);
            return false;
          }
        }

        // Check if user has a workspace, create one if not
        const { data: workspaces, error: workspaceError } = await supabase
          .from('workspaces')
          .select('id')
          .eq('owner_id', userId)
          .limit(1);

        if (workspaceError) {
          console.error("[Auth] Error checking for workspaces:", workspaceError);
        } else if (!workspaces || workspaces.length === 0) {
          console.log("[Auth] No workspaces found for user, creating default workspace");

          // Get user profile data to check for company name
          let companyName = '';
          
          // Try to get company name from profile data if available
          try {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('company')
              .eq('user_id', userId)
              .single();
              
            if (profileData?.company) {
              companyName = profileData.company;
              console.log("[Auth] Found company name from profile:", companyName);
            }
          } catch (profileErr) {
            console.log("[Auth] Error fetching profile for company name:", profileErr);
          }

          // Create a default workspace
          const { data: newWorkspace, error: createWorkspaceError } = await supabase
            .from('workspaces')
            .insert([{
              name: companyName || (user.name ? `${user.name}'s Workspace` : 'Default Workspace'),
              owner_id: userId,
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
                user_id: userId,
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
              console.log("[Auth] Successfully created workspace and added user");
            }
          }
        }

        // If this is a Google sign-in with an access token, save/update the integration
        if (account && account.provider === 'google' && account.access_token) {
          const now = new Date();
          const expiresAt = account.expires_at ? new Date(account.expires_at * 1000) : new Date(now.getTime() + 3600 * 1000);
          const scopes = account.scope?.split(' ') || [];

          // Get user's workspace for linking with integrations
          const { data: userWorkspace, error: userWorkspaceError } = await supabase
            .from('workspaces')
            .select('id')
            .eq('owner_id', userId)
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
                .eq('user_id', userId)
                .single();
                
              if (profileData?.company) {
                companyName = profileData.company;
                console.log("[Auth] Found company name for emergency workspace:", companyName);
              }
            } catch (profileErr) {
              console.log("[Auth] Error fetching profile for emergency workspace:", profileErr);
            }
            
            // If no workspace was found, try to create one now
            const { data: newWorkspace, error: createWorkspaceError } = await supabase
              .from('workspaces')
              .insert([{
                name: companyName || (user.name ? `${user.name}'s Workspace` : 'Default Workspace'),
                owner_id: userId,
                created_at: new Date().toISOString(),
                is_personal: true
              }])
              .select()
              .single();
              
            if (createWorkspaceError) {
              console.error("[Auth] Error creating emergency workspace for integrations:", createWorkspaceError);
            } else if (newWorkspace) {
              console.log("[Auth] Emergency workspace created for integrations:", newWorkspace.id);
              
              // Add the user to this emergency workspace
              const { error: memberError } = await supabase
                .from('team_members')
                .insert([{
                  user_id: userId,
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

          for (const service of servicesToUpdate) {
            const { error: integrationError } = await supabase
              .from('integrations')
              .upsert({
                user_id: userId,
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
              console.log(`[Auth] Successfully saved integration for ${service} with workspace ${workspaceId}`);
            }
          }
        }

        return true;
      } catch (error) {
        console.error("[Auth] General signIn error:", error);
        return false;
      }
    },
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          id: user.id,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
        } as JWT;
      }

      return token;
    },
    async session({ session, token }) {
      console.log("[Auth Session Callback] Received Token:", JSON.stringify(token, null, 2));
      console.log("[Auth Session Callback] Received Session:", JSON.stringify(session, null, 2));

      if (session.user && session.user.email) {
        try {
        // Get the user profile from Supabase
          console.log(`[Auth Session Callback] Fetching profile for email: ${session.user.email}`);
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (profileError && profileError.code !== 'PGRST116') { // PGRST116 = Row not found
            console.error("[Auth Session Callback] Error fetching profile:", profileError);
          } else if (!profile) {
            console.warn(`[Auth Session Callback] Profile not found for email: ${session.user.email}`);
          } else {
            console.log("[Auth Session Callback] Profile found:", JSON.stringify(profile, null, 2));
          // Always use the Supabase profile ID
          session.user.id = profile.id;
            console.log(`[Auth Session Callback] Set session.user.id to: ${session.user.id}`);
          
          // Add access token and other OAuth details to the session
          (session as any).access_token = token.access_token;
          (session as any).refresh_token = token.refresh_token;
          (session as any).expires_at = token.expires_at;
            console.log("[Auth Session Callback] Added OAuth tokens to session.");
          
          // Add Supabase access token to session
            console.log("[Auth Session Callback] Attempting to get Supabase session...");
            
            // First, explicitly sync the session with Supabase using the access token
            if (token.access_token) {
              console.log("[Auth Session Callback] Syncing NextAuth session with Supabase...");
              const supabaseSession = await syncSupabaseSession(token.access_token as string);
              
              if (supabaseSession) {
                console.log("[Auth Session Callback] Successfully synced with Supabase");
                (session as any).supabaseAccessToken = supabaseSession.access_token;
              } else {
                console.warn("[Auth Session Callback] Failed to sync with Supabase");
              }
            } else {
              console.warn("[Auth Session Callback] No access token available for syncing with Supabase");
            }
            
            // Fallback to getting existing session if sync didn't work
            if (!(session as any).supabaseAccessToken) {
          const { data: { session: supabaseSession }, error: supabaseError } = await supabase.auth.getSession();

              if (supabaseError) {
                 console.error("[Auth Session Callback] Error getting Supabase session:", supabaseError);
              } else if (supabaseSession?.access_token) {
                console.log("[Auth Session Callback] Supabase session found. Adding access token.");
            (session as any).supabaseAccessToken = supabaseSession.access_token;
              } else {
                 console.warn("[Auth Session Callback] No active Supabase session found or token missing.");
              }
            }
          }
        } catch (e) {
           console.error("[Auth Session Callback] Unexpected error:", e);
        }
      } else {
         console.warn("[Auth Session Callback] Session user or email missing.");
      }

      console.log("[Auth Session Callback] Returning session:", JSON.stringify(session, null, 2));
      return session;
    }
  },
  session: {
    strategy: "jwt"
  },
  debug: process.env.NODE_ENV === 'development',
  secret: process.env.NEXTAUTH_SECRET,
};

export default authOptions; 