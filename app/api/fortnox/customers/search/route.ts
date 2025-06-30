import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
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

// Helper function to store customer data in our database
async function storeCustomerData(customerData: any) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return false;
    }
    
    console.log(`Storing data for customer ${customerData.CustomerNumber} in database`);
    
    // Prepare customer data for storage
    const customerInfo = {
      customer_number: customerData.CustomerNumber,
      email: customerData.Email || null,
      name: customerData.Name || null,
      address: customerData.Address1 || null,
      address2: customerData.Address2 || null,
      city: customerData.City || null,
      zip_code: customerData.ZipCode || null,
      phone: customerData.Phone || null,
      organization_number: customerData.OrganisationNumber || null,
      country: customerData.CountryCode || null,
      contact_person: customerData.ContactPerson || null,
      updated_at: new Date().toISOString()
    };
    
    // Check if customer exists in our database
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('customer_number')
      .eq('customer_number', customerData.CustomerNumber)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking if customer exists:', checkError);
      return false;
    }
    
    if (existingCustomer) {
      // Update existing customer
      const { error: updateError } = await supabase
        .from('customers')
        .update(customerInfo)
        .eq('customer_number', customerData.CustomerNumber);
      
      if (updateError) {
        console.error('Error updating customer data:', updateError);
        return false;
      }
    } else {
      // Insert new customer with created_at date
      const { error: insertError } = await supabase
        .from('customers')
        .insert({ 
          ...customerInfo,
          created_at: new Date().toISOString()
        });
      
      if (insertError) {
        console.error('Error inserting customer:', insertError);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error storing customer data:', error);
    return false;
  }
}

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
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

// Find Fortnox customers by name
export async function GET(request: NextRequest) {
  try {
    // Get name from query parameters
    const searchParams = request.nextUrl.searchParams;
    const name = searchParams.get('name');
    const exactMatch = searchParams.get('exact') === 'true';
    const localId = searchParams.get('id'); // Optional local ID to update mapping
    
    if (!name) {
      return NextResponse.json({ error: 'Customer name is required' }, { status: 400 });
    }

    // Get user ID from session or headers
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    // Get Fortnox token
    const tokenData = await loadTokenFromSupabase(user.id);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to get Fortnox token' }, { status: 500 });
    }

    // Build the Fortnox URL for search
    const encodedName = encodeURIComponent(name);
    let url = `${BASE_API_URL}customers?filter=name&name=${encodedName}`;
    
    console.log(`Searching for customers with name: ${name}`);
    
    // Call Fortnox API to search for customers by name
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

    // Get search results
    const data = await response.json();
    
    if (!data.Customers || data.Customers.length === 0) {
      return NextResponse.json({ 
        message: `No customers found with name: ${name}`,
        customers: []
      });
    }
    
    console.log(`Found ${data.Customers.length} customers matching "${name}"`);
    
    // If we're looking for exact matches, filter the results
    let matchedCustomers = data.Customers;
    if (exactMatch) {
      matchedCustomers = data.Customers.filter((customer: any) => 
        customer.Name.toLowerCase() === name.toLowerCase()
      );
      
      console.log(`${matchedCustomers.length} exact matches found`);
    }
    
    // If we have a local ID and found a match, update the mapping
    if (localId && matchedCustomers.length > 0) {
      const supabase = getSupabaseAdmin();
      if (supabase) {
        const bestMatch = matchedCustomers[0]; // Take first match
        
        // Update the customer in the database with the correct Fortnox number
        const { error } = await supabase
          .from('customers')
          .update({
            customer_number: bestMatch.CustomerNumber,
            updated_at: new Date().toISOString()
          })
          .eq('id', localId);
        
        if (error) {
          console.error('Error updating customer Fortnox mapping:', error);
        } else {
          console.log(`Updated customer ${localId} with Fortnox customer number ${bestMatch.CustomerNumber}`);
          
          // Also store the full customer data
          await storeCustomerData(bestMatch);
        }
      }
    }
    
    return NextResponse.json({
      customers: matchedCustomers,
      total: matchedCustomers.length
    });
  } catch (error) {
    console.error('Error searching for customers:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 