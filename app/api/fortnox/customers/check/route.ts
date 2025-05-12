import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox API URL
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
      // Try to get tokens from direct columns first, then from settings_data as fallback
      let accessToken = settingsData.access_token;
      let refreshToken = settingsData.refresh_token;
      let expiresAt = settingsData.expires_at;
      
      // If not in direct columns, try to get from settings_data
      if ((!accessToken || !refreshToken) && settingsData.settings_data) {
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

// Endpoint to check for new customers in Fortnox
export async function GET(request: NextRequest) {
  try {
    // Get user ID from session or headers
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || request.headers.get('user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    // Get Fortnox token
    const tokenData = await loadTokenFromSupabase(userId as string);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to get Fortnox token' }, { status: 500 });
    }

    // Get the supabase client
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize database client' }, { status: 500 });
    }

    // Fetch customers from our database
    const { data: localCustomers, error: localError } = await supabase
      .from('customers')
      .select('customer_number')
      .not('customer_number', 'is', null);

    if (localError) {
      console.error('Error fetching local customers:', localError);
      return NextResponse.json({ error: 'Failed to fetch local customers' }, { status: 500 });
    }

    // Extract customer numbers
    const localCustomerNumbers = (localCustomers || []).map(c => c.customer_number);
    
    // Fetch customers from Fortnox
    const url = `${BASE_API_URL}customers`;  // Removing limit parameter as it might be causing issues
    
    console.log('Checking for new customers in Fortnox');
    
    // Call Fortnox API
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

    // Get all customers from Fortnox
    const data = await response.json();
    
    if (!data.Customers || data.Customers.length === 0) {
      return NextResponse.json({ 
        newCustomerCount: 0,
        message: 'No customers found in Fortnox'
      });
    }
    
    // Find customers in Fortnox that are not in our database
    const newCustomers = data.Customers.filter(customer => 
      !localCustomerNumbers.includes(customer.CustomerNumber)
    );
    
    return NextResponse.json({
      newCustomerCount: newCustomers.length,
      message: newCustomers.length > 0 
        ? `Found ${newCustomers.length} new customer(s) in Fortnox` 
        : 'No new customers found in Fortnox'
    });
  } catch (error) {
    console.error('Error checking for new customers:', error);
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 