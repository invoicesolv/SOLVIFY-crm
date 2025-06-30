import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

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

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

// Helper to load token from Supabase
async function loadTokenFromSupabase(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error loading Fortnox token:', error);
      return null;
    }
    
    return data;
  } catch (e) {
    console.error('Error loading Fortnox token:', e);
    return null;
  }
}

// Helper to save token to Supabase
async function saveTokenToSupabase(token: any, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return false;
  }

  try {
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + token.expires_in);
    
    const settingsData = {
      service_name: 'fortnox',
      user_id: userId,
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt.toISOString()
    };
    
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
async function refreshToken(refreshTokenValue: string, userId: string) {
  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshTokenValue,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }
    
    const newToken = await response.json();
    await saveTokenToSupabase(newToken, userId);
    return newToken;
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
  
  // Get user from JWT token
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if Fortnox token exists
  try {
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', user.id)
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