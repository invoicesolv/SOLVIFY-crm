import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

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

// Helper function to store the invoice-project link in our database
async function storeProjectInvoiceLink(documentNumber: string, projectNumber: string, taskId?: string, taskDetails?: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }
    
    console.log(`Storing invoice-project link in database: Invoice ${documentNumber} - Project ${projectNumber}`);
    
    // Look up the internal project_id if available
    const { data: projectData } = await supabase
      .from('projects')
      .select('id')
      .eq('fortnox_project_number', projectNumber)
      .maybeSingle();
    
    const internalProjectId = projectData?.id || null;
    
    // Store the link in the database
    const { data, error } = await supabase
      .from('project_invoice_links')
      .upsert({
        invoice_number: documentNumber,
        fortnox_project_number: projectNumber,
        project_id: internalProjectId,
        task_id: taskId || null,
        task_details: taskDetails || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'invoice_number,fortnox_project_number'
      });
    
    if (error) {
      console.error('Error storing invoice-project link:', error);
    } else {
      console.log('Successfully stored invoice-project link');
      
      // If we have task IDs, store the task relationships too
      if (taskId && internalProjectId) {
        // Handle multiple task IDs (comma-separated)
        const taskIdList = taskId.split(',').filter(id => id.trim().length > 0);
        
        if (taskIdList.length > 0) {
          console.log(`Storing task relationships for ${taskIdList.length} tasks`);
          
          for (const id of taskIdList) {
            const { error: taskLinkError } = await supabase
              .from('invoice_task_links')
              .upsert({
                invoice_number: documentNumber,
                task_id: id.trim(),
                project_id: internalProjectId,
                created_at: new Date().toISOString()
              }, {
                onConflict: 'invoice_number,task_id'
              });
            
            if (taskLinkError) {
              console.error(`Error linking task ${id} to invoice:`, taskLinkError);
            }
          }
        }
      }
    }
    
    return data;
  } catch (error) {
    console.error('Error in storeProjectInvoiceLink:', error);
    // We don't want to fail the whole operation if just the local storage fails
    return null;
  }
}

// Helper function to create an invoice in Fortnox
async function createInvoice(accessToken: string, invoiceData: any): Promise<any> {
  try {
    console.log('Creating invoice with data:', JSON.stringify(invoiceData, null, 2));

    // Build the request body
    const requestBody = {
      Invoice: {
        CustomerNumber: invoiceData.customerNumber,
        InvoiceDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
        DueDate: invoiceData.dueDate,
        InvoiceType: invoiceData.invoiceType || 'INVOICE',
        Comments: invoiceData.comments || '',
        Currency: invoiceData.currency || "SEK", // Ensure currency is set (Swedish Kronor)
        // If project number is provided, link it
        ...(invoiceData.projectNumber && { Project: invoiceData.projectNumber }),
      }
    };

    // Add EmailInformation only if not a draft/offer and we have a valid email
    if (invoiceData.invoiceType !== 'OFFER' && 
        invoiceData.customerEmail && 
        validateEmail(invoiceData.customerEmail)) {
      
      // Double-check that the email is not "1" before adding
      if (invoiceData.customerEmail !== '1' && invoiceData.customerEmail !== 1) {
        requestBody.Invoice.EmailInformation = {
          EmailAddressTo: invoiceData.customerEmail,
          EmailAddressCC: '',
          EmailAddressBCC: '',
          EmailSubject: `Invoice ${invoiceData.customerName || ''}`,
          EmailBody: 'Here is your invoice.'
        };
        console.log(`Including email address: ${invoiceData.customerEmail}`);
      } else {
        console.log('Skipping invalid email: "1"');
      }
    } else {
      console.log('Not including email information in invoice request');
      if (invoiceData.invoiceType === 'OFFER') {
        console.log('Reason: Invoice type is OFFER');
      } else if (!invoiceData.customerEmail) {
        console.log('Reason: No customer email provided');
      } else {
        console.log(`Reason: Email validation failed for "${invoiceData.customerEmail}"`);
      }
    }

    // Add invoice rows
    if (invoiceData.invoiceRows && Array.isArray(invoiceData.invoiceRows)) {
      // Explicitly map each field with the correct names required by Fortnox
      requestBody.Invoice.InvoiceRows = invoiceData.invoiceRows.map((row: any) => {
        const correctFieldNames = {
          ArticleNumber: row.articleNumber || null,
        Description: row.description || '',
          DeliveredQuantity: row.quantity || 1, // Use DeliveredQuantity instead of Quantity for invoices
        Price: row.price || 0,
          Unit: row.unit || 'st',
          VAT: row.vat !== undefined ? row.vat : 25 // Default VAT rate in Sweden is
        };
        
        // Only include account number if it's provided
        if (row.accountNumber) {
          correctFieldNames['AccountNumber'] = row.accountNumber;
        }
        
        return correctFieldNames;
      });
    }

    // Make the request to Fortnox API
    const response = await fetch(`${BASE_API_URL}invoices`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });

    if (response.ok) {
      const data = await response.json();
      
      // Store invoice in our database with customer_id if provided
      if (data.Invoice) {
        try {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            // Prepare invoice data for our database
            const dbInvoiceData = {
              document_number: data.Invoice.DocumentNumber,
              invoice_date: data.Invoice.InvoiceDate,
              due_date: data.Invoice.DueDate,
              total: data.Invoice.Total,
              currency: data.Invoice.Currency,
              status: data.Invoice.Balance === 0 ? 'paid' : 'unpaid',
              updated_at: new Date().toISOString(),
              created_at: new Date().toISOString()
            };
            
            // Add customer_id if provided in the invoice data
            if (invoiceData.customer_id) {
              console.log(`Storing invoice with customer_id: ${invoiceData.customer_id}`);
              await supabase.from('invoices').insert({
                ...dbInvoiceData,
                customer_id: invoiceData.customer_id
              });
            }
            
            // If we have customer number but not customer_id, try to find customer by number
            else if (data.Invoice.CustomerNumber) {
              // Try to find customer by number
              const { data: customerData } = await supabase
                .from('customers')
                .select('id')
                .eq('customer_number', data.Invoice.CustomerNumber)
                .maybeSingle();
                
              if (customerData?.id) {
                console.log(`Found customer_id ${customerData.id} for customer_number ${data.Invoice.CustomerNumber}`);
                await supabase.from('invoices').insert({
                  ...dbInvoiceData,
                  customer_id: customerData.id
                });
              }
            }
          }
        } catch (error) {
          console.error('Error storing invoice in database:', error);
        }
      
      // If we created an invoice successfully and it was for a customer,
      // store their email in our database if available
        if (data.Invoice.CustomerNumber && invoiceData.customerEmail && validateEmail(invoiceData.customerEmail)) {
        try {
          const supabase = getSupabaseAdmin();
          if (supabase) {
            await supabase.from('customers')
              .update({ 
                email: invoiceData.customerEmail,
                customer_number: data.Invoice.CustomerNumber
              })
              .eq('customer_number', data.Invoice.CustomerNumber);
          }
        } catch (error) {
          console.error('Error updating customer email in database:', error);
          }
        }
      }
      
      return data.Invoice;
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
        
        console.error(`Fortnox API Error when creating invoice: ${errorDetails}`);
        
        // If the error is related to email validation and we're not already using OFFER type
        if ((errorResponse.code === 2000357 || errorDetails.includes('giltig e-postadress')) && invoiceData.invoiceType !== 'OFFER') {
          console.log('Email validation error detected, retrying as OFFER type');
          
          // Try again as an OFFER type invoice (draft)
          invoiceData.invoiceType = 'OFFER';
          return createInvoice(accessToken, invoiceData);
        }
        
        return null;
      } catch (parseError) {
        console.error('Error parsing Fortnox error response:', parseError);
        return null;
      }
    }
  } catch (error) {
    console.error('Error creating invoice:', error);
    return null;
  }
}

// Helper function to refresh Fortnox token
async function refreshFortnoxToken(refreshToken: string, userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase admin client');
      return null;
    }
    
    // Fortnox OAuth credentials
    const clientId = process.env.FORTNOX_CLIENT_ID || '4LhJwn68IpdR';
    const clientSecret = process.env.FORTNOX_CLIENT_SECRET || 'pude4Qk6dK';
    
    console.log('Refreshing Fortnox token...');
    
    const response = await fetch('https://apps.fortnox.se/oauth-v1/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        'grant_type': 'refresh_token',
        'refresh_token': refreshToken,
        'client_id': clientId,
        'client_secret': clientSecret
      })
    });
    
    if (!response.ok) {
      console.error(`Error refreshing token: ${response.status} ${response.statusText}`);
      return null;
    }
    
    const newTokenData = await response.json();
    
    // Calculate expires_at
    const expiresAt = new Date();
    const oneWeekInSeconds = 7 * 24 * 60 * 60; // 1 week in seconds
    const expiresInSeconds = newTokenData.expires_in || oneWeekInSeconds;
    // Use the longer of either the provided expires_in or one week
    const effectiveExpiresIn = Math.max(expiresInSeconds, oneWeekInSeconds);
    expiresAt.setSeconds(expiresAt.getSeconds() + effectiveExpiresIn);
    
    // Update both places where tokens might be stored
    
    // 1. Try to update the settings table
    const { error: settingsError } = await supabase
      .from('settings')
      .upsert({
        service_name: 'fortnox',
        user_id: userId,
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: expiresAt.toISOString(),
        updated_at: new Date().toISOString(),
        // Store all data in settings_data as well
        settings_data: {
          access_token: newTokenData.access_token,
          refresh_token: newTokenData.refresh_token,
          expires_at: expiresAt.toISOString(),
          token_type: newTokenData.token_type,
          scope: newTokenData.scope
        }
      }, {
        onConflict: 'service_name,user_id'
      });
    
    if (settingsError) {
      console.error('Error updating token in settings table:', settingsError);
    } else {
      console.log('Successfully updated token in settings table');
    }
    
    // 2. Try to update the user_fortnox_tokens table
    const { error: tokensError } = await supabase
      .from('user_fortnox_tokens')
      .upsert({
        user_id: userId,
        access_token: newTokenData.access_token,
        refresh_token: newTokenData.refresh_token,
        expires_at: expiresAt.toISOString()
      }, {
        onConflict: 'user_id'
      });
    
    if (tokensError) {
      console.error('Error updating token in user_fortnox_tokens table:', tokensError);
    } else {
      console.log('Successfully updated token in user_fortnox_tokens table');
    }
    
    return {
      access_token: newTokenData.access_token,
      refresh_token: newTokenData.refresh_token,
      expires_at: expiresAt.toISOString()
    };
  } catch (error) {
    console.error('Error refreshing Fortnox token:', error);
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

export async function POST(req: NextRequest) {
  console.log('\n=== Creating Fortnox Invoice - DEBUGGING ===');
  
  // Get user ID from session or request header
  let userId: string | null = null;
  
  // First try to get from the session
  const session = await getUserFromToken(req);
  if (session?.id) {
    userId = session.id;
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
  console.log('Processing invoice creation for user ID:', finalUserId);
  
  try {
    // Parse the JSON request body
    const requestData = await req.json();
    console.log('Request data (sanitized):', JSON.stringify({
      ...requestData,
      // Exclude sensitive information or large fields
      taskDetails: requestData.taskDetails ? '(content present)' : undefined,
      comments: requestData.comments ? '(content present)' : undefined,
    }, null, 2));
    
    // Get Fortnox access token from user's saved credentials
    const tokenData = await loadTokenFromSupabase(finalUserId);
    console.log('Token data present:', !!tokenData);
    console.log('Access token present:', !!(tokenData && tokenData.access_token));
    console.log('Refresh token present:', !!(tokenData && tokenData.refresh_token));
    
    if (!tokenData || !tokenData.access_token) {
      // If refresh token is present but access token is missing, try to refresh
      if (tokenData && tokenData.refresh_token) {
        console.log('Access token missing, attempting to refresh');
      const refreshedToken = await refreshFortnoxToken(tokenData.refresh_token, finalUserId);
        if (!refreshedToken || !refreshedToken.access_token) {
          console.error('Failed to refresh token');
          return NextResponse.json({ error: 'Fortnox credentials expired' }, { status: 401 });
        }
        console.log('Successfully refreshed token');
        tokenData.access_token = refreshedToken.access_token;
      } else {
        console.error('Fortnox credentials not found - no refresh token available');
        return NextResponse.json({ error: 'Fortnox credentials not found' }, { status: 401 });
    }
    }
    
    // Modified validation - either customerNumber OR customerName can be provided
    // OR a valid projectNumber can be provided (which will use the project's customer)
    if (!requestData.customerNumber && !requestData.customerName && !requestData.projectNumber) {
      console.error('Missing required customer information');
      return NextResponse.json({ error: 'Either customer number, customer name, or a project number is required' }, { status: 400 });
    }
    
    if (!requestData.invoiceRows || !Array.isArray(requestData.invoiceRows) || requestData.invoiceRows.length === 0) {
      console.error('Missing invoice rows');
      return NextResponse.json({ error: 'At least one invoice row is required' }, { status: 400 });
    }

    console.log('Validations passed, proceeding with invoice creation');
    
    // If we have a project number but no customer number, fetch the project to get its customer
    if (requestData.projectNumber && !requestData.customerNumber) {
      try {
        console.log(`Fetching project ${requestData.projectNumber} to get customer information`);
        const projectUrl = `${BASE_API_URL}projects/${requestData.projectNumber}`;
        
        const projectResponse = await fetch(projectUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });
        
        if (projectResponse.ok) {
          const projectData = await projectResponse.json();
          if (projectData.Project && projectData.Project.CustomerNumber) {
            requestData.customerNumber = projectData.Project.CustomerNumber;
            console.log(`Using customer number ${requestData.customerNumber} from project`);
            
            // Fetch customer details to get email address
            const customerResponse = await fetch(`${BASE_API_URL}customers/${requestData.customerNumber}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`,
                'Accept': 'application/json'
              }
            });
            
            if (customerResponse.ok) {
              const customerData = await customerResponse.json();
              if (customerData.Customer && customerData.Customer.Email) {
                requestData.customerEmail = customerData.Customer.Email;
                console.log(`Using email address ${requestData.customerEmail} from customer`);
                
                // Store the customer email in our database
                const supabase = getSupabaseAdmin();
                if (supabase) {
                  await supabase.from('customers')
                    .upsert({ 
                      customer_number: requestData.customerNumber,
                      email: requestData.customerEmail,
                      created_at: new Date().toISOString()
                    }, {
                      onConflict: 'customer_number'
                    });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error fetching project details:', error);
      }
    }
    
    // If we have a customer number but no email, check our database
    if (requestData.customerNumber && !requestData.customerEmail) {
      const storedEmail = await getCustomerEmailFromDatabase(requestData.customerNumber);
      if (storedEmail) {
        requestData.customerEmail = storedEmail;
        console.log(`Using email address ${requestData.customerEmail} from database`);
      }
    }
    
    // If no customer number but customer name provided, attempt to get or create a customer
    if (!requestData.customerNumber && requestData.customerName) {
      try {
        // First try to find an existing customer with this name
        console.log(`Searching for customer with name: ${requestData.customerName}`);
        const url = `${BASE_API_URL}customers?filter=name&name=${encodeURIComponent(requestData.customerName)}`;
        
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });
        
        let customerFound = false;
        
        if (response.ok) {
          const data = await response.json();
          if (data.Customers && data.Customers.length > 0) {
            console.log(`Found existing customer ${requestData.customerName}`);
            const customer = data.Customers[0];
            // Set the customer number from the found customer
            requestData.customerNumber = customer.CustomerNumber;
            
            // Also get the customer's email if available
            if (customer.Email) {
              requestData.customerEmail = customer.Email;
              console.log(`Using customer email: ${requestData.customerEmail}`);
              
              // Store in our database
              const supabase = getSupabaseAdmin();
              if (supabase) {
                await supabase.from('customers')
                  .upsert({ 
                    customer_number: requestData.customerNumber,
                    email: requestData.customerEmail,
                    created_at: new Date().toISOString()
                  }, {
                    onConflict: 'customer_number'
                  });
              }
            }
            
            customerFound = true;
          }
        }
        
        // If no customer found, create a new one
        if (!customerFound) {
          console.log(`Creating new customer with name: ${requestData.customerName}`);
          const createCustomerUrl = `${BASE_API_URL}customers`;
          
          const createResponse = await fetch(createCustomerUrl, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${tokenData.access_token}`,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify({
              Customer: {
                Name: requestData.customerName,
                CountryCode: 'SE',
                Currency: 'SEK',
                DefaultDeliveryTypes: {
                  Invoice: 'EMAIL'
                },
                EmailInvoice: true,
                Email: requestData.customerEmail || 'no-email@example.com'
              }
            })
          });
          
          if (createResponse.ok) {
            const customerData = await createResponse.json();
            requestData.customerNumber = customerData.Customer.CustomerNumber;
            
            // Save email if available
            if (customerData.Customer.Email) {
              requestData.customerEmail = customerData.Customer.Email;
              
              // Store in database
              const supabase = getSupabaseAdmin();
              if (supabase) {
                await supabase.from('customers')
                  .upsert({ 
                    customer_number: requestData.customerNumber,
                    email: requestData.customerEmail,
                    created_at: new Date().toISOString()
                  }, {
                    onConflict: 'customer_number'
                  });
              }
            }
            
            console.log(`Created new customer with number: ${requestData.customerNumber} and email: ${requestData.customerEmail || 'none'}`);
          } else {
            console.error('Failed to create customer');
            const errorText = await createResponse.text();
            console.error(errorText);
            return NextResponse.json({ error: 'Failed to create customer' }, { status: 500 });
          }
        }
      } catch (customerError) {
        console.error('Error handling customer:', customerError);
        return NextResponse.json({ error: 'Error handling customer information' }, { status: 500 });
      }
    }
    
    // If we still don't have an email address, fetch it from Fortnox
    if (requestData.customerNumber && !requestData.customerEmail && requestData.invoiceType !== 'OFFER') {
      try {
        console.log(`Fetching details for customer ${requestData.customerNumber} to get email`);
        const customerUrl = `${BASE_API_URL}customers/${requestData.customerNumber}`;
        
        const customerResponse = await fetch(customerUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json'
          }
        });
        
        if (customerResponse.ok) {
          const customerData = await customerResponse.json();
          if (customerData.Customer && customerData.Customer.Email) {
            const email = customerData.Customer.Email;
            
            // Extra validation to ensure the email is actually valid
            if (validateEmail(email)) {
              requestData.customerEmail = email;
              console.log(`Using customer email: ${requestData.customerEmail}`);
              
              // Store in our database for future use
              const supabase = getSupabaseAdmin();
              if (supabase) {
                await supabase.from('customers')
                  .upsert({ 
                    customer_number: requestData.customerNumber,
                    email: email,
                    name: customerData.Customer.Name || null,
                    address: customerData.Customer.Address1 || null,
                    address2: customerData.Customer.Address2 || null,
                    city: customerData.Customer.City || null,
                    zip_code: customerData.Customer.ZipCode || null,
                    phone: customerData.Customer.Phone || null,
                    organization_number: customerData.Customer.OrganisationNumber || null,
                    country: customerData.Customer.CountryCode || null,
                    contact_person: customerData.Customer.ContactPerson || null,
                    created_at: new Date().toISOString()
                  }, {
                    onConflict: 'customer_number'
                  });
              }
            } else {
              console.log(`Found invalid email "${email}" for customer ${requestData.customerNumber}, not using it`);
              // Set to OFFER type since we can't use this email
              requestData.invoiceType = 'OFFER';
            }
          } else {
            console.log(`No email found for customer ${requestData.customerNumber}`);
            // Default to OFFER type if no email is available
            if (requestData.invoiceType !== 'OFFER') {
              console.log('Setting invoice type to OFFER due to missing email');
              requestData.invoiceType = 'OFFER';
            }
          }
        }
      } catch (error) {
        console.error('Error fetching customer details:', error);
        // Set to OFFER type if we encountered an error
        requestData.invoiceType = 'OFFER';
      }
    }
    
    // Final validation before creating the invoice
    // If we're not creating a draft and we have no valid email, set to OFFER type
    if (requestData.invoiceType !== 'OFFER' && (!requestData.customerEmail || !validateEmail(requestData.customerEmail))) {
      console.log('No valid email found for customer. Converting to draft invoice (OFFER).');
      requestData.invoiceType = 'OFFER';
    }
    
    // Create the invoice in Fortnox
    const invoice = await createInvoice(tokenData.access_token, {
      ...requestData,
      // Ensure the customer_id is explicitly passed through if provided
      customer_id: requestData.customer_id
    });
    
    if (!invoice) {
      return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 });
    }
    
    // If invoice type is OFFER, we don't need to do anything else since it's just a draft
    // Otherwise, for regular invoices, we might want to set up additional handling here
    console.log(`Created ${requestData.invoiceType === 'OFFER' ? 'draft invoice (offer)' : 'invoice'} with number ${invoice.DocumentNumber}`);
    
    // If project number is provided, store the link in our database
    try {
      if (requestData.projectNumber) {
        // Store the invoice link in our database
        await storeProjectInvoiceLink(
          invoice.DocumentNumber,
          requestData.projectNumber,
          requestData.taskIds ? requestData.taskIds[0] : undefined,
          requestData.taskDetails
        );
      }
    } catch (linkError) {
      // Log error but don't fail the request - invoice was already created
      console.error('Error linking invoice to project:', linkError);
    }

    // Return the created invoice details
    return NextResponse.json({ 
      Invoice: invoice,
      message: `Successfully created ${requestData.invoiceType === 'OFFER' ? 'draft invoice (offer)' : 'invoice'}`
    });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    
    // Check for specific Fortnox error codes
    if (error.response && error.response.data && error.response.data.ErrorInformation) {
      const fortnoxError = error.response.data.ErrorInformation;
      
      // Handle the email validation error specifically
      if (fortnoxError.code === 2000357) { // Email validation error
        return NextResponse.json({ 
          error: 'Email validation error from Fortnox', 
          details: 'Invalid email address format. Try creating a draft (OFFER) instead.', 
          fortnoxError 
        }, { status: 400 });
      }
      
      // Return the specific error from Fortnox
      return NextResponse.json({ 
        error: 'Fortnox API error', 
        details: fortnoxError.message, 
        code: fortnoxError.code 
      }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Failed to create invoice', details: error.message || 'Unknown error' }, { status: 500 });
  }
}