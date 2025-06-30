import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';

// Define types for Fortnox customer data with comprehensive email fields
interface FortnoxCustomerCard {
  CustomerNumber: string;
  Name: string;
  Email?: string;
  EmailInvoice?: boolean;
  EmailInvoiceBCC?: string;
  EmailInvoiceCC?: string;
  EmailOffer?: boolean;
  EmailOfferBCC?: string;
  EmailOfferCC?: string;
  EmailOrder?: boolean;
  EmailOrderBCC?: string;
  EmailOrderCC?: string;
  Address1?: string;
  Address2?: string;
  City?: string;
  ZipCode?: string;
  Phone1?: string;
  Phone2?: string;
  OrganisationNumber?: string;
  CountryCode?: string;
  ContactPerson?: string;
  Type?: string;
  DefaultDeliveryTypes?: {
    Invoice?: string;
    Order?: string;
    Offer?: string;
  };
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

// Email validation function
function validateEmail(email: any): boolean {
  if (!email || email === '1' || email === 1) {
    return false;
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(String(email));
}

// Store customer complete data in our database
async function storeCustomerData(customerData: FortnoxCustomerCard) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return false;
    }
    
    // Log the raw customer data for debugging email fields
    console.log(`Storing customer card data for ${customerData.CustomerNumber} (${customerData.Name})`);
    console.log(`Email fields from Fortnox:`);
    console.log(`- Main Email: ${customerData.Email || 'NOT PROVIDED'}`);
    console.log(`- EmailInvoice: ${customerData.EmailInvoice}`);
    console.log(`- EmailInvoiceCC: ${customerData.EmailInvoiceCC || 'NOT PROVIDED'}`);
    console.log(`- EmailInvoiceBCC: ${customerData.EmailInvoiceBCC || 'NOT PROVIDED'}`);
    console.log(`- EmailOffer: ${customerData.EmailOffer}`);
    console.log(`- EmailOfferCC: ${customerData.EmailOfferCC || 'NOT PROVIDED'}`);
    console.log(`- EmailOfferBCC: ${customerData.EmailOfferBCC || 'NOT PROVIDED'}`);
    console.log(`- DefaultDeliveryTypes:`, customerData.DefaultDeliveryTypes);
    
    // Clear Postgres schema cache first
    try {
      await supabase.rpc('pg_stat_clear_snapshot');
      console.log('Cleared Postgres schema cache');
    } catch (cacheError) {
      console.error('Error clearing schema cache:', cacheError);
      // Continue anyway
    }
    
    // Validate primary email
    let validatedEmail: string | null = null;
    if (customerData.Email) {
      if (validateEmail(customerData.Email)) {
        validatedEmail = customerData.Email;
      } else {
        console.warn(`Invalid primary email format for customer ${customerData.CustomerNumber}: "${customerData.Email}"`);
      }
    }
    
    // Try to get a valid email from any of the available email fields
    if (!validatedEmail) {
      // Check EmailInvoiceCC
      if (customerData.EmailInvoiceCC && validateEmail(customerData.EmailInvoiceCC)) {
        validatedEmail = customerData.EmailInvoiceCC;
        console.log(`Using EmailInvoiceCC as primary email: ${validatedEmail}`);
      } 
      // Check EmailOfferCC
      else if (customerData.EmailOfferCC && validateEmail(customerData.EmailOfferCC)) {
        validatedEmail = customerData.EmailOfferCC;
        console.log(`Using EmailOfferCC as primary email: ${validatedEmail}`);
      }
    }
    
    // Prepare customer data for storage with all available information
    const customerInfo = {
      customer_number: customerData.CustomerNumber,
      email: validatedEmail,
      name: customerData.Name || null,
      address: customerData.Address1 || null,
      address2: customerData.Address2 || null,
      city: customerData.City || null,
      zip_code: customerData.ZipCode || null,
      phone: customerData.Phone1 || null,
      organization_number: customerData.OrganisationNumber || null,
      country: customerData.CountryCode || null,
      contact_person: customerData.ContactPerson || null,
      // Store additional email fields in a metadata JSON column
      email_metadata: JSON.stringify({
        email_invoice: customerData.EmailInvoice,
        email_invoice_cc: customerData.EmailInvoiceCC || null,
        email_invoice_bcc: customerData.EmailInvoiceBCC || null,
        email_offer: customerData.EmailOffer,
        email_offer_cc: customerData.EmailOfferCC || null,
        email_offer_bcc: customerData.EmailOfferBCC || null,
        email_order: customerData.EmailOrder,
        email_order_cc: customerData.EmailOrderCC || null,
        email_order_bcc: customerData.EmailOrderBCC || null,
        default_delivery_types: customerData.DefaultDeliveryTypes || null
      }),
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

// API endpoint to fetch a customer by ID from Fortnox
export async function GET(request: NextRequest) {
  try {
    // Get customer ID from query parameters
    const searchParams = request.nextUrl.searchParams;
    const customerNumber = searchParams.get('customerNumber');
    
    // Get user ID from session or headers
    const user = await getUserFromToken(request);
    const userId = user?.id || request.headers.get('user-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }

    // Get Fortnox token
    const tokenData = await loadTokenFromSupabase(userId as string);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to get Fortnox token' }, { status: 500 });
    }

    // If customerNumber provided, fetch that specific customer
    if (customerNumber) {
      // Call Fortnox API to get customer details
      const url = `${BASE_API_URL}customers/${encodeURIComponent(customerNumber)}`;
      
      console.log(`Fetching customer card details for ${customerNumber} from Fortnox`);
      
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
        
        // If we have customer data, try to store it in our database
        if (data.Customer) {
          const cardData = data.Customer as FortnoxCustomerCard;
          
          // Log all fields for debugging
          console.log('Customer card data received:', JSON.stringify(cardData, null, 2));
          
          // Store in database in the background
          storeCustomerData(cardData)
            .then(success => {
              if (success) {
                console.log(`Successfully stored card data for customer ${customerNumber}`);
              }
            })
            .catch(error => {
              console.error('Error storing customer card data:', error);
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
    } else {
      // If no customerNumber provided, return an error
      return NextResponse.json({ 
        error: 'Customer number is required',
        details: 'Please provide a customerNumber query parameter'
      }, { status: 400 });
    }
  } catch (error) {
    console.error('Error fetching customer card details:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 });
  }
} 