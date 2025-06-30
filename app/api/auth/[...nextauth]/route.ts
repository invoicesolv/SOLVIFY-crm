import NextAuth from 'next-auth'
import GoogleProvider from 'next-auth/providers/google'
import CredentialsProvider from 'next-auth/providers/credentials'
import { createClient } from '@supabase/supabase-js'

// Validate required environment variables
if (!process.env.NEXTAUTH_SECRET) {
  console.error('❌ NEXTAUTH_SECRET is not set')
  throw new Error('NEXTAUTH_SECRET environment variable is required')
}

if (!process.env.GOOGLE_CLIENT_ID) {
  console.error('❌ GOOGLE_CLIENT_ID is not set')
}

if (!process.env.GOOGLE_CLIENT_SECRET) {
  console.error('❌ GOOGLE_CLIENT_SECRET is not set')
}

console.log('✅ NextAuth environment variables check:')
console.log('- NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? 'SET' : 'MISSING')
console.log('- NEXTAUTH_URL:', process.env.NEXTAUTH_URL || 'NOT SET')
console.log('- GOOGLE_CLIENT_ID:', process.env.GOOGLE_CLIENT_ID ? 'SET' : 'MISSING')
console.log('- GOOGLE_CLIENT_SECRET:', process.env.GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING')

// Create Supabase client for storing integrations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const authOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        try {
          // Authenticate directly with Supabase using signInWithPassword
          const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
            email: credentials.email,
            password: credentials.password
          })

          if (signInError || !authData.user) {
            console.error('Supabase auth error:', signInError?.message)
            throw new Error('Invalid email or password')
          }

          console.log('Supabase auth successful for user:', authData.user.email)

          // Return user object for NextAuth
          return {
            id: authData.user.id,
            email: authData.user.email!,
            name: authData.user.user_metadata?.full_name || authData.user.user_metadata?.name || authData.user.email,
            image: authData.user.user_metadata?.avatar_url || null
          }
        } catch (error) {
          console.error('Auth error:', error)
          throw new Error('Invalid email or password')
        }
      }
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: [
            'openid',
            'email',
            'profile',
            'https://www.googleapis.com/auth/analytics.readonly',
            'https://www.googleapis.com/auth/gmail.readonly',
            'https://www.googleapis.com/auth/webmasters.readonly',
            'https://www.googleapis.com/auth/calendar',
            'https://www.googleapis.com/auth/calendar.events'
          ].join(' ')
        }
      }
    })
  ],
  callbacks: {
    async session({ session, token }) {
      // Add user ID to session from token
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      return session
    },
    async jwt({ token, account, profile, user }) {
      // Store user ID in token
      if (user) {
        token.sub = user.id
      }
      // Store Google tokens for API access
      if (account) {
        token.accessToken = account.access_token
        token.refreshToken = account.refresh_token
      }
      return token
    }
  },
  events: {
    async signIn({ user, account, profile }) {
      // Store Google integration tokens in your integrations table
      if (account?.provider === 'google' && account.access_token) {
        try {
          // Store Gmail integration
          await supabase
            .from('integrations')
            .upsert({
              user_id: user.id,
              service_name: 'gmail',
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              token_expires_at: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,service_name' })

          // Store Google Analytics integration
          await supabase
            .from('integrations')
            .upsert({
              user_id: user.id,
              service_name: 'google-analytics',
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              token_expires_at: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,service_name' })

          // Store Search Console integration
          await supabase
            .from('integrations')
            .upsert({
              user_id: user.id,
              service_name: 'search-console',
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              token_expires_at: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,service_name' })

          // Store Google Calendar integration
          await supabase
            .from('integrations')
            .upsert({
              user_id: user.id,
              service_name: 'google-calendar',
              access_token: account.access_token,
              refresh_token: account.refresh_token,
              token_expires_at: account.expires_at ? new Date(account.expires_at * 1000).toISOString() : null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'user_id,service_name' })

          console.log('Google integrations stored successfully for user:', user.id)
        } catch (error) {
          console.error('Error storing Google integrations:', error)
        }
      }
    }
  },
  pages: {
    signIn: '/login',
    error: '/login?error=auth_error',
  },
  session: {
    strategy: 'jwt',
  },
  // Remove custom cookie configuration - let NextAuth handle it automatically
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, metadata) {
      console.error('NextAuth Error:', code, metadata)
    },
    warn(code) {
      console.warn('NextAuth Warning:', code)
    },
    debug(code, metadata) {
      console.log('NextAuth Debug:', code, metadata)
    },
  },
}

const handler = NextAuth(authOptions)

export { handler as GET, handler as POST, authOptions }
