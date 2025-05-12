import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

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

// Store customer email in our database if available
async function storeCustomerEmail(customerNumber: string, customerData: any) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return false;
    }
    
    console.log(`Storing data for customer ${customerNumber} in database`);
    
    // Clear Postgres schema cache first to avoid column not found errors
    try {
      await supabase.rpc('pg_stat_clear_snapshot');
      console.log('Cleared Postgres schema cache');
    } catch (cacheError) {
      console.error('Error clearing schema cache:', cacheError);
      // Continue anyway
    }
    
    // Check if customer exists in our database
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('id, customer_number, email')
      .eq('customer_number', customerNumber)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking if customer exists:', checkError);
      return false;
    }
    
    // Validate email to avoid errors like "1 är inte en giltig e-postadress" (code 2000357)
    let validatedEmail: string | null = null;
    if (customerData.Email) {
      // Basic email validation (contains @ and at least one dot after @)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(customerData.Email)) {
        validatedEmail = customerData.Email;
      } else {
        console.warn(`Invalid email format for customer ${customerNumber}: "${customerData.Email}"`);
      }
    }
    
    // Prepare customer data for storage
    const customerInfo = {
      customer_number: customerNumber,
      email: validatedEmail, // Use validated email instead of raw email
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
    
    if (existingCustomer) {
      // Keep existing email if Fortnox doesn't have a valid one
      if (existingCustomer.email && !validatedEmail) {
        console.log(`Keeping existing email ${existingCustomer.email} for customer ${customerNumber} as Fortnox has no valid email`);
        customerInfo.email = existingCustomer.email;
      }
      
      // Update existing customer by ID rather than customer_number for more reliability
      const { error: updateError } = await supabase
        .from('customers')
        .update(customerInfo)
        .eq('id', existingCustomer.id);
      
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

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get customer ID from path parameter
    const customerId = params.id;
    
    if (!customerId) {
      return NextResponse.json({ error: 'Customer ID is required' }, { status: 400 });
    }

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

    // Call Fortnox API to get customer details
    const url = `${BASE_API_URL}customers/${encodeURIComponent(customerId)}`;
    
    console.log(`Fetching customer details for ${customerId} from Fortnox`);
    
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
  
      if (!response.ok) {
        // Handle different error status codes
        if (response.status === 429) {
          return NextResponse.json({ 
            error: 'Fortnox API rate limit exceeded. Please try again later.',
            details: 'Too Many Requests (429)'
          }, { status: 429 });
        }
        
        if (response.status === 404) {
          // For 404, see if we can find the customer in our database instead
          const supabase = getSupabaseAdmin();
          if (supabase) {
            // Try to find customer by UUID in our database
            const { data: localCustomer, error: localError } = await supabase
              .from('customers')
              .select('*')
              .eq('id', customerId)
              .maybeSingle();
              
            if (!localError && localCustomer) {
              console.log(`Customer not found in Fortnox, but found in local database: ${customerId}`);
              return NextResponse.json({ 
                Customer: {
                  ...localCustomer,
                  fromLocalDatabase: true
                },
                metadata: {
                  warning: 'Customer not found in Fortnox, showing data from local database'
                }
              });
            }
          }
        }
        
        // For other errors, try to parse the response as text first
        const errorText = await response.text();
        let errorDetails;
        
        try {
          // Try to parse as JSON if possible
          errorDetails = JSON.parse(errorText);
        } catch (e) {
          // If not valid JSON, use as plain text
          errorDetails = errorText;
        }
        
        console.error(`Fortnox API error: ${response.status} - ${typeof errorDetails === 'string' ? errorDetails : JSON.stringify(errorDetails)}`);
        
        return NextResponse.json({ 
          error: `Fortnox API error: ${response.status}`,
          details: errorDetails
        }, { status: response.status });
      }
  
      // Ensure we received valid JSON before parsing
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        return NextResponse.json({ 
          error: 'Fortnox API returned non-JSON response',
          details: await response.text()
        }, { status: 500 });
      }
  
      // Get customer data
      const data = await response.json();
      
      // Store customer data in our database if available
      if (data.Customer) {
        storeCustomerEmail(customerId, data.Customer)
          .then(success => {
            if (success) {
              console.log(`Successfully stored data for customer ${customerId}`);
            }
          })
          .catch(error => {
            console.error('Error storing customer data:', error);
          });
      }
      
      return NextResponse.json(data);
    } catch (apiError) {
      console.error('Error calling Fortnox API:', apiError);
      return NextResponse.json({ 
        error: 'Error calling Fortnox API',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error fetching customer details:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 