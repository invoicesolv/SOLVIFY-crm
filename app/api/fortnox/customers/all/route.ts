import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';

// Define types for Fortnox customer data
interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
  Email?: string;
  EmailInvoice?: boolean;
  DefaultDeliveryTypes?: any;
  Address1?: string;
  Address2?: string;
  City?: string;
  ZipCode?: string;
  Phone?: string;
  OrganisationNumber?: string;
  CountryCode?: string;
  ContactPerson?: string;
  [key: string]: any; // Allow other properties from Fortnox
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

// Helper function to store customer data in our database
async function storeCustomerData(customerData: FortnoxCustomer) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return false;
    }
    
    // Log the raw customer data for debugging email fields
    console.log(`Storing customer data for ${customerData.CustomerNumber} (${customerData.Name})`);
    console.log(`Email field from Fortnox: ${customerData.Email || 'NOT PROVIDED'}`);
    console.log(`EmailInvoice setting: ${customerData.EmailInvoice}`);
    console.log(`DefaultDeliveryTypes:`, customerData.DefaultDeliveryTypes);
    
    // Clear Postgres schema cache first to avoid "Could not find the 'address2' column of 'customers'" error
    try {
      await supabase.rpc('pg_stat_clear_snapshot');
      console.log('Cleared Postgres schema cache');
    } catch (cacheError) {
      console.error('Error clearing schema cache:', cacheError);
      // Continue anyway
    }
    
    // Validate email to avoid errors like "1 är inte en giltig e-postadress" (code 2000357)
    let validatedEmail: string | null = null;
    if (customerData.Email) {
      // Basic email validation (contains @ and at least one dot after @)
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (emailRegex.test(customerData.Email)) {
        validatedEmail = customerData.Email;
      } else {
        console.warn(`Invalid email format for customer ${customerData.CustomerNumber}: "${customerData.Email}"`);
      }
    }
    
    // Prepare customer data for storage
    const customerInfo = {
      customer_number: customerData.CustomerNumber,
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
    
    // Check if customer exists in our database by customer number
    const { data: existingCustomer, error: checkError } = await supabase
      .from('customers')
      .select('id, customer_number, email')
      .eq('customer_number', customerData.CustomerNumber)
      .maybeSingle();
    
    if (checkError) {
      console.error('Error checking if customer exists by customer number:', checkError);
      return false;
    }
    
    if (existingCustomer) {
      // Update existing customer
      // If we already have an email and Fortnox doesn't have a valid one, keep our email
      if (existingCustomer.email && !validatedEmail) {
        console.log(`Keeping existing email ${existingCustomer.email} for customer ${customerData.Name} as Fortnox has no valid email`);
        customerInfo.email = existingCustomer.email;
      }
      
      const { error: updateError } = await supabase
        .from('customers')
        .update(customerInfo)
        .eq('id', existingCustomer.id);
      
      if (updateError) {
        console.error('Error updating customer data:', updateError);
        return false;
      }
      
      return true;
    }
    
    // If not found by customer number, check if we can find by name as a fallback
    const { data: nameMatchCustomers, error: nameCheckError } = await supabase
      .from('customers')
      .select('id, customer_number, name, email')
      .eq('name', customerData.Name)
      .is('customer_number', null);
    
    if (nameCheckError) {
      console.error('Error checking if customer exists by name:', nameCheckError);
    } else if (nameMatchCustomers && nameMatchCustomers.length > 0) {
      // Update the first matching customer by name that doesn't have a customer number
      const matchedCustomer = nameMatchCustomers[0];
      
      // If we already have an email and Fortnox doesn't have a valid one, keep our email
      if (matchedCustomer.email && !validatedEmail) {
        console.log(`Keeping existing email ${matchedCustomer.email} for customer ${customerData.Name} as Fortnox has no valid email`);
        customerInfo.email = matchedCustomer.email;
      }
      
      const { error: updateError } = await supabase
        .from('customers')
        .update(customerInfo)
        .eq('id', matchedCustomer.id);
      
      if (updateError) {
        console.error('Error updating customer data by name match:', updateError);
      } else {
        console.log(`Updated customer by name match: ${customerData.Name}`);
        return true;
      }
    }
    
    // If no existing customer found or update failed, insert as new
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
    
    return true;
  } catch (error) {
    console.error('Error storing customer data:', error);
    return false;
  }
}

// Fetch all customers and sync with our database
export async function GET(request: NextRequest) {
  try {
    // Get user ID from session or headers
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || request.headers.get('user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    // Get pagination parameters from query string
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = Math.min(parseInt(searchParams.get('pageSize') || '5'), 5); // Limit to max 5 per page for Vercel timeout
    
    // Get Fortnox token
    const tokenData = await loadTokenFromSupabase(userId as string);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to get Fortnox token' }, { status: 500 });
    }

    // Build the Fortnox URL for fetching customers with pagination
    // Fortnox uses page for offset based pagination
    const url = `${BASE_API_URL}customers?page=${page}&limit=500`;
    
    console.log(`Fetching customers from Fortnox (page ${page}, pageSize ${pageSize})`);
    
    try {
      // Call Fortnox API with simpler error handling
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        // Handle common Fortnox API errors
        if (response.status === 429) {
          return NextResponse.json({ 
            error: 'Fortnox API rate limit exceeded. Please try again later.',
            details: 'Too Many Requests (429)'
          }, { status: 429 });
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
      
      // Get all customers
      const data = await response.json();
      
      if (!data.Customers || data.Customers.length === 0) {
        return NextResponse.json({ 
          message: 'No customers found in Fortnox',
          customers: []
        });
      }
      
      // Calculate pagination info
      const totalCustomers = data.Customers.length;
      const totalPages = Math.ceil(totalCustomers / pageSize);
      
      console.log(`Found ${totalCustomers} customers in Fortnox (page ${page} of ${totalPages})`);
      
      // Calculate which slice of customers to process for this page
      const startIndex = 0; // Always start with first customer in the response
      const endIndex = Math.min(startIndex + pageSize, totalCustomers);
      const customersToProcess = data.Customers.slice(startIndex, endIndex) as FortnoxCustomer[];
      
      console.log(`Processing ${customersToProcess.length} customers in this run (to avoid timeouts)`);
      
      // Process customers sequentially with rate limiting
      const delayBetweenRequests = 300; // 300ms delay between individual requests
      const results: boolean[] = [];
      
      for (const customer of customersToProcess) {
        try {
          // Process one customer at a time
          console.log(`Processing customer ${customer.CustomerNumber} (${customer.Name})`);
          
          // Use the new cards endpoint to fetch complete customer data
          const cardEndpoint = `/api/fortnox/customers/cards?customerNumber=${customer.CustomerNumber}`;
          const cardResponse = await fetch(new URL(cardEndpoint, request.url), {
            method: 'GET',
            headers: {
              'user-id': userId as string,
              'Accept': 'application/json',
              'Content-Type': 'application/json'
            }
          });
          
          if (!cardResponse.ok) {
            console.error(`Failed to fetch details for customer ${customer.CustomerNumber}: ${cardResponse.status}`);
            
            // Fallback to using the basic customer data if cards endpoint fails
            const success = await storeCustomerData(customer);
            results.push(success);
          } else {
            // Card endpoint successfully processed the customer
            results.push(true);
          }
          
          // Wait between individual API requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, delayBetweenRequests));
        } catch (error) {
          console.error(`Error processing customer ${customer.CustomerNumber}:`, error);
          results.push(false);
        }
      }
      
      const successCount = results.filter(Boolean).length;
      const failedCount = results.length - successCount;
      
      // Check if we're missing emails
      const customersWithoutEmail = customersToProcess.filter(customer => !customer.Email || customer.Email === '').length;
      
      return NextResponse.json({
        message: `Successfully processed ${successCount} out of ${customersToProcess.length} customers`,
        pagination: {
          page,
          pageSize,
          totalCustomers,
          totalPages,
          hasMore: page < totalPages
        },
        processed: customersToProcess.length,
        success: successCount,
        failed: failedCount,
        customersWithoutEmail,
        nextPage: page < totalPages ? page + 1 : null
      });
    } catch (apiError) {
      console.error('Error calling Fortnox API:', apiError);
      return NextResponse.json({ 
        error: 'Error calling Fortnox API',
        details: apiError instanceof Error ? apiError.message : 'Unknown error'
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error fetching all customers:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 