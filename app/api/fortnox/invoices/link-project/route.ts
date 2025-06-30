import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
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

// Helper function to fetch an invoice from Fortnox
async function fetchInvoiceByNumber(tokenData: any, documentNumber: string) {
  if (!tokenData || !tokenData.access_token) {
    console.error('No valid token provided to fetchInvoiceByNumber');
    throw new Error('No valid token provided');
  }
  
  console.log(`Fetching invoice ${documentNumber} from Fortnox with access token`);
  
  try {
    // Construct the URL for the specific invoice
    const url = `${BASE_API_URL}invoices/${documentNumber}`;
    console.log(`Calling Fortnox API with URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`Fortnox API response status: ${response.status}`);
    
    if (response.status === 200) {
      const data = await response.json();
      return data.Invoice || null;
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
  } catch (e) {
    console.error(`Error fetching invoice ${documentNumber} from Fortnox:`, e);
    throw e;
  }
}

// Helper function to update an invoice in Fortnox to link it to a project
async function linkInvoiceToProject(tokenData: any, documentNumber: string, projectNumber: string, taskDetails?: string) {
  if (!tokenData || !tokenData.access_token) {
    console.error('No valid token provided to linkInvoiceToProject');
    throw new Error('No valid token provided');
  }
  
  console.log(`Linking invoice ${documentNumber} to project ${projectNumber}`);
  
  try {
    // First, fetch the current invoice to get its data
    const invoice = await fetchInvoiceByNumber(tokenData, documentNumber);
    
    if (!invoice) {
      throw new Error(`Invoice ${documentNumber} not found`);
    }
    
    // Construct the URL for updating the invoice
    const url = `${BASE_API_URL}invoices/${documentNumber}`;
    
    // Prepare the invoice update payload
    // We need to include all required fields, not just the Project field
    const invoiceUpdate = {
      Invoice: {
        ...invoice,
        Project: projectNumber
      }
    };
    
    // If taskDetails is provided, we can add it to the invoice comments or a custom field
    if (taskDetails) {
      // Add task details to the invoice comments
      invoiceUpdate.Invoice.Comments = `${invoice.Comments || ''}\nTask: ${taskDetails}`;
    }
    
    console.log(`Updating invoice with project number ${projectNumber}`);
    
    const response = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(invoiceUpdate)
    });
    
    console.log(`Fortnox API response status: ${response.status}`);
    
    if (response.status === 200) {
      const data = await response.json();
      
      // Also store the link in our database for reference
      await storeProjectInvoiceLink(documentNumber, projectNumber, taskDetails);
      
      return data.Invoice || null;
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
  } catch (e) {
    console.error(`Error linking invoice ${documentNumber} to project ${projectNumber}:`, e);
    throw e;
  }
}

// Helper function to store the invoice-project link in our database
async function storeProjectInvoiceLink(documentNumber: string, projectNumber: string, taskDetails?: string) {
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
    
    // Look up the invoice_id if available
    let invoiceId = null;
    const { data: invoiceData } = await supabase
      .from('invoices')
      .select('id')
      .eq('document_number', documentNumber)
      .maybeSingle();
    
    invoiceId = invoiceData?.id || null;
    
    if (!invoiceId) {
      console.log(`No internal invoice found for document number ${documentNumber}, creating placeholder`);
      // If we can't find an internal invoice, we could create a placeholder record
      // This step would depend on your application's requirements
    }
    
    // If we have both internal IDs, store the link in the database
    if (internalProjectId && invoiceId) {
      console.log(`Storing link between internal project ID ${internalProjectId} and invoice ID ${invoiceId}`);
      const { data, error } = await supabase
        .from('project_invoice_links')
        .upsert({
          project_id: internalProjectId,
          invoice_id: invoiceId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          fortnox_project_number: projectNumber,
          invoice_number: documentNumber,
          task_details: taskDetails
        }, {
          onConflict: 'project_id,invoice_id'
        });
      
      if (error) {
        console.error('Error storing invoice-project link:', error);
      } else {
        console.log('Successfully stored invoice-project link');
      }
      
      return data;
    } else {
      console.warn(`Cannot store link: missing internal ID for project (${internalProjectId}) or invoice (${invoiceId})`);
      return null;
    }
  } catch (error) {
    console.error('Error in storeProjectInvoiceLink:', error);
    // We don't want to fail the whole operation if just the local storage fails
    return null;
  }
}

export async function POST(req: NextRequest) {
  console.log('\n=== Linking Fortnox Invoice to Project ===');
  
  try {
    const user = await getUserFromToken(req);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    
    // Parse the request body
    const requestData = await req.json();
    console.log('Request data:', requestData);
    
    // Basic validation
    if (!requestData.documentNumber) {
      return NextResponse.json({ error: 'Invoice document number is required' }, { status: 400 });
    }
    
    if (!requestData.projectNumber) {
      return NextResponse.json({ error: 'Project number is required' }, { status: 400 });
    }
    
    // Load Fortnox token
    const tokenData = await loadTokenFromSupabase(finalUserId);
    
    if (!tokenData || !tokenData.access_token) {
      console.error('No Fortnox token found for user');
      return NextResponse.json(
        { error: 'Not connected to Fortnox', tokenStatus: 'missing' }, 
        { status: 401 }
      );
    }
    
    // Link the invoice to the project in Fortnox
    const updatedInvoice = await linkInvoiceToProject(
      tokenData, 
      requestData.documentNumber, 
      requestData.projectNumber,
      requestData.taskDetails
    );
    
    if (!updatedInvoice) {
      return NextResponse.json({ 
        error: `Failed to link invoice to project` 
      }, { status: 500 });
    }
    
    // Return a success response
    return NextResponse.json({ 
      message: 'Invoice successfully linked to project',
      Invoice: {
        DocumentNumber: updatedInvoice.DocumentNumber,
        Project: updatedInvoice.Project,
        CustomerName: updatedInvoice.CustomerName,
        Total: updatedInvoice.Total
      }
    });
  } catch (error) {
    console.error('Error processing link invoice to project request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 