import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';
const CLIENT_ID = '4LhJwn68IpdR';
const CLIENT_SECRET = 'pude4Qk6dK';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';

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
    
    const now = new Date();
    const expiresAt = new Date(data.expires_at);
    
    // Token is expired
    if (expiresAt <= now) {
      return { refresh_token: data.refresh_token };
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

// Helper to refresh token
async function refreshToken(refreshToken: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Cannot refresh token: Supabase client not initialized');
    return null;
  }
  
  try {
    const response = await fetch('https://apps5.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
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
      
      // Calculate expires_at
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in);
      
      // Update token in Supabase
      const { error } = await supabaseAdmin
        .from('settings')
        .upsert({
          service_name: 'fortnox',
          user_id: userId,
          access_token: newTokenData.access_token,
          refresh_token: newTokenData.refresh_token,
          expires_at: expiresAt.toISOString()
        }, {
          onConflict: 'service_name,user_id'
        });
      
      if (error) {
        console.error('Error updating token in Supabase:', error);
        return null;
      }
      
      return {
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: expiresAt.toISOString()
      };
    }
    
    return null;
  } catch (e) {
    console.error('Error refreshing token:', e);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const supabaseAdmin = getSupabaseAdmin();
  // Check if Supabase is properly initialized
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error: Supabase not initialized' }, 
      { status: 500 }
    );
  }

  // Check if the user is authenticated
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  // Load token using user ID
  let tokenData = await loadTokenFromSupabase(session.user.id);
  if (!tokenData) {
    return NextResponse.json({ connected: false });
  }
  
  // Token expired, refresh it
  if (!tokenData.access_token && tokenData.refresh_token) {
    tokenData = await refreshToken(tokenData.refresh_token, session.user.id);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ connected: false });
    }
  }
  
  try {
    // Check if token is valid
    const response = await fetch(`${BASE_API_URL}companyinformation`, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200) {
      const companyInfo = await response.json();
      return NextResponse.json({
        connected: true,
        company_info: companyInfo.CompanyInformation
      });
    }
    
    return NextResponse.json({ connected: false });
  } catch (e) {
    console.error('Error checking status:', e);
    return NextResponse.json({ connected: false });
  }
} 