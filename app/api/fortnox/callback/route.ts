import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox credentials
const CLIENT_ID = '4LhJwn68IpdR';
const CLIENT_SECRET = 'pude4Qk6dK';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';
const TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/token';
// Define all required scopes
const REQUIRED_SCOPES = ['companyinformation', 'invoice', 'customer', 'project', 'bookkeeping', 'payment'];

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
    const oneWeekInSeconds = 7 * 24 * 60 * 60; // 1 week in seconds
    const expiresInSeconds = token.expires_in || oneWeekInSeconds;
    // Use the longer of either the provided expires_in or one week
    const effectiveExpiresIn = Math.max(expiresInSeconds, oneWeekInSeconds);
    expiresAt.setSeconds(expiresAt.getSeconds() + effectiveExpiresIn);
    
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

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Authorization code not provided' }, { status: 400 });
  }

  if (state !== 'somestate123') {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
  }

  try {
    const basicAuth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64');
    
    // Request all necessary scopes
    const scopeStr = REQUIRED_SCOPES.join(' ');
    
    const requestData = new URLSearchParams({
      'grant_type': 'authorization_code',
      'code': code,
      'redirect_uri': REDIRECT_URI,
      'scope': scopeStr
    });
    
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: requestData
    });
    
    const tokenData = await response.json();
    
    if ('access_token' in tokenData) {
      console.log('Access token received');
      
      // Save to Supabase with user ID
      await saveTokenToSupabase(tokenData, session.user.id);
      
      // Redirect back to the settings page
      return NextResponse.redirect(new URL('/settings', req.url));
    } else {
      console.error('Token request failed:', tokenData);
      return NextResponse.json(tokenData, { status: response.status });
    }
  } catch (e) {
    console.error('Error in callback:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 