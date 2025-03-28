import NextAuth, { AuthOptions, Session, User } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { supabase } from "@/lib/supabase";
import { JWT } from "next-auth/jwt";

interface GoogleProfile {
  email: string;
  sub: string;
  name?: string;
  picture?: string;
}

export const authOptions: AuthOptions = {
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
            'https://www.googleapis.com/auth/drive.readonly'
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

        console.log('DEBUG [authorize] Starting Supabase sign in...');
        const { data, error } = await supabase.auth.signInWithPassword({
          email: credentials.email,
          password: credentials.password,
        });

        if (error) {
          console.error("DEBUG [authorize] Supabase auth error:", error);
          throw new Error(error.message);
        }

        if (!data.user || !data.session) {
          console.error("DEBUG [authorize] No user or session in Supabase response");
          throw new Error("Invalid credentials");
        }

        console.log('DEBUG [authorize] Supabase session obtained:', {
          hasUser: !!data.user,
          hasSession: !!data.session,
          accessToken: data.session.access_token?.slice(0, 10) + '...',
          refreshToken: data.session.refresh_token?.slice(0, 10) + '...'
        });

        return {
          id: data.user.id,
          email: data.user.email,
          name: data.user.user_metadata?.name || data.user.email,
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
  callbacks: {
    async signIn({ user, account, profile }) {
      console.log('DEBUG [signIn] Starting callback:', {
        hasUser: !!user,
        userEmail: user?.email,
        provider: account?.provider,
        hasAccessToken: !!(user as any).access_token
      });

      if (!user.email) return false;
      
      try {
        // First check if user exists
        const { data: existingUser, error: findError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', user.email)
          .single();

        if (findError && findError.code !== 'PGRST116') {
          console.error("Error finding user:", findError);
          return false;
        }

        // For credentials login, set the tokens from Supabase session
        if (account?.provider === 'credentials') {
          console.log('DEBUG [signIn] Setting credentials tokens:', {
            originalAccessToken: !!(user as any).access_token,
            originalRefreshToken: !!(user as any).refresh_token
          });

          account.access_token = (user as any).access_token;
          account.refresh_token = (user as any).refresh_token;
          account.expires_at = Math.floor(Date.now() / 1000) + 3600;

          console.log('DEBUG [signIn] Tokens set in account:', {
            hasAccessToken: !!account.access_token,
            hasRefreshToken: !!account.refresh_token,
            expiresAt: account.expires_at
          });
        }

        if (!existingUser) {
          // Create new user profile
          const { error: createError } = await supabase
            .from('profiles')
            .insert([{
              id: user.id,
              email: user.email,
              name: user.name || '',
              avatarurl: user.image || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (createError) {
            console.error("Error creating profile:", createError);
            return false;
          }
        }

        // If this is a Google sign-in with an access token, save it
        if (account && account.provider === 'google' && account.access_token) {
          console.log('Saving Google tokens for user:', existingUser.id);
          const now = new Date();
          const expiresAt = account.expires_at ? new Date(account.expires_at * 1000) : new Date(now.getTime() + 3600 * 1000);

          // Save tokens for each potential service
          const services = ['google-calendar', 'google-analytics', 'google-searchconsole'];
          for (const service of services) {
            console.log(`Saving tokens for service: ${service}`);
            const { error: integrationError } = await supabase
              .from('integrations')
              .upsert({
                user_id: existingUser.id,
                service_name: service,
                access_token: account.access_token,
                refresh_token: account.refresh_token,
                expires_at: expiresAt.toISOString(),
                scopes: account.scope?.split(' ') || [],
                created_at: now.toISOString(),
                updated_at: now.toISOString()
              }, {
                onConflict: 'user_id,service_name'
              });

            if (integrationError) {
              console.error(`Error saving integration for ${service}:`, integrationError);
              // Continue with other services even if one fails
              continue;
            }
            console.log(`Successfully saved tokens for ${service}`);
          }
        }

        return true;
      } catch (error) {
        console.error("DEBUG [signIn] Error:", error);
        return false;
      }
    },
    async jwt({ token, user, account, trigger }) {
      console.log('DEBUG [jwt] Starting callback:', {
        trigger,
        hasUser: !!user,
        hasAccount: !!account,
        existingToken: !!token,
        provider: account?.provider
      });

      // Initial sign in
      if (account && user) {
        console.log('DEBUG [jwt] Setting new token:', {
          provider: account.provider,
          hasAccessToken: !!account.access_token,
          accessTokenPreview: account.access_token ? account.access_token.slice(0, 10) + '...' : 'none'
        });
        
        return {
          ...token,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
        };
      }

      console.log('DEBUG [jwt] Returning existing token:', {
        hasAccessToken: !!token.access_token,
        accessTokenPreview: token.access_token ? (token.access_token as string).slice(0, 10) + '...' : 'none'
      });

      return token;
    },
    async session({ session, token }) {
      console.log('DEBUG [session] Starting callback:', {
        hasToken: !!token,
        hasAccessToken: !!token.access_token,
        tokenPreview: token.access_token ? (token.access_token as string).slice(0, 10) + '...' : 'none'
      });

      if (session.user) {
        // Get the user profile from Supabase
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (profileError) {
          console.error('Error fetching profile:', profileError);
        }

        if (profile) {
          // Always use the Supabase profile ID
          console.log('Setting user ID in session to profile ID:', profile.id);
          session.user.id = profile.id;
          
          // Add access token and other OAuth details to the session
          (session as any).access_token = token.access_token;
          (session as any).refresh_token = token.refresh_token;
          (session as any).expires_at = token.expires_at;

          console.log('DEBUG [session] Session updated:', {
            hasAccessToken: !!(session as any).access_token,
            accessTokenPreview: (session as any).access_token ? ((session as any).access_token as string).slice(0, 10) + '...' : 'none'
          });

          // Set the session in Supabase client
          if (token.access_token) {
            console.log('DEBUG [session] Setting Supabase session...');
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: token.access_token as string,
              refresh_token: token.refresh_token as string
            });
            
            if (sessionError) {
              console.error('DEBUG [session] Error setting Supabase session:', sessionError);
            } else {
              console.log('DEBUG [session] Successfully set Supabase session');
            }
          } else {
            console.log('DEBUG [session] No access token available to set Supabase session');
          }
        } else {
          console.error('No profile found for user:', session.user.email);
        }
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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 