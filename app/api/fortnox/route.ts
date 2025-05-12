import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox credentials
const CLIENT_ID = '4LhJwn68IpdR';
const CLIENT_SECRET = 'pude4Qk6dK';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';
const AUTH_URL = 'https://apps.fortnox.se/oauth-v1/auth';
const TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/token';
const BASE_API_URL = 'https://api.fortnox.se/3/';

// Create Supabase client at runtime only
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Check for both variable names, preferring the non-public one if both exist
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Helper to save token to Supabase
async function saveTokenToSupabase(token: any, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Cannot save token: Supabase client not initialized');
    return false;
  }
  
  try {
    // Calculate expires_at
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + token.expires_in);
    
    // Prepare the data
    const settingsData = {
      service_name: 'fortnox',
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt.toISOString()
    };
    
    // Save to Supabase
    const { error } = await supabaseAdmin
      .from('settings')
      .upsert(settingsData, {
        onConflict: 'service_name,user_id'
      });
    
    if (error) {
      console.error('Error saving token to Supabase:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('Error saving token to Supabase:', e);
    return false;
  }
}

// Helper to load token from Supabase
async function loadTokenFromSupabase(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Cannot load token: Supabase client not initialized');
    return null;
  }
  
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at
    };
  } catch (e) {
    console.error('Error loading token from Supabase:', e);
    return null;
  }
}

// Helper to verify token
async function verifyToken(token: string) {
  try {
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    const response = await fetch(`${BASE_API_URL}companyinformation`, {
      headers
    });
    
    return response.status === 200;
  } catch (e) {
    console.error('Error verifying token:', e);
    return false;
  }
}

// Helper to refresh token
async function refreshToken(refreshToken: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Cannot refresh token: Supabase client not initialized');
    return null;
  }
  
  try {
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    const response = await fetch('https://apps5.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
      })
    });
    
    if (response.status === 200) {
      const newTokenData = await response.json();
      await saveTokenToSupabase(newTokenData, userId);
      return newTokenData;
    }
    return null;
  } catch (e) {
    console.error('Error refreshing token:', e);
    return null;
  }
}

// Main route handler
export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  // Check if Supabase is properly initialized
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error: Supabase not initialized' }, 
      { status: 500 }
    );
  }
  
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Check if Fortnox token exists
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', session.user.id)
      .single();
    
    if (error) {
      console.error('Error checking Fortnox settings:', error);
      return NextResponse.json({ 
        message: 'Fortnox API Route',
        has_token: false,
        error: 'Failed to check for Fortnox token'
      });
    }
    
    if (!data) {
      return NextResponse.json({ 
        message: 'Fortnox API Route',
        has_token: false 
      });
    }
    
    const accessToken = data.access_token;
    const refreshToken = data.refresh_token;
    const expiresAt = new Date(data.expires_at);
    const now = new Date();
    
    if (!accessToken) {
      return NextResponse.json({ 
        message: 'Fortnox API Route',
        has_token: false,
        needs_reauthorization: true
      });
    }
    
    const isExpired = expiresAt <= now;
    return NextResponse.json({ 
      message: 'Fortnox API Route',
      has_token: true,
      token_expired: isExpired,
      refresh_token_present: !!refreshToken
    });
  } catch (e) {
    console.error('Error checking Fortnox token:', e);
    return NextResponse.json({ 
      message: 'Fortnox API Route',
      has_token: false,
      error: 'Failed to check for Fortnox token'
    });
  }
} 