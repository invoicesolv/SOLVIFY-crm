import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
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

// Helper to load token from Supabase
async function loadTokenFromSupabase(userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Cannot load token: Supabase client not initialized');
    return null;
  }
  
  try {
    console.log(`Attempting to load Fortnox token for user ID: ${userId}`);
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .single();
    
    if (error) {
      console.error('Error retrieving Fortnox token from database:', error.message);
      return null;
    }
    
    if (!data) {
      console.error('No Fortnox token found for user');
      return null;
    }
    
    // Try to get tokens from direct columns first, then from settings_data as fallback
    let accessToken = data.access_token;
    let refreshToken = data.refresh_token;
    let expiresAt = data.expires_at;
    
    // If not in direct columns, try to get from settings_data
    if ((!accessToken || !refreshToken) && data.settings_data) {
      console.log('Tokens not found in direct columns, checking settings_data');
      
      if (typeof data.settings_data === 'string') {
        try {
          // If settings_data is stored as string, parse it
          const settingsData = JSON.parse(data.settings_data);
          accessToken = accessToken || settingsData.access_token;
          refreshToken = refreshToken || settingsData.refresh_token;
          expiresAt = expiresAt || settingsData.expires_at;
        } catch (e) {
          console.error('Failed to parse settings_data string:', e);
        }
      } else if (typeof data.settings_data === 'object' && data.settings_data !== null) {
        // If settings_data is already an object
        accessToken = accessToken || data.settings_data.access_token;
        refreshToken = refreshToken || data.settings_data.refresh_token;
        expiresAt = expiresAt || data.settings_data.expires_at;
      }
    }
    
    console.log(`Fortnox token found. Access token: ${accessToken ? 'present' : 'missing'}`);
    
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      expires_at: expiresAt
    };
  } catch (e) {
    console.error('Error loading token from Supabase:', e);
    return null;
  }
}

// Helper function to fetch invoices for a year
async function fetchInvoicesForYear(tokenData: any, year: number) {
  if (!tokenData || !tokenData.access_token) {
    console.error('No valid token provided to fetchInvoices');
    throw new Error('No valid token provided');
  }
  
  console.log(`Fetching invoices for year ${year} with access token`);
  
  try {
    // Construct the URL for the whole year
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const baseUrl = `${BASE_API_URL}invoices?fromdate=${startDate}&todate=${endDate}`;
    
    // Use pagination to fetch all invoices
    const allInvoices: any[] = [];
    let page = 1;
    let hasMorePages = true;
    const pageSize = 500; // Larger page size to reduce API calls
    
    while (hasMorePages) {
      const url = `${baseUrl}&limit=${pageSize}&page=${page}`;
      console.log(`Calling Fortnox API with URL: ${url} (page ${page})`);
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`Fortnox API response status for page ${page}: ${response.status}`);
      
      if (response.status === 200) {
        const data = await response.json();
        const pageInvoices = data.Invoices || [];
        console.log(`Retrieved ${pageInvoices.length} invoices from page ${page}`);
        
        // Add this page's invoices to our collection
        allInvoices.push(...pageInvoices);
        
        // Check if we've reached the last page
        if (pageInvoices.length < pageSize) {
          hasMorePages = false;
          console.log(`End of invoices reached at page ${page}`);
        } else {
          page++;
        }
      } else {
        // Try to get more information about the error
        try {
          const errorText = await response.text();
          let errorDetails = errorText;
          
          // Try to parse as JSON if possible
          try {
            const errorJson = JSON.parse(errorText);
            if (errorJson.ErrorInformation) {
              errorDetails = `${errorJson.ErrorInformation.message} (Code: ${errorJson.ErrorInformation.code})`;
            }
          } catch (jsonErr) {
            // Not JSON, use the text as is
          }
          
          console.error(`Fortnox API error: ${response.status} - ${errorText}`);
          throw new Error(`Fortnox API error: ${response.status} - ${errorDetails}`);
        } catch (e) {
          if (e instanceof Error && e.message.includes('Fortnox API error')) {
            throw e; // Re-throw our custom error
          }
          console.error(`Could not parse error response: ${e}`);
          throw new Error(`Fortnox API error: ${response.status}`);
        }
      }
    }
    
    console.log(`Successfully retrieved a total of ${allInvoices.length} invoices from Fortnox for year ${year}`);
    return allInvoices;
  } catch (e) {
    console.error('Error fetching invoices from Fortnox:', e);
    throw e;
  }
}

export async function GET(request: NextRequest) {
  console.log('\n=== Fetching Fortnox Invoices by Year ===');
  
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error: Supabase not initialized' }, 
      { status: 500 }
    );
  }
  
  // Get parameters
  const searchParams = request.nextUrl.searchParams;
  const yearParam = searchParams.get('year');
  
  if (!yearParam) {
    console.error('Missing required parameter: year');
    return NextResponse.json(
      { error: 'Missing required parameter: year' }, 
      { status: 400 }
    );
  }
  
  const year = parseInt(yearParam, 10);
  if (isNaN(year)) {
    console.error('Invalid year parameter:', yearParam);
    return NextResponse.json(
      { error: 'Invalid year parameter. Year must be a valid number.' }, 
      { status: 400 }
    );
  }
  
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Load Fortnox token
    const tokenData = await loadTokenFromSupabase(user.id);
    
    if (!tokenData || !tokenData.access_token) {
      console.error('No Fortnox token found for user');
      return NextResponse.json(
        { error: 'Not connected to Fortnox', tokenStatus: 'missing' }, 
        { status: 401 }
      );
    }
    
    // Fetch invoices for the specified year
    const allInvoices = await fetchInvoicesForYear(tokenData, year);
    console.log(`Total invoices fetched from Fortnox: ${allInvoices.length}`);
    
    // Format the invoices for response
    const formattedInvoices = allInvoices.map(invoice => ({
      DocumentNumber: invoice.DocumentNumber,
      InvoiceDate: invoice.InvoiceDate,
      CustomerName: invoice.CustomerName,
      Total: parseFloat(invoice.Total) || 0,
      Balance: parseFloat(invoice.Balance) || 0,
      DueDate: invoice.DueDate,
      Currency: invoice.Currency || 'SEK',
      InvoiceType: invoice.InvoiceType || 'INVOICE',
      PaymentWay: invoice.PaymentWay || 'BANK',
      ExternalInvoiceReference1: invoice.ExternalInvoiceReference1 || ''
    }));
    
    return NextResponse.json({
      Invoices: formattedInvoices,
      count: formattedInvoices.length,
      year: year
    });
  } catch (error) {
    console.error('Error processing Fortnox invoices request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 