import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import axios from 'axios';
import { getUserFromToken } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';

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

// Helper function to refresh Fortnox token
async function refreshFortnoxToken(refreshToken: string, userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase admin client');
      return null;
    }
    
    // Fortnox OAuth credentials
    const clientId = process.env.FORTNOX_CLIENT_ID || '4LhJwn68IpdR';
    const clientSecret = process.env.FORTNOX_CLIENT_SECRET || 'pude4Qk6dK';
    
    console.log('Refreshing Fortnox token...');
    
    const response = await fetch('https://apps.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': clientId,
        'client_secret': clientSecret
      })
    });
    
    if (!response.ok) {
      console.error(`Error refreshing token: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const newTokenData = await response.json();
    
    // Calculate expires_at
    const expiresAt = new Date();
    const oneWeekInSeconds = 7 * 24 * 60 * 60; // 1 week in seconds
    const expiresInSeconds = newTokenData.expires_in || oneWeekInSeconds;
    // Use the longer of either the provided expires_in or one week
    const effectiveExpiresIn = Math.max(expiresInSeconds, oneWeekInSeconds);
    expiresAt.setSeconds(expiresAt.getSeconds() + effectiveExpiresIn);
    
    // Update both places where tokens might be stored
    
    // 1. Try to update the settings table
    const { error: settingsError } = await supabase
      .from('settings')
      .upsert({
        service_name: 'fortnox',
        user_id: userId,
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
        // Store all data in settings_data as well
        settings_data: {
          access_token: newTokenData.access_token,
          refresh_token: newTokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
          token_type: newTokenData.token_type,
          scope: newTokenData.scope
        }
      }, {
        onConflict: 'service_name,user_id'
      });
    
    if (settingsError) {
      console.error('Error updating token in settings table:', settingsError);
    } else {
      console.log('Successfully updated token in settings table');
    }
    
    // 2. Try to update the user_fortnox_tokens table
    const { error: tokensError } = await supabase
      .from('user_fortnox_tokens')
      .upsert({
        user_id: userId,
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (tokensError) {
      console.error('Error updating token in user_fortnox_tokens table:', tokensError);
    } else {
      console.log('Successfully updated token in user_fortnox_tokens table');
    }
    
    return {
      access_token: newTokenData.access_token,
      refresh_token: newTokenData.refresh_token,
      expires_at: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('Error refreshing Fortnox token:', error);
    return null;
  }
}

// Helper function to get a Fortnox client for API access
async function getFortnoxClient(userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase admin client');
      return null;
    }
    
    // First try to get token from settings table
    const { data: settingsData, error: settingsError } = await supabase
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .maybeSingle();
    
    let tokenData: { access_token?: string; refresh_token?: string; expires_at?: string } | null = null;
    
    if (settingsData) {
      console.log('Found Fortnox token in settings table');
      
      // Try to get tokens from direct columns first, then from settings_data as fallback
      let accessToken = settingsData.access_token;
      let refreshToken = settingsData.refresh_token;
      
      // If not in direct columns, try to get from settings_data
      if ((!accessToken || !refreshToken) && settingsData.settings_data) {
        if (typeof settingsData.settings_data === 'string') {
          try {
            // If settings_data is stored as string, parse it
            const parsedData = JSON.parse(settingsData.settings_data);
            accessToken = accessToken || parsedData.access_token;
            refreshToken = refreshToken || parsedData.refresh_token;
          } catch (e) {
            console.error('Failed to parse settings_data string:', e);
          }
        } else if (typeof settingsData.settings_data === 'object' && settingsData.settings_data !== null) {
          // If settings_data is already an object
          accessToken = accessToken || settingsData.settings_data.access_token;
          refreshToken = refreshToken || settingsData.settings_data.refresh_token;
        }
      }
      
      if (accessToken) {
        tokenData = { 
          access_token: accessToken,
          refresh_token: refreshToken 
        };
      } else if (refreshToken) {
        // We have a refresh token but no access token, try to refresh
        tokenData = { refresh_token: refreshToken };
      }
    }
    
    // If not found in settings, fallback to user_fortnox_tokens
    if (!tokenData) {
      console.log('Token not found in settings, checking user_fortnox_tokens table');
      const { data: fortnoxTokenData, error: tokenError } = await supabase
        .from('user_fortnox_tokens')
        .select('access_token, refresh_token, expires_at')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (!tokenError && fortnoxTokenData) {
        if (fortnoxTokenData.access_token) {
          tokenData = fortnoxTokenData;
        } else if (fortnoxTokenData.refresh_token) {
          // We have a refresh token but no access token
          tokenData = { refresh_token: fortnoxTokenData.refresh_token };
        }
      }
    }
    
    if (!tokenData) {
      console.error('No Fortnox token found for user:', userId);
      return null;
    }
    
    // If we have a refresh token but no access token, try to refresh
    if (tokenData.refresh_token && !tokenData.access_token) {
      console.log('Access token missing but refresh token found. Attempting to refresh...');
      const refreshedToken = await refreshFortnoxToken(tokenData.refresh_token, userId);
      
      if (refreshedToken && refreshedToken.access_token) {
        console.log('Successfully refreshed token');
        tokenData = refreshedToken;
      } else {
        console.error('Failed to refresh token');
        return null;
      }
    }
    
    // Final check for access token
    if (!tokenData.access_token) {
      console.error('No valid access token available for user:', userId);
      return null;
    }
    
    // Create and return an axios client configured for Fortnox API
    return axios.create({
      baseURL: 'https://api.fortnox.se/3',
      headers: {
        'Access-Token': tokenData.access_token,
        'Client-Secret': process.env.FORTNOX_CLIENT_SECRET || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error creating Fortnox client:', error);
    return null;
  }
}

export const dynamic = 'force-dynamic';

/**
 * Fetches the most recent invoices from Fortnox
 * 
 * This endpoint is used as a fallback when a project has no Fortnox project number
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('\n=== Fetching Recent Fortnox Invoices ===');
    
    // Get search parameters
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get('limit') || '10';
    
    const fortnoxClient = await getFortnoxClient(user.id);
    if (!fortnoxClient) {
      console.error('Failed to initialize Fortnox client for user:', user.id);
      return Response.json({ 
        error: "Failed to initialize Fortnox client", 
        details: "Check if you have valid Fortnox tokens in your user_fortnox_tokens table" 
      }, { status: 500 });
    }
    
    // Get today's date and 30 days ago
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);
    
    // Format dates as YYYY-MM-DD
    const toDate = today.toISOString().split('T')[0];
    const fromDate = thirtyDaysAgo.toISOString().split('T')[0];
    
    // Fetch recent invoices
    console.log(`Fetching invoices from ${fromDate} to ${toDate}, limit: ${limit}`);
    try {
      const response = await fortnoxClient.get(`/invoices?sortby=invoicedate&sortorder=descending&limit=${limit}&fromdate=${fromDate}&todate=${toDate}`);
      
      if (response.status !== 200) {
        console.error(`Error fetching invoices: ${response.status} ${response.statusText}`);
        return Response.json({ 
          error: "Failed to fetch invoices from Fortnox", 
          status: response.status, 
          statusText: response.statusText 
        }, { status: response.status });
      }
      
      const invoices = response.data.Invoices || [];
      
      // Return the formatted invoices
      return Response.json({
        Invoices: invoices
      });
    } catch (axiosError: any) {
      console.error("Axios error fetching invoices:", axiosError.message);
      if (axiosError.response) {
        console.error("Response data:", axiosError.response.data);
        console.error("Response status:", axiosError.response.status);
        return Response.json({
          error: "Error from Fortnox API",
          status: axiosError.response.status,
          details: axiosError.response.data
        }, { status: axiosError.response.status });
      }
      throw axiosError;
    }
  } catch (error: any) {
    console.error("Error fetching recent invoices:", error.message);
    return Response.json({ 
      error: "Failed to fetch recent invoices", 
      details: error.message 
    }, { status: 500 });
  }
} 