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

// Helper function to store customer emails in batch
async function storeCustomerEmails(customers: any[], workspaceId: string, userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase client');
      return { success: 0, failed: customers.length };
    }
    
    // Clear Postgres schema cache first
    try {
      await supabase.rpc('pg_stat_clear_snapshot');
      console.log('Cleared Postgres schema cache');
    } catch (cacheError) {
      console.error('Error clearing schema cache:', cacheError);
      // Continue anyway
    }
    
    // Log the initial count of customers with emails
    console.log(`Processing ${customers.length} customers with emails`);
    
    // Filter out any customers without CustomerNumber or Email
    const validCustomers = customers.filter(customer => {
      const hasCustomerNumber = Boolean(customer.CustomerNumber);
      const hasEmail = Boolean(customer.Email);
      
      if (!hasCustomerNumber) {
        console.log(`Skipping customer without CustomerNumber: ${customer.Name || 'Unknown'}`);
      }
      if (!hasEmail) {
        console.log(`Skipping customer without Email: ${customer.Name || 'Unknown'}`);
      }
      
      return hasCustomerNumber && hasEmail;
    });
    
    console.log(`After filtering, ${validCustomers.length} valid customers with both CustomerNumber and Email remain`);
    
    // Prepare data for upsert
    const upsertData = validCustomers.map(customer => ({
        customer_number: customer.CustomerNumber,
        email: customer.Email,
        name: customer.Name || null,
        address: customer.Address1 || null,
        address2: customer.Address2 || null,
        city: customer.City || null,
        zip_code: customer.ZipCode || null,
        phone: customer.Phone || null,
        organization_number: customer.OrganisationNumber || null,
        country: customer.CountryCode || null,
        contact_person: customer.ContactPerson || null,
      workspace_id: workspaceId,
      user_id: userId,
        updated_at: new Date().toISOString()
      }));
    
    if (upsertData.length === 0) {
      return { success: 0, failed: 0, updated: 0, inserted: 0 };
    }
    
    console.log(`Attempting to store ${upsertData.length} customer records with emails`);
    
    // First, get existing customers to check for duplicates
    const { data: existingCustomers, error: fetchError } = await supabase
          .from('customers')
      .select('id, customer_number, email')
      .eq('workspace_id', workspaceId)
      .in('customer_number', upsertData.map(c => c.customer_number));
        
    if (fetchError) {
      console.error('Error fetching existing customers:', fetchError);
      return { success: 0, failed: upsertData.length, updated: 0, inserted: 0 };
    }
    
    // Create maps for faster lookup
    const existingCustomerMap = new Map();
    existingCustomers?.forEach(customer => {
      existingCustomerMap.set(customer.customer_number, customer);
    });
    
    // Define types for our update and insert arrays
    type CustomerUpdate = typeof upsertData[0] & { id: string };
    type CustomerInsert = typeof upsertData[0] & { created_at: string };
    
    // Split into updates and inserts
    const customersToUpdate: CustomerUpdate[] = [];
    const customersToInsert: CustomerInsert[] = [];
    
    for (const customer of upsertData) {
      const existing = existingCustomerMap.get(customer.customer_number);
      if (existing) {
        customersToUpdate.push({
          ...customer,
          id: existing.id
        });
      } else {
        customersToInsert.push({
          ...customer,
          created_at: new Date().toISOString()
        });
      }
    }
    
    console.log(`Found ${customersToUpdate.length} customers to update and ${customersToInsert.length} to insert`);
    
    let updatedCount = 0;
    let insertedCount = 0;
    
    // Process updates in batches of 50 to avoid timeouts
    if (customersToUpdate.length > 0) {
      // Update existing customers with email data
      for (let i = 0; i < customersToUpdate.length; i += 50) {
        const batch = customersToUpdate.slice(i, i + 50);
          const { error: updateError } = await supabase
            .from('customers')
          .upsert(batch, {
            onConflict: 'id'
          });
          
          if (updateError) {
          console.error('Error updating customers batch:', updateError);
        } else {
          updatedCount += batch.length;
        }
      }
    }
    
    // Process inserts in batches of 50
    if (customersToInsert.length > 0) {
      for (let i = 0; i < customersToInsert.length; i += 50) {
        const batch = customersToInsert.slice(i, i + 50);
          const { error: insertError } = await supabase
            .from('customers')
          .insert(batch);
          
          if (insertError) {
          console.error('Error inserting customers batch:', insertError);
          } else {
          insertedCount += batch.length;
          }
        }
    }
    
    const successCount = updatedCount + insertedCount;
    console.log(`Successfully processed ${successCount} customers (${updatedCount} updated, ${insertedCount} inserted)`);
    
    return { 
      success: successCount, 
      failed: upsertData.length - successCount,
      updated: updatedCount,
      inserted: insertedCount
    };
  } catch (error) {
    console.error('Error storing customer emails:', error);
    return { success: 0, failed: customers.length, updated: 0, inserted: 0 };
  }
}

export async function POST(req: NextRequest) {
  try {
    console.log('Starting customer email sync from Fortnox');
    
    // Get user ID from session or headers
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id || req.headers.get('user-id');
    const workspaceId = req.headers.get('workspace-id');
    
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Workspace ID is required' }, { status: 400 });
    }
    
    // Get Fortnox token
    const tokenData = await loadTokenFromSupabase(userId as string);
    if (!tokenData || !tokenData.access_token) {
      return NextResponse.json({ error: 'Failed to get Fortnox token' }, { status: 500 });
    }
    
    let allCustomers: any[] = [];
    let lastPage = '1';
    let hasMorePages = true;
    let attempts = 0;
    const maxAttempts = 5; // Limit pages to fetch to avoid timeout
    
    // Paginate through customers with rate limiting
    while (hasMorePages && attempts < maxAttempts) {
      attempts++;
      
      // Call Fortnox API to get customers
      const url = `${BASE_API_URL}customers?page=${lastPage}&limit=50`; // Reduce page size to 50
      
      try {
        console.log(`Fetching customers page ${lastPage}`);
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          // Handle rate limiting
          if (response.status === 429) {
            console.log('Rate limit hit, waiting 2 seconds...');
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue; // Retry same page
          }
          
          const errorText = await response.text();
          console.error(`Fortnox API error: ${response.status} - ${errorText}`);
          return NextResponse.json({ 
            error: `Fortnox API error: ${response.status}`,
            details: errorText
          }, { status: response.status });
        }
        
        // Ensure response is valid JSON
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          return NextResponse.json({ 
            error: 'Fortnox API returned non-JSON response',
            details: await response.text()
          }, { status: 500 });
        }
        
        // Get customer data
        const data = await response.json();
        
        // Add current page customers to collection
        if (data.Customers && Array.isArray(data.Customers)) {
          allCustomers = [...allCustomers, ...data.Customers];
          console.log(`Added ${data.Customers.length} customers from page ${lastPage}, total: ${allCustomers.length}`);
        }
        
        // Check if there are more pages
        const totalPages = data.MetaInformation?.TotalPages || 1;
        const currentPage = parseInt(lastPage);
        
        if (currentPage < totalPages) {
          lastPage = (currentPage + 1).toString();
          
          // Add a small delay between requests to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 500));
        } else {
          hasMorePages = false;
        }
      } catch (pageError) {
        console.error(`Error fetching page ${lastPage}:`, pageError);
        
        // Wait a bit longer before retrying
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // If we've retried this page more than once, move on
        if (attempts > 1) {
          lastPage = (parseInt(lastPage) + 1).toString();
        }
      }
    }
    
    console.log(`Fetched ${allCustomers.length} customers from Fortnox`);
    
    // Filter customers with emails
    const customersWithEmail = allCustomers.filter(customer => customer.Email);
    console.log(`Found ${customersWithEmail.length} customers with email addresses`);
    
    // Store customer emails in database
    const result = await storeCustomerEmails(customersWithEmail, workspaceId as string, userId as string);
    
    return NextResponse.json({
      success: result.success,
      failed: result.failed,
      updated: result.updated,
      inserted: result.inserted,
      total_customers: allCustomers.length,
      customers_with_email: customersWithEmail.length,
      pages_processed: attempts
    });
  } catch (error) {
    console.error('Error in customer email sync:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An error occurred' },
      { status: 500 }
    );
  }
} 