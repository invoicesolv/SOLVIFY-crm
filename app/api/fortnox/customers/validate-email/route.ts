import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';

// Email validation function
function validateEmail(email: any): boolean {
  // Special case: Fortnox rejects '1' as email
  if (email === '1' || email === 1 || email === undefined || email === null || email === '') {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email));
}

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

// Helper function to get customer email from database
async function getCustomerEmailFromDatabase(customerNumber: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return null;
    }
    
    const { data, error } = await supabase
      .from('customers')
      .select('email')
      .eq('customer_number', customerNumber)
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching customer email from database:', error);
      return null;
    }
    
    return data?.email || null;
  } catch (error) {
    console.error('Error getting customer email from database:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get customer number from query parameters
    const searchParams = request.nextUrl.searchParams;
    const customerNumber = searchParams.get('customerNumber');
    
    if (!customerNumber) {
      return NextResponse.json({ error: 'Customer number is required' }, { status: 400 });
    }

    // Get user ID from session or headers
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || request.headers.get('user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    // First check if we have the email in our database
    let customerEmail = await getCustomerEmailFromDatabase(customerNumber);
    
    // If not found in database, get it from Fortnox API
    if (!customerEmail) {
      // Get Fortnox token
      const tokenData = await loadTokenFromSupabase(userId as string);
      if (!tokenData || !tokenData.access_token) {
        return NextResponse.json({ error: 'Failed to get Fortnox token' }, { status: 500 });
      }

      // Call Fortnox API to get customer details
      const url = `${BASE_API_URL}customers/${customerNumber}`;
      
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

      // Get customer data
      const data = await response.json();
      
      if (data.Customer && data.Customer.Email) {
        customerEmail = data.Customer.Email;
        
        // Store email in database for future use
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase.from('customers')
            .upsert({ 
              customer_number: customerNumber,
              email: customerEmail,
              created_at: new Date().toISOString()
            }, {
              onConflict: 'customer_number'
            });
        }
      }
    }
    
    // Check if email is valid
    const isValid = customerEmail ? validateEmail(customerEmail) : false;
    
    return NextResponse.json({
      customerNumber,
      email: customerEmail || null,
      isValid,
      recommended_invoice_type: isValid ? 'INVOICE' : 'OFFER'
    });
  } catch (error) {
    console.error('Error validating customer email:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 