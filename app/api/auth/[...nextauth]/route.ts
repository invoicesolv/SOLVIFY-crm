import NextAuth from "next-auth";
import authOptions from "@/lib/auth";
import { cookies } from 'next/headers';
import { Session } from "next-auth";
import { JWT } from "next-auth/jwt";
import type { User, Account, AdapterUser, DefaultSession } from "next-auth";

// Add types for extended session
interface ExtendedUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
}

interface ExtendedSession extends Session {
  user?: ExtendedUser;
  expires: string;
  supabaseAccessToken?: string;
  access_token?: string;
}

// Add debugging
console.log("[API] NextAuth initialization");

// Force development URL to match local environment
if (process.env.NODE_ENV === 'development') {
  const port = process.env.PORT || 3000;
  const developmentUrl = `http://localhost:${port}`;
  console.log(`[API] Development environment detected, overriding NEXTAUTH_URL to ${developmentUrl}`);
  process.env.NEXTAUTH_URL = developmentUrl;
}

console.log("[API] Environment:", {
  nodeEnv: process.env.NODE_ENV,
  nextAuthUrl: process.env.NEXTAUTH_URL,
  hasSecret: !!process.env.NEXTAUTH_SECRET,
  dbUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
  timestamp: new Date().toISOString()
});

// Add more detailed auth debug logging
console.log('[NextAuth Route] Auth options loaded from @/lib/auth');
console.log("[AUTH DEBUG] Route enabled with providers:", 
  Array.isArray(authOptions.providers) 
    ? authOptions.providers.map(p => p.id || 'unknown').join(', ') 
    : 'none'
);

const handler = NextAuth({
  ...authOptions,
  debug: true,
  callbacks: {
    ...authOptions.callbacks,
    async signIn({ user, account, profile }) {
      console.log("[API/AUTH DEBUG] signIn callback started", { 
        hasUser: !!user?.email, 
        hasUserId: !!user?.id,
        provider: account?.provider,
        hasAccessToken: !!account?.access_token,
        hasRefreshToken: !!account?.refresh_token,
        scope: account?.scope,
        timestamp: new Date().toISOString()
      });
      
      if (account?.provider === 'google') {
        console.log("[API/AUTH DEBUG] Google account details:", {
          type: account.type,
          token_type: account.token_type,
          scope: account.scope,
          expires_at: account.expires_at,
          id_token_available: !!account.id_token,
        });
        
        if (!account.refresh_token) {
          console.warn("[API/AUTH DEBUG] ⚠️ No refresh_token received from Google!");
          console.warn("[API/AUTH DEBUG] This may happen if the user has already authorized the application.");
          console.warn("[API/AUTH DEBUG] Check that 'prompt=consent' and 'access_type=offline' are being passed to the Google auth request.");
        }
      }
      
      try {
        // Call the original signIn function
        const result = await authOptions.callbacks?.signIn?.({ user, account, profile });
        
        console.log("[API/AUTH DEBUG] signIn callback result:", result);
        console.log("[API/AUTH DEBUG] signIn user data:", {
          hasId: !!user?.id,
          hasEmail: !!user?.email,
          hasName: !!user?.name,
          hasImage: !!user?.image,
          provider: account?.provider,
          providerType: account?.type
        });
        
        // Explicitly set cookie to ensure session persistence
        if (result === true && user?.id) {
          console.log("[API/AUTH DEBUG] Setting user session cookie");
          
          // Debug cookie storage
          try {
            const cookieStore = cookies();
            const allCookies = cookieStore.getAll().map(c => c.name);
            console.log("[API/AUTH DEBUG] Cookies after signin:", allCookies);
          } catch (cookieErr) {
            console.error("[API/AUTH DEBUG] Error checking cookies:", cookieErr);
          }
        }
        
        // Ensure we return a boolean or string (not undefined)
        return result === true || typeof result === 'string' ? result : false;
      } catch (error) {
        console.error("[API/AUTH DEBUG] signIn callback error:", error instanceof Error ? {
          message: error.message,
          stack: error.stack
        } : error);
        return false;
      }
    },
    
    // Fix the JWT callback
    async jwt({ token, user, account }) {
      console.log("[API/AUTH DEBUG] JWT callback:", {
        hasToken: !!token,
        hasUser: !!user,
        hasAccount: !!account,
        tokenId: token?.sub,
        userId: user?.id
      });
      
      // Add raw account debugging
      if (account) {
        console.log("[API/AUTH DEBUG] Account object in JWT callback:", {
          provider: account.provider,
          type: account.type,
          providerAccountId: account.providerAccountId,
          access_token_available: !!account.access_token,
          refresh_token_available: !!account.refresh_token,
          token_type: account.token_type,
          scope: account.scope,
          id_token_available: !!account.id_token,
          expires_at: account.expires_at,
        });
      }
      
      // Call the original JWT function from authOptions
      if (authOptions.callbacks?.jwt) {
        try {
          const newToken = await authOptions.callbacks.jwt({ token, user, account });
          console.log("[API/AUTH DEBUG] JWT result:", {
            hasTokenAfter: !!newToken,
            tokenId: newToken?.sub,
            hasAccessToken: !!newToken?.access_token
          });
          
          return newToken;
        } catch (error) {
          console.error("[API/AUTH DEBUG] Error in JWT callback:", error);
          return token;
        }
      }
      
      return token;
    },
    
    // Fix the session callback
    async session({ session, token }) {
      console.log("[API/AUTH DEBUG] Session callback:", {
        hasSession: !!session,
        hasToken: !!token,
        sessionUserId: session?.user?.id,
        tokenId: token?.sub
      });
      
      // Call the original session function with correct handling
      if (authOptions.callbacks?.session) {
        try {
          // Create parameters to match required interface
          const params = { 
            session: session as Session, 
            token, 
            // Adapting the parameters to match what's expected
            user: undefined as unknown as AdapterUser,
            newSession: session,
            trigger: "update" as const
          };
          
          const newSession = await authOptions.callbacks.session(params);
          console.log("[API/AUTH DEBUG] Session result:", {
            hasSessionAfter: !!newSession,
            sessionUserIdAfter: newSession?.user?.id,
            hasAccessToken: !!(newSession as ExtendedSession)?.access_token
          });
          
          return newSession;
        } catch (error) {
          console.error("[API/AUTH DEBUG] Error in session callback:", error);
          return session;
        }
      }
      
      return session;
    }
  }
});

export { handler as GET, handler as POST };
