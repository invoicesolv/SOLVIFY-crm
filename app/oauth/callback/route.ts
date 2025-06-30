import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';

// Fortnox credentials
const CLIENT_ID = '4LhJwn68IpdR';
const CLIENT_SECRET = 'pude4Qk6dK';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';
const TOKEN_URL = 'https://apps.fortnox.se/oauth-v1/token';
// Define the required scopes
const REQUIRED_SCOPES = 'companyinformation invoice customer project bookkeeping payment';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
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

// Helper to save token to Supabase
async function saveTokenToSupabase(token: any, userId: string) {
  try {
    console.log(`Attempting to save Fortnox token for user ID: ${userId}`);
    
    const supabaseAdmin = getSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('Cannot save token: Supabase client not initialized');
      return false;
    }
    
    // Calculate expires_at
    const expiresAt = new Date();
    expiresAt.setSeconds(expiresAt.getSeconds() + token.expires_in);
    
    console.log(`Token will expire at: ${expiresAt.toISOString()}`);
    console.log(`Access token: ${token.access_token ? 'present' : 'missing'}`);
    console.log(`Refresh token: ${token.refresh_token ? 'present' : 'missing'}`);
    console.log(`Token expires in: ${token.expires_in} seconds`);
    console.log(`Token type: ${token.token_type || 'not specified'}`);
    
    // Prepare the data for the settings table based on its actual structure
    // This table has both direct columns and a jsonb settings_data column
    const settingsData = {
      service_name: 'fortnox',
      user_id: userId,
      auth_user_id: userId, // UUID column
      access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString(),
      // Store all data in settings_data as well for redundancy
      settings_data: {
        access_token: token.access_token,
        refresh_token: token.refresh_token,
        expires_at: expiresAt.toISOString(),
        token_type: token.token_type,
        scope: token.scope
      }
    };
    
    // Check if the token already exists
    console.log('Checking if Fortnox token already exists for user...');
    const { data: existingData, error: queryError } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .single();
    
    if (queryError) {
      console.log('No existing token found, will insert new one');
    } else {
      console.log('Existing token found, will update it');
      console.log(`Existing token expires at: ${existingData.expires_at}`);
    }
    
    // Save to Supabase
    console.log('Upserting token into Supabase settings table');
    const { data, error } = await supabaseAdmin
      .from('settings')
      .upsert(settingsData, {
        onConflict: 'service_name,user_id'
      })
      .select();
    
    if (error) {
      console.error('Error saving token to Supabase:', error);
      return false;
    }
    
    console.log('Token successfully saved to Supabase');
    if (data && data.length > 0) {
      console.log('Settings record details:');
      console.log(`- ID: ${data[0].id}`);
      console.log(`- User ID: ${data[0].user_id}`);
      console.log(`- Created at: ${data[0].created_at}`);
      console.log(`- Updated at: ${data[0].updated_at}`);
      console.log(`- Access token exists: ${!!data[0].access_token}`); 
      console.log(`- Refresh token exists: ${!!data[0].refresh_token}`);
      console.log(`- Expires at: ${data[0].expires_at}`);
    } else {
      console.log('No data returned from upsert operation');
    }
    
    return true;
  } catch (e) {
    console.error('Error saving token to Supabase:', e);
    return false;
  }
}

export async function GET(req: NextRequest) {
  // Log that we received a callback
  console.log('Received Fortnox OAuth callback at the correct redirect URI');
  console.log(`Callback URL: ${req.url}`);

  // For OAuth callbacks, we need to handle this differently since the user comes from external OAuth
  // We'll need to check for a state parameter or use cookies to maintain session
  // For now, let's try to get user from cookies or handle this as a special case
  
  // Check if we have a session cookie from Supabase
  const cookieHeader = req.headers.get('cookie');
  let userId: string | null = null;
  
  if (cookieHeader) {
    // Try to extract Supabase session from cookies
    const cookies = cookieHeader.split(';').reduce((acc: any, cookie) => {
      const [key, value] = cookie.trim().split('=');
      acc[key] = value;
      return acc;
    }, {});
    
    // Look for Supabase auth token in cookies
    const supabaseAuthToken = cookies['sb-jbspiufukrifntnwlrts-auth-token'];
    if (supabaseAuthToken) {
      try {
        const tokenData = JSON.parse(decodeURIComponent(supabaseAuthToken));
        if (tokenData && tokenData[0]) {
          const supabaseAdmin = getSupabaseAdmin();
          if (supabaseAdmin) {
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(tokenData[0]);
            if (user && !error) {
              userId = user.id;
              console.log(`Authenticated user from cookie: ${user.email} (ID: ${user.id})`);
            }
          }
        }
      } catch (e) {
        console.error('Error parsing Supabase auth token from cookie:', e);
      }
    }
  }
  
  if (!userId) {
    console.error('No authenticated user found in cookies');
    return NextResponse.json({ error: 'Unauthorized - no session found' }, { status: 401 });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code) {
    return NextResponse.json({ error: 'Authorization code not provided' }, { status: 400 });
  }

  console.log(`Received authorization code: ${code.substring(0, 5)}...`);
  console.log(`State parameter: ${state}`);

  if (state !== 'somestate123') {
    return NextResponse.json({ error: 'Invalid state parameter' }, { status: 400 });
  }

  try {
    const response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'authorization_code',
        'code': code,
        'redirect_uri': REDIRECT_URI,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET,
        'scope': REQUIRED_SCOPES
      })
    });
    
    console.log('Token exchange response status:', response.status);
    
    const tokenData = await response.json();
    
    if ('access_token' in tokenData) {
      console.log('✅ Access token received successfully');
      console.log('Token details:');
      console.log(`- Access token: present`);
      console.log(`- Refresh token: ${tokenData.refresh_token ? 'present' : 'not provided'}`);
      console.log(`- Expires in: ${tokenData.expires_in} seconds`);
      console.log(`- Token type: ${tokenData.token_type}`);
      console.log(`- Scope: ${tokenData.scope || 'not specified'}`);
      
      // Save to Supabase with user ID
      const saveResult = await saveTokenToSupabase(tokenData, userId);
      console.log(`Token save result: ${saveResult ? 'SUCCESS ✅' : 'FAILED ❌'}`);
      
      // After saving, verify token exists in database
      const supabaseAdmin = getSupabaseAdmin();
      if (supabaseAdmin) {
        const { data: verifyData, error: verifyError } = await supabaseAdmin
          .from('settings')
          .select('*')
          .eq('service_name', 'fortnox')
          .eq('user_id', userId)
          .single();
        
        if (verifyError) {
          console.error('Verification query failed:', verifyError);
        } else {
          console.log('✅ Verification successful - token exists in database');
          console.log(`Verified token record ID: ${verifyData.id}`);
          console.log(`Verified token expires at: ${verifyData.expires_at}`);
        }
      }
      
      // Redirect back to the settings page
      console.log('Redirecting user to settings page');
      return NextResponse.redirect(new URL('/settings', req.url));
    } else {
      console.error('❌ Token request failed:', tokenData);
      return NextResponse.json(tokenData, { status: response.status });
    }
  } catch (e) {
    console.error('Error in callback:', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 