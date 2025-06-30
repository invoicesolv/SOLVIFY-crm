import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { getUserFromToken } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';

// Fortnox API base URL
const BASE_API_URL = 'https://api.fortnox.se/3/';

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

// Helper function to load token from Supabase
async function loadTokenFromSupabase(userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }

    // Check the settings table first (where OAuth callback stores tokens)
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (settingsData) {
      console.log('Found Fortnox token in settings table');
      
      // Try to get tokens from direct columns first, then from settings_data as fallback
      let accessToken = settingsData.access_token;
      let refreshToken = settingsData.refresh_token;
      let expiresAt = settingsData.expires_at;
      
      // If not in direct columns, try to get from settings_data
      if ((!accessToken || !refreshToken) && settingsData.settings_data) {
        console.log('Tokens not found in direct columns, checking settings_data');
        
        if (typeof settingsData.settings_data === 'string') {
          try {
            // If settings_data is stored as string, parse it
            const parsedData = JSON.parse(settingsData.settings_data);
            accessToken = accessToken || parsedData.access_token;
            refreshToken = refreshToken || parsedData.refresh_token;
            expiresAt = expiresAt || parsedData.expires_at;
          } catch (e) {
            console.error('Failed to parse settings_data string:', e);
          }
        } else if (typeof settingsData.settings_data === 'object' && settingsData.settings_data !== null) {
          // If settings_data is already an object
          accessToken = accessToken || settingsData.settings_data.access_token;
          refreshToken = refreshToken || settingsData.settings_data.refresh_token;
          expiresAt = expiresAt || settingsData.settings_data.expires_at;
        }
      }
      
      if (accessToken && refreshToken) {
        return {
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_at: expiresAt
        };
      }
    }

    // If not found in settings, fallback to check user_fortnox_tokens
    console.log('Token not found in settings, checking user_fortnox_tokens table');
    const { data: tokenData, error: tokenError } = await supabase
      .from('user_fortnox_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (tokenError || !tokenData) {
      console.error('No token found for user in either table:', userId);
      return null;
    }

    return tokenData;
  } catch (error) {
    console.error('Error in loadTokenFromSupabase:', error);
    return null;
  }
}

export async function GET(
  request: NextRequest
) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get project number from query parameters
    const searchParams = request.nextUrl.searchParams;
    const projectNumber = searchParams.get('projectNumber');
    
    if (!projectNumber) {
      return NextResponse.json({ error: 'Project number is required' }, { status: 400 });
    }

    // Load Fortnox token
    const tokenData = await loadTokenFromSupabase(user.id);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to get Fortnox token' }, { status: 500 });
    }

    // Call Fortnox API to get project details
    const url = `${BASE_API_URL}projects/${projectNumber}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Fortnox API error: ${response.status} - ${errorText}`);
      return NextResponse.json({ 
        error: `Fortnox API error: ${response.status}`,
        details: errorText
      }, { status: response.status });
    }

    // Return project data
    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching project details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 