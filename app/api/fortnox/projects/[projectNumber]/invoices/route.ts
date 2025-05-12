import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import axios from 'axios';

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

    const { data, error } = await supabase
      .from('user_fortnox_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('Error loading token from Supabase:', error);
      return null;
    }

    if (!data) {
      console.error('No token found for user:', userId);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in loadTokenFromSupabase:', error);
    return null;
  }
}

// Helper function to fetch invoices for a project from Fortnox
async function fetchInvoicesForProject(tokenData: any, projectNumber: string) {
  if (!tokenData || !tokenData.access_token) {
    console.error('No valid token provided to fetchInvoicesForProject');
    throw new Error('No valid token provided');
  }
  
  console.log(`Fetching invoices for project ${projectNumber} from Fortnox`);
  
  try {
    // Fortnox API does not directly support filtering invoices by project,
    // so we need to fetch all invoices and filter them in our code
    
    // Get current year
    const currentYear = new Date().getFullYear();
    
    // Include a reasonable date range (e.g., 2 years back and 1 year ahead)
    const startDate = `${currentYear - 2}-01-01`;
    const endDate = `${currentYear + 1}-12-31`;
    
    // Construct the URL for invoices
    const baseUrl = `${BASE_API_URL}invoices?fromdate=${startDate}&todate=${endDate}`;
    
    // Use pagination to fetch all invoices
    const projectInvoices: any[] = [];
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
        
        // Filter invoices by project number
        const filteredInvoices = pageInvoices.filter((invoice: any) => 
          invoice.Project === projectNumber
        );
        
        console.log(`Found ${filteredInvoices.length} invoices for project ${projectNumber} on page ${page}`);
        
        // Add filtered invoices to our collection
        projectInvoices.push(...filteredInvoices);
        
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
    
    console.log(`Successfully retrieved a total of ${projectInvoices.length} invoices for project ${projectNumber}`);
    return projectInvoices;
  } catch (e) {
    console.error(`Error fetching invoices for project ${projectNumber}:`, e);
    throw e;
  }
}

// Helper function to get a Fortnox client for API access
async function getFortnoxClient(userId: string) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      console.error('Failed to initialize Supabase admin client');
      return null;
    }
    
    // Get the user's Fortnox token
    const { data: tokenData, error: tokenError } = await supabase
      .from('fortnox_tokens')
      .select('access_token, refresh_token, expires_at')
      .eq('user_id', userId)
      .maybeSingle();
    
    if (tokenError || !tokenData?.access_token) {
      console.error('No Fortnox token found for user:', tokenError);
      return null;
    }
    
    // Create and return an axios client configured for Fortnox API
    return axios.create({
      baseURL: 'https://api.fortnox.se/3',
      headers: {
        'Access-Token': tokenData.access_token,
        'Client-Secret': process.env.FORTNOX_CLIENT_SECRET || '',
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });
  } catch (error) {
    console.error('Error creating Fortnox client:', error);
    return null;
  }
}

// Helper function to get linked tasks for invoices from our database
async function getLinkedTasksForInvoices(projectNumber: string, invoiceNumbers: string[]) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      throw new Error('Failed to initialize Supabase client');
    }
    
    if (invoiceNumbers.length === 0) {
      return {};
    }
    
    // First, find internal invoice IDs that match the document numbers
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, document_number')
      .in('document_number', invoiceNumbers);
    
    if (invoiceError || !invoices || invoices.length === 0) {
      console.log('No internal invoices found matching the Fortnox document numbers');
      return {};
    }
    
    // Map document numbers to internal IDs
    const invoiceIdMap: Record<string, string> = {};
    invoices.forEach(invoice => {
      if (invoice.document_number) {
        invoiceIdMap[invoice.document_number] = invoice.id;
      }
    });
    
    // Get internal invoice IDs that match the document numbers
    const invoiceIds = Object.values(invoiceIdMap);
    
    if (invoiceIds.length === 0) {
      return {};
    }
    
    // Now get the links using the internal IDs
    const { data, error } = await supabase
      .from('project_invoice_links')
      .select(`
        invoice_id,
        project_id,
        invoice_number,
        task_details,
        created_at
      `)
      .in('invoice_id', invoiceIds);
    
    if (error) {
      console.error('Error fetching linked invoices:', error);
      return {};
    }
    
    // Create a mapping of invoice number to task details
    const invoiceTaskMap: Record<string, any> = {};
    
    data.forEach(link => {
      if (link.invoice_number) {
        invoiceTaskMap[link.invoice_number] = {
          taskDetails: link.task_details,
          createdAt: link.created_at
        };
      }
    });
    
    return invoiceTaskMap;
  } catch (error) {
    console.error('Error in getLinkedTasksForInvoices:', error);
    return {};
  }
}

export async function GET(
  request: Request,
  { params }: { params: { projectNumber: string } }
) {
  try {
    const userId = request.headers.get("user-id");
    if (!userId) {
      return Response.json({ error: "User ID is required" }, { status: 401 });
    }
    
    const projectNumber = params.projectNumber;
    if (!projectNumber) {
      return Response.json({ error: "Project number is required" }, { status: 400 });
    }
    
    const fortnoxClient = await getFortnoxClient(userId);
    if (!fortnoxClient) {
      return Response.json({ error: "Failed to initialize Fortnox client" }, { status: 500 });
    }
    
    // Fetch invoices associated with this project
    const response = await fortnoxClient.get(`/invoices?filter=project&project=${projectNumber}`);
    if (response.status !== 200) {
      console.error(`Error fetching project invoices: ${response.status} ${response.statusText}`);
      return Response.json({ error: "Failed to fetch invoices from Fortnox" }, { status: response.status });
    }
    
    const invoices = response.data.Invoices;
    
    // Get task details for these invoices if available
    let invoiceNumbers: string[] = [];
    if (invoices && invoices.length > 0) {
      invoiceNumbers = invoices.map((invoice: any) => invoice.DocumentNumber);
    }
    
    const taskDetails = await getLinkedTasksForInvoices(projectNumber, invoiceNumbers);
    
    // Map invoice document numbers to their task details
    let invoiceTaskDetails: Record<string, string> = {};
    let invoiceStatuses: Record<string, string> = {};
    
    if (taskDetails && Object.keys(taskDetails).length > 0) {
      for (const [invoiceNumber, taskDetail] of Object.entries(taskDetails)) {
        invoiceTaskDetails[invoiceNumber] = taskDetail.taskDetails || '';
        
        // If we have status information in our database, use it
        if (taskDetail.status) {
          invoiceStatuses[invoiceNumber] = taskDetail.status;
        }
      }
    }
    
    // Format the Fortnox invoices for the response
    const formattedInvoices = invoices.map(invoice => {
      return {
        ...invoice,
        // Add task details if we have them
        TaskDetails: invoiceTaskDetails[invoice.DocumentNumber] || '',
        // Set the invoice status - use our stored status if available, otherwise set based on Fortnox status
        Status: invoiceStatuses[invoice.DocumentNumber] || 
                (invoice.Balance === 0 ? 'paid' : 
                 new Date(invoice.DueDate) < new Date() ? 'overdue' : 'pending')
      };
    });
    
    // Return the formatted invoices
    return Response.json({
      Invoices: formattedInvoices
    });
  } catch (error) {
    console.error("Error fetching project invoices:", error);
    return Response.json({ error: "Failed to fetch project invoices" }, { status: 500 });
  }
} 