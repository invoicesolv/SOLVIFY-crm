import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';
const CLIENT_ID = '4LhJwn68IpdR';
const CLIENT_SECRET = 'pude4Qk6dK';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';

// Create Supabase client at runtime only
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Check for both variable names, preferring the non-public one if both exist
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

    console.log('Token record structure:', Object.keys(data).join(', '));
    
    // Try to get tokens from direct columns first, then from settings_data as fallback
    // This handles both schemas (direct columns or JSON)
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

    console.log(`Fortnox token found. Access token: ${accessToken ? 'present' : 'missing'}, Refresh token: ${refreshToken ? 'present' : 'missing'}`);
    
    const now = new Date();
    const expiresAtDate = expiresAt ? new Date(expiresAt) : null;
    
    // Token is expired or missing
    if (!accessToken || (expiresAtDate && expiresAtDate <= now)) {
      console.log(`Fortnox token is ${!accessToken ? 'missing' : 'expired'}. Expired at: ${expiresAtDate?.toISOString() || 'unknown'}, Current time: ${now.toISOString()}`);
      return { refresh_token: refreshToken };
    }
    
    console.log(`Fortnox token is valid until: ${expiresAtDate ? expiresAtDate.toISOString() : 'unknown'}`);
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

// Helper to refresh token
async function refreshToken(refreshToken: string, userId: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('Cannot refresh token: Supabase client not initialized');
    return null;
  }
  
  if (!refreshToken) {
    console.error('No refresh token provided');
    return null;
  }
  
  try {
    console.log(`Attempting to refresh Fortnox token for user ID: ${userId}`);
    const response = await fetch('https://apps5.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': CLIENT_ID,
        'client_secret': CLIENT_SECRET
      })
    });
    
    console.log(`Refresh token response status: ${response.status}`);
    
    if (response.status === 200) {
      const newTokenData = await response.json();
      console.log('Successfully refreshed Fortnox token');
      
      // Calculate expires_at
      const expiresAt = new Date();
      expiresAt.setSeconds(expiresAt.getSeconds() + newTokenData.expires_in);
      const expiresAtStr = expiresAt.toISOString();
      
      // First get the existing record to preserve its structure
      const { data: existingRecord, error: fetchError } = await supabaseAdmin
        .from('settings')
        .select('*')
        .eq('service_name', 'fortnox')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (fetchError && fetchError.code !== 'PGRST116') {  // PGRST116 is "not found"
        console.error('Error fetching existing token record:', fetchError);
      }
      
      // Prepare the base update record
      const updateRecord: any = {
        service_name: 'fortnox',
        user_id: userId,
        updated_at: new Date().toISOString()
      };
      
      // Determine if we should use direct columns, settings_data, or both
      // based on the existing record structure
      if (existingRecord) {
        console.log(`Existing record found with keys: ${Object.keys(existingRecord).join(', ')}`);
        
        // If the existing record has these as direct columns, continue using that pattern
        if ('access_token' in existingRecord) {
          updateRecord.access_token = newTokenData.access_token;
        }
        
        if ('refresh_token' in existingRecord) {
          updateRecord.refresh_token = newTokenData.refresh_token;
        }
        
        if ('expires_at' in existingRecord) {
          updateRecord.expires_at = expiresAtStr;
        }
        
        // If it has settings_data, update that too
        if ('settings_data' in existingRecord) {
          let settingsData: any = {};
          
          // Parse existing settings_data if it's a string
          if (typeof existingRecord.settings_data === 'string') {
            try {
              settingsData = JSON.parse(existingRecord.settings_data);
            } catch (e) {
              console.error('Failed to parse existing settings_data string:', e);
            }
          } else if (existingRecord.settings_data && typeof existingRecord.settings_data === 'object') {
            settingsData = { ...existingRecord.settings_data };
          }
          
          // Update the token data in settings_data
          settingsData.access_token = newTokenData.access_token;
          settingsData.refresh_token = newTokenData.refresh_token;
          settingsData.expires_at = expiresAtStr;
          settingsData.token_type = newTokenData.token_type;
          settingsData.scope = newTokenData.scope;
          
          updateRecord.settings_data = settingsData;
        }
      } else {
        // No existing record, create a new one with both patterns for maximum compatibility
        updateRecord.access_token = newTokenData.access_token;
        updateRecord.refresh_token = newTokenData.refresh_token;
        updateRecord.expires_at = expiresAtStr;
        updateRecord.settings_data = {
          access_token: newTokenData.access_token,
          refresh_token: newTokenData.refresh_token,
          expires_at: expiresAtStr,
          token_type: newTokenData.token_type,
          scope: newTokenData.scope
        };
      }
      
      console.log('Updating token with record structure:', Object.keys(updateRecord).join(', '));
      
      // Update token in Supabase
      const { error } = await supabaseAdmin
        .from('settings')
        .upsert(updateRecord, {
          onConflict: 'service_name,user_id'
        });
      
      if (error) {
        console.error('Error updating token in Supabase:', error);
        return null;
      }
      
      return {
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: expiresAtStr
      };
    } else {
      const errorText = await response.text();
      console.error(`Error refreshing token - Status: ${response.status}, Response: ${errorText}`);
    }
    
    return null;
  } catch (e) {
    console.error('Error refreshing token:', e);
    return null;
  }
}

// Main fetch function for Fortnox invoices
async function fetchInvoices(tokenData: any, userId: string, year: number, month?: number) {
  if (!tokenData || !tokenData.access_token) {
    console.error('No valid token provided to fetchInvoices');
    throw new Error('No valid token provided');
  }
  
  console.log(`Fetching invoices for year ${year}${month ? ` and month ${month}` : ''} with access token`);
  
  try {
    // Construct the base URL for the year/month with the correct Fortnox API format
    let baseUrl = '';
    
    if (year && month) {
      // For specific month and year
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      
      // Calculate last day of month
      const lastDay = new Date(year, month, 0).getDate();
      const endDate = `${year}-${month.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
      
      // Use the format with correct filter syntax for Fortnox API
      baseUrl = `${BASE_API_URL}invoices?fromdate=${startDate}&todate=${endDate}`;
    } else if (year) {
      // For full year
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      
      // Use the standard date filter format
      baseUrl = `${BASE_API_URL}invoices?fromdate=${startDate}&todate=${endDate}`;
    }
    
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
      } else if (response.status === 401) {
        console.error('Token unauthorized - need to refresh');
        
        // Try to refresh the token
        if (tokenData.refresh_token) {
          console.log('Attempting to refresh the token');
          const refreshedToken = await refreshToken(tokenData.refresh_token, userId);
          
          if (refreshedToken && refreshedToken.access_token) {
            console.log('Token refreshed, retrying fetch');
            // Update token and retry this page
            tokenData = refreshedToken;
            continue;
          }
        }
        
        throw new Error('Unauthorized: Please reconnect to Fortnox in settings');
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

export async function GET(req: NextRequest) {
  console.log('\n=== Fetching Fortnox Invoices ===');
  
  const supabaseAdmin = getSupabaseAdmin();
  // Check if Supabase is properly initialized
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error: Supabase not initialized' }, 
      { status: 500 }
    );
  }
  
  // First try to get user ID from headers (for compatibility with frontend)
  const workspaceId = req.headers.get('workspace-id');
  const headerUserId = req.headers.get('user-id');
  
  // If headers don't have the user ID, try to get it from the session
  let sessionUserId: string | undefined;
  try {
    const user = await getUserFromToken(req);
    sessionUserId = user?.id;
    console.log('Got user ID from session:', sessionUserId);
  } catch (e) {
    console.error('Error getting session:', e);
  }
  
  // Final user ID to use
  const finalUserId = headerUserId || sessionUserId;
  
  if (!finalUserId) {
    console.error('No user ID found in headers or session');
    return NextResponse.json({ error: 'Unauthorized: User not authenticated', details: 'Please log in or provide a user-id header' }, { status: 401 });
  }
  
  console.log(`Processing request for user ID: ${finalUserId}`);
  
  try {
    // Load Fortnox token
    let tokenData = await loadTokenFromSupabase(finalUserId);
    
  if (!tokenData) {
      console.error('No Fortnox token found for user');
      return NextResponse.json(
        { error: 'Not connected to Fortnox', tokenStatus: 'missing' }, 
        { status: 401 }
      );
  }
  
    // Check if we only have a refresh token
  if (!tokenData.access_token && tokenData.refresh_token) {
      console.log('Only refresh token available, attempting to refresh');
      const refreshedToken = await refreshToken(tokenData.refresh_token, finalUserId);
      
      if (!refreshedToken || !refreshedToken.access_token) {
        console.error('Failed to refresh token');
        return NextResponse.json(
          { error: 'Failed to refresh Fortnox token', tokenStatus: 'refresh_failed' }, 
          { status: 401 }
        );
    }
      
      // Use refreshed token
      tokenData = refreshedToken;
    }
    
    // Check if token is still missing
    if (!tokenData.access_token) {
      console.error('No access token available after token processing');
      return NextResponse.json(
        { error: 'Not connected to Fortnox', tokenStatus: 'missing_access_token' }, 
        { status: 401 }
      );
    }
    
    // Get years parameter
    const searchParams = req.nextUrl.searchParams;
    const yearsParam = searchParams.get('years');
    
    // Get current year once
    const currentYear = new Date().getFullYear();
    
    // Set default years to current, next year, and past year
    let years = [currentYear, currentYear + 1, currentYear - 1]; // Include next year by default
    
    if (yearsParam) {
      try {
        years = JSON.parse(yearsParam);
        console.log(`Using custom years from request: ${years.join(', ')}`);
      } catch {
        console.warn(`Failed to parse years parameter: ${yearsParam}`);
      }
    }
    
    // Make sure we include the next few years for future invoices
    // Include up to 3 years in the future to ensure we catch all scheduled invoices
    for (let year = currentYear + 1; year <= currentYear + 3; year++) {
      if (!years.includes(year)) {
        years.push(year);
        console.log(`Added future year ${year} to the years array for fetching invoices`);
      }
    }
    
    // Log the years we're fetching
    console.log(`Fetching invoices for years: ${years.join(', ')}`);
    
    // Fetch invoices for all specified years
    const allInvoices: any[] = [];
    
    for (const year of years) {
      try {
        console.log(`Fetching invoices for year ${year}`);
        const yearInvoices = await fetchInvoices(tokenData, finalUserId, year);
        if (yearInvoices && yearInvoices.length > 0) {
          console.log(`Found ${yearInvoices.length} invoices for year ${year}`);
          allInvoices.push(...yearInvoices);
        } else {
          console.log(`No invoices found for year ${year}`);
        }
      } catch (e) {
        console.error(`Error fetching invoices for year ${year}:`, e);
        // Continue with other years even if one fails
      }
    }
    
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
    
    if (!workspaceId) {
      console.log('No workspace ID found, returning all invoices without storing them');
      return NextResponse.json({
        Invoices: formattedInvoices,
        count: formattedInvoices.length
      });
    }
    
    // Store new invoices in Supabase for the workspace
    const storedInvoices = await storeNewInvoicesInSupabase(allInvoices, workspaceId, finalUserId, supabaseAdmin);
    console.log(`Successfully processed ${storedInvoices.length} new invoices`);
    
    return NextResponse.json({
      Invoices: formattedInvoices, 
      count: formattedInvoices.length,
      stored: storedInvoices.length
    });
  } catch (error) {
    console.error('Error processing Fortnox invoices request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
      }
}

// Helper function to store new invoices in Supabase
async function storeNewInvoicesInSupabase(
  invoices: any[], 
  workspaceId: string, 
  userId: string, 
  supabaseAdmin: any
): Promise<any[]> {
  if (!invoices.length) {
    console.log('No invoices to store');
    return [];
  }
  
  try {
    console.log(`Processing ${invoices.length} invoices for storage...`);
    
    // First, get existing invoices for this workspace
    const { data: existingInvoices, error: fetchError } = await supabaseAdmin
      .from('invoices')
      .select('invoice_number, document_number')
      .eq('workspace_id', workspaceId);
    
    if (fetchError) {
      console.error('Error fetching existing invoices:', fetchError);
      throw new Error('Failed to fetch existing invoices');
    }
    
    // Create a set of existing invoice numbers for fast lookup
    const existingInvoiceSet = new Set();
    if (existingInvoices) {
      for (const invoice of existingInvoices) {
        if (invoice.document_number) {
          existingInvoiceSet.add(invoice.document_number);
        } else if (invoice.invoice_number) {
          existingInvoiceSet.add(invoice.invoice_number);
        }
      }
    }
    
    console.log(`Found ${existingInvoiceSet.size} existing invoices in the database`);
    
    // Filter out invoices that already exist
    const newInvoices = invoices.filter(invoice => {
      const invoiceNumber = invoice.DocumentNumber || invoice.InvoiceNumber;
      return !existingInvoiceSet.has(invoiceNumber);
    });
    
    console.log(`Found ${newInvoices.length} new invoices to add`);
    
    if (newInvoices.length === 0) {
      return [];
    }
    
    // Process and save new invoices
    const processedInvoices = newInvoices.map(invoice => {
      return {
        invoice_number: invoice.DocumentNumber || invoice.InvoiceNumber,
        document_number: invoice.DocumentNumber,
        customer_number: invoice.CustomerNumber,
        customer_name: invoice.CustomerName,
        total_amount: invoice.Total,
        remaining_amount: invoice.Balance || 0,
        invoice_date: invoice.InvoiceDate,
        due_date: invoice.DueDate,
        ocr_number: invoice.OCR,
        currency: invoice.Currency,
        payment_way: invoice.PaymentWay,
        status: invoice.Balance === 0 ? 'paid' : 'unpaid',
        fortnox_url: invoice.Url || null,
        workspace_id: workspaceId,
        source: 'fortnox',
        user_id: userId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
    });
    
    // Save to Supabase in batches to avoid request size limitations
    const batchSize = 100;
    const results: any[] = [];
    
    for (let i = 0; i < processedInvoices.length; i += batchSize) {
      const batch = processedInvoices.slice(i, i + batchSize);
      console.log(`Inserting batch ${i / batchSize + 1} of ${Math.ceil(processedInvoices.length / batchSize)}`);
      
      const { data, error } = await supabaseAdmin
        .from('invoices')
        .upsert(batch, {
          onConflict: 'document_number,workspace_id',
          ignoreDuplicates: false
        })
        .select();
      
      if (error) {
        console.error('Error inserting invoices batch:', error);
        throw new Error('Failed to insert invoices');
      }
      
      if (data) {
        results.push(...data);
      }
    }
    
    console.log(`Successfully stored ${results.length} new invoices`);
    return results;
  } catch (e) {
    console.error('Error storing invoices in Supabase:', e);
    throw e;
  }
} 