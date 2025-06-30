import { getServerSession } from 'next-auth'
import { NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Create Supabase client for database operations only (no auth)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Get session from NextAuth for server-side operations
export async function getSession() {
  return await getServerSession()
}

// Get user from NextAuth session for API routes
export async function getUserFromSession(request?: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user) {
      return null
    }
    
    // Map NextAuth user to Supabase user ID
    // For admin user kevin@solvify.se, always return the known Supabase UUID
    if (session.user.email === 'kevin@solvify.se') {
      return {
        ...session.user,
        id: 'b1439f18-03dc-4a3a-bf8e-6911795525de' // Correct Supabase UUID
      }
    }
    
    // For other users, try to find their Supabase UUID by email
    if (session.user.email) {
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('email', session.user.email)
        .single()
        
      if (!error && profile?.id) {
        return {
          ...session.user,
          id: profile.id
        }
      }
    }
    
    return session.user
  } catch (error) {
    console.error('Error getting user from session:', error)
    return null
  }
}

// Get user with database info from NextAuth session
export async function getUserWithDb(request?: NextRequest) {
  try {
    const session = await getServerSession()
    if (!session?.user?.id) {
      return null
    }

    // Get additional user info from database
    const { data: user, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('id', session.user.id)
      .single()

    if (error) {
      console.error('Error fetching user from database:', error)
      return session.user
    }

    return {
      ...session.user,
      ...user
    }
  } catch (error) {
    console.error('Error getting user with database info:', error)
    return null
  }
}

// Check if user has required Google integrations
export async function hasGoogleIntegrations(userId: string) {
  try {
    const { data: integrations, error } = await supabaseAdmin
      .from('integrations')
      .select('service_name')
      .eq('user_id', userId)
      .in('service_name', ['gmail', 'google-analytics', 'search-console'])

    if (error) {
      console.error('Error checking integrations:', error)
      return false
    }

    const services = integrations?.map(i => i.service_name) || []
    return services.includes('gmail') && 
           services.includes('google-analytics') && 
           services.includes('search-console')
  } catch (error) {
    console.error('Error checking Google integrations:', error)
    return false
  }
}

// Get Google access token for a specific service
export async function getGoogleAccessToken(userId: string, service: string) {
  try {
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('access_token, refresh_token, token_expires_at')
      .eq('user_id', userId)
      .eq('service_name', service)
      .single()

    if (error || !integration) {
      console.error(`No ${service} integration found for user:`, userId)
      return null
    }

    // Check if token is expired and needs refresh
    if (integration.token_expires_at) {
      const expiresAt = new Date(integration.token_expires_at)
      const now = new Date()
      
      if (now >= expiresAt && integration.refresh_token) {
        // Token is expired, refresh it
        const refreshedToken = await refreshGoogleToken(userId, service, integration.refresh_token)
        return refreshedToken
      }
    }

    return integration.access_token
  } catch (error) {
    console.error('Error getting Google access token:', error)
    return null
  }
}

// Refresh Google OAuth token
async function refreshGoogleToken(userId: string, service: string, refreshToken: string) {
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to refresh token')
    }

    const data = await response.json()
    
    // Update the integration with new token
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000))
    
    await supabaseAdmin
      .from('integrations')
      .update({
        access_token: data.access_token,
        token_expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('service_name', service)

    return data.access_token
  } catch (error) {
    console.error('Error refreshing Google token:', error)
    return null
  }
}

// Create database-only Supabase client (no auth)
export function createDatabaseClient() {
  return supabaseAdmin
}

// Backward compatibility alias
export const getUserFromToken = getUserFromSession
