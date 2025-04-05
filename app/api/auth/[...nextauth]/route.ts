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
          .select('*')
          .eq('email', user.email)
          .single();

        if (findError && findError.code !== 'PGRST116') {
          return false;
        }

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
              id: user.id,
              email: user.email,
              name: user.name || '',
              avatarurl: user.image || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }]);

          if (createError) {
            return false;
          }
        }

        // If this is a Google sign-in with an access token, save it
        if (account && account.provider === 'google' && account.access_token) {
          const now = new Date();
          const expiresAt = account.expires_at ? new Date(account.expires_at * 1000) : new Date(now.getTime() + 3600 * 1000);

          // Save tokens for each potential service
          const services = ['google-calendar', 'google-analytics', 'google-searchconsole'];
          for (const service of services) {
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
              // Continue with other services even if one fails
              continue;
            }
          }
        }

        return true;
      } catch (error) {
        return false;
      }
    },
    async jwt({ token, user, account, trigger }) {
      // Initial sign in
      if (account && user) {
        return {
          ...token,
          access_token: account.access_token,
          refresh_token: account.refresh_token,
          expires_at: account.expires_at,
        };
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        // Get the user profile from Supabase
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('email', session.user.email)
          .single();

        if (profile) {
          // Always use the Supabase profile ID
          session.user.id = profile.id;
          
          // Add access token and other OAuth details to the session
          (session as any).access_token = token.access_token;
          (session as any).refresh_token = token.refresh_token;
          (session as any).expires_at = token.expires_at;

          // Set the session in Supabase client
          if (token.access_token) {
            const { error: sessionError } = await supabase.auth.setSession({
              access_token: token.access_token as string,
              refresh_token: token.refresh_token as string
            });
          }
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