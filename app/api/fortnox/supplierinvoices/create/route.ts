import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { createClient } from '@supabase/supabase-js';
import authOptions from '../../../../../lib/auth';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';

// Function to get Supabase admin client
function getSupabaseAdmin() {
  try {
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    return supabaseAdmin;
  } catch (error) {
    console.error('Error creating Supabase admin client:', error);
    return null;
  }
}

// Helper function to load Fortnox token from Supabase
async function loadTokenFromSupabase(userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }
    
    const { data, error } = await supabase
      .from('user_integrations')
      .select('access_token, refresh_token')
      .eq('user_id', userId)
      .eq('provider', 'fortnox')
      .maybeSingle();
    
    if (error) {
      console.error('Error fetching Fortnox token:', error);
      return null;
    }
    
    if (!data) {
      console.log('No Fortnox integration found for user:', userId);
      return null;
    }
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token
    };
  } catch (error) {
    console.error('Error in loadTokenFromSupabase:', error);
    return null;
  }
}

// Helper function to refresh Fortnox token
async function refreshFortnoxToken(refreshToken: string, userId: string) {
  try {
    console.log('Refreshing Fortnox token...');
    
    const response = await fetch('https://apps.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: process.env.FORTNOX_CLIENT_ID!,
        client_secret: process.env.FORTNOX_CLIENT_SECRET!
      })
    });
    
    if (!response.ok) {
      console.error('Failed to refresh token, status:', response.status);
      
      // If refresh fails with 400, we need to re-authenticate
      if (response.status === 400) {
        // Clear stored token
        const supabase = getSupabaseAdmin();
        if (supabase) {
          await supabase
            .from('user_integrations')
            .delete()
            .eq('user_id', userId)
            .eq('provider', 'fortnox');
        }
      }
      
      return null;
    }
    
    const tokenData = await response.json();
    
    // Store the new token in Supabase
    const supabase = getSupabaseAdmin();
    if (supabase) {
      await supabase
        .from('user_integrations')
        .update({
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('provider', 'fortnox');
    }
    
    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token
    };
  } catch (error) {
    console.error('Error refreshing Fortnox token:', error);
    return null;
  }
}

// Helper function to create a supplier invoice in Fortnox
async function createSupplierInvoice(accessToken: string, invoiceData: any): Promise<any> {
  try {
    console.log('Creating supplier invoice with data:', JSON.stringify(invoiceData, null, 2));

    // Build the request body according to Fortnox API
    const requestBody = {
      SupplierInvoice: {
        SupplierNumber: invoiceData.supplierNumber,
        InvoiceDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
        DueDate: invoiceData.dueDate,
        Currency: invoiceData.currency || "SEK",
        Comments: invoiceData.comments || '',
        ExternalInvoiceNumber: invoiceData.externalInvoiceNumber || '',
        // Add more fields as needed
        ...(invoiceData.ourReference && { OurReference: invoiceData.ourReference }),
        ...(invoiceData.yourReference && { YourReference: invoiceData.yourReference }),
        ...(invoiceData.project && { Project: invoiceData.project })
      }
    };

    // Add invoice rows
    if (invoiceData.invoiceRows && Array.isArray(invoiceData.invoiceRows)) {
      requestBody.SupplierInvoice.SupplierInvoiceRows = invoiceData.invoiceRows.map((row: any) => ({
        Description: row.description || '',
        AccountNumber: row.accountNumber || '4010', // Default account for purchases
        Quantity: row.quantity || 1, // Use Quantity instead of Delivered for supplier invoices
        Price: row.price || 0,
        Total: row.total || (row.price * row.quantity),
        VAT: row.vat !== undefined ? row.vat : 25  // Default VAT rate in Sweden is 25%
      }));
    }

    // Make the request to Fortnox API
    const response = await fetch(`${BASE_API_URL}supplierinvoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    // Process the response
    if (response.ok) {
      const data = await response.json();
      
      // Store invoice in our database
      if (data.SupplierInvoice) {
        try {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            // Prepare invoice data for our database
            const dbInvoiceData = {
              document_number: data.SupplierInvoice.GivenNumber || data.SupplierInvoice.SupplierInvoiceNumber,
              external_invoice_number: data.SupplierInvoice.ExternalInvoiceNumber,
              invoice_date: data.SupplierInvoice.InvoiceDate,
              due_date: data.SupplierInvoice.DueDate,
              total: data.SupplierInvoice.Total,
              currency: data.SupplierInvoice.Currency,
              status: data.SupplierInvoice.Booked ? 'booked' : 'pending',
              supplier_number: data.SupplierInvoice.SupplierNumber,
              supplier_name: data.SupplierInvoice.SupplierName,
              type: 'supplier',
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            };
            
            await supabase.from('invoices').insert(dbInvoiceData);
          }
        } catch (error: any) {
          console.error('Error storing supplier invoice in database:', error);
        }
      }
      
      return data.SupplierInvoice;
    } else {
      // Try to get more information about the error
      try {
        const errorText = await response.text();
        let errorDetails = errorText;
        let errorResponse = { message: 'Unknown error', code: 0 };
        
        // Try to parse as JSON if possible
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.ErrorInformation) {
            errorDetails = `${errorJson.ErrorInformation.message} (Code: ${errorJson.ErrorInformation.code})`;
            errorResponse = {
              message: errorJson.ErrorInformation.message,
              code: errorJson.ErrorInformation.code
            };
          }
        } catch (jsonErr) {
          // Not JSON, use the text as is
        }
        
        console.error(`Fortnox API Error when creating supplier invoice: ${errorDetails}`);
        return {
          error: true,
          details: errorDetails,
          code: errorResponse.code
        };
      } catch (parseError) {
        console.error('Error parsing Fortnox error response:', parseError);
        return {
          error: true,
          details: 'Could not parse error response'
        };
      }
    }
  } catch (error: any) {
    console.error('Error creating supplier invoice:', error);
    return {
      error: true,
      details: error.message || 'Unknown error'
    };
  }
}

export async function POST(req: NextRequest) {
  console.log('\n=== Creating Fortnox Supplier Invoice ===');
  
  // Get user ID from session or request header
  let userId: string | null = null;
  
  // First try to get from the session
  const session = await getServerSession(authOptions);
  if (session?.user?.id) {
    userId = session.user.id;
    console.log('Using user ID from session:', userId);
  } else {
    // If no session, check for user-id header (for client-side API calls)
    userId = req.headers.get('user-id');
    console.log('Using user ID from header:', userId);
  }
  
  if (!userId) {
    console.error('No user ID found in session or header');
    return NextResponse.json({ error: 'Unauthorized - No user ID' }, { status: 401 });
  }
  
  const finalUserId = userId;
  console.log('Processing supplier invoice creation for user ID:', finalUserId);
  
  try {
    // Parse the JSON request body
    const requestData = await req.json();
    console.log('Request data:', JSON.stringify(requestData, null, 2));
    
    // Get Fortnox access token from user's saved credentials
    const tokenData = await loadTokenFromSupabase(finalUserId);
    if (!tokenData || !tokenData.access_token) {
      // If refresh token is present but access token is missing, try to refresh
      if (tokenData && tokenData.refresh_token) {
        console.log('Access token missing, attempting to refresh');
        const refreshedToken = await refreshFortnoxToken(tokenData.refresh_token, finalUserId);
        if (!refreshedToken || !refreshedToken.access_token) {
          return NextResponse.json({ error: 'Fortnox credentials expired' }, { status: 401 });
        }
        tokenData.access_token = refreshedToken.access_token;
      } else {
        return NextResponse.json({ error: 'Fortnox credentials not found' }, { status: 401 });
      }
    }
    
    // Validate required fields
    if (!requestData.supplierNumber) {
      return NextResponse.json({ error: 'Supplier number is required' }, { status: 400 });
    }
    
    if (!requestData.invoiceRows || !Array.isArray(requestData.invoiceRows) || requestData.invoiceRows.length === 0) {
      return NextResponse.json({ error: 'At least one invoice row is required' }, { status: 400 });
    }
    
    // Create the supplier invoice in Fortnox
    const invoice = await createSupplierInvoice(tokenData.access_token, requestData);
    
    if (invoice.error) {
      return NextResponse.json({ 
        error: 'Failed to create supplier invoice', 
        details: invoice.details,
        code: invoice.code 
      }, { status: 500 });
    }
    
    return NextResponse.json({ SupplierInvoice: invoice });
  } catch (error: any) {
    console.error('Error in supplier invoice creation handler:', error);
    return NextResponse.json({ 
      error: 'Failed to process supplier invoice creation', 
      details: error.message || 'Unknown error' 
    }, { status: 500 });
  }
} 