import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { getUserFromToken } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';

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

// API endpoint to link a local customer with a Fortnox customer
export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { localId, fortnoxNumber } = body;
    
    if (!localId) {
      return NextResponse.json({ error: 'Local customer ID is required' }, { status: 400 });
    }
    
    if (!fortnoxNumber) {
      return NextResponse.json({ error: 'Fortnox customer number is required' }, { status: 400 });
    }
    
    // Get Fortnox token
    const tokenData = await loadTokenFromSupabase(user.id);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to get Fortnox token' }, { status: 500 });
    }
    
    // Verify the Fortnox customer exists
    console.log(`Verifying Fortnox customer: ${fortnoxNumber}`);
    const url = `${BASE_API_URL}customers/${fortnoxNumber}`;
    
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
        error: `Fortnox customer not found: ${fortnoxNumber}`,
        details: errorText
      }, { status: 404 });
    }
    
    // Get the complete customer data from Fortnox
    const data = await response.json();
    const fortnoxCustomer = data.Customer;
    
    // Update our local customer record with the Fortnox data
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize database client' }, { status: 500 });
    }
    
    // First check if the customer exists
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', localId)
      .maybeSingle();
    
    if (checkError || !existingCustomer) {
      console.error('Error checking local customer:', checkError);
      return NextResponse.json({ 
        error: 'Local customer not found', 
        details: checkError?.message || 'Customer does not exist' 
      }, { status: 404 });
    }
    
    // Update the customer with all available data from Fortnox
    const customerInfo = {
      customer_number: fortnoxCustomer.CustomerNumber,
      email: fortnoxCustomer.Email || existingCustomer.email,
      name: fortnoxCustomer.Name || existingCustomer.name,
      address: fortnoxCustomer.Address1 || existingCustomer.address,
      address2: fortnoxCustomer.Address2 || existingCustomer.address2,
      city: fortnoxCustomer.City || existingCustomer.city,
      zip_code: fortnoxCustomer.ZipCode || existingCustomer.zip_code,
      phone: fortnoxCustomer.Phone || existingCustomer.phone,
      organization_number: fortnoxCustomer.OrganisationNumber || existingCustomer.organization_number,
      country: fortnoxCustomer.CountryCode || existingCustomer.country,
      contact_person: fortnoxCustomer.ContactPerson || existingCustomer.contact_person,
      updated_at: new Date().toISOString()
    };
    
    const { error: updateError } = await supabase
      .from('customers')
      .update(customerInfo)
      .eq('id', localId);
    
    if (updateError) {
      console.error('Error updating customer with Fortnox data:', updateError);
      return NextResponse.json({ 
        error: 'Failed to update customer', 
        details: updateError.message 
      }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      message: `Successfully linked customer ${existingCustomer.name} with Fortnox customer ${fortnoxCustomer.Name} (${fortnoxNumber})`,
      customer: customerInfo
    });
  } catch (error) {
    console.error('Error linking customer:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 