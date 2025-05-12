import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import axios from 'axios';

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

export const dynamic = 'force-dynamic';

/**
 * Links multiple tasks to an invoice
 * 
 * This endpoint allows linking multiple tasks to an existing invoice
 * while also updating the invoice in Fortnox with the task details.
 */
export async function POST(req: NextRequest) {
  console.log('\n=== Linking Tasks to Fortnox Invoice ===');
  
  try {
    // Get the user ID from the headers
    const userId = req.headers.get('user-id');
    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 401 });
    }
    
    // Parse the request body
    const requestData = await req.json();
    console.log('Request data:', requestData);
    
    // Basic validation
    if (!requestData.invoiceId) {
      return NextResponse.json({ error: 'Invoice ID is required' }, { status: 400 });
    }
    
    if (!requestData.projectId) {
      return NextResponse.json({ error: 'Project ID is required' }, { status: 400 });
    }
    
    if (!requestData.taskIds || !Array.isArray(requestData.taskIds) || requestData.taskIds.length === 0) {
      return NextResponse.json({ error: 'At least one task ID is required' }, { status: 400 });
    }
    
    // Get Fortnox client
    const fortnoxClient = await getFortnoxClient(userId);
    if (!fortnoxClient) {
      return NextResponse.json({ error: 'Failed to initialize Fortnox client' }, { status: 500 });
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize Supabase client' }, { status: 500 });
    }
    
    // Get invoice document number
    const documentNumber = requestData.invoiceId;
    
    // Get project number (from internal project ID if needed)
    let fortnoxProjectNumber = requestData.projectId;
    let noProjectNumber = false;
    
    // Check if the provided project ID is internal or Fortnox
    if (!fortnoxProjectNumber.match(/^\d+$/)) {
      // If it's not a number-only string, it might be an internal ID
      // Fetch the Fortnox project number from the internal project ID
      const { data: projectData } = await supabase
        .from('projects')
        .select('fortnox_project_number')
        .eq('id', fortnoxProjectNumber)
        .maybeSingle();
      
      if (projectData?.fortnox_project_number) {
        fortnoxProjectNumber = projectData.fortnox_project_number;
      } else {
        console.log('No Fortnox project number found for internal project ID');
        noProjectNumber = true;
      }
    }
    
    // Get task details (titles)
    const taskIds = requestData.taskIds;
    const { data: tasksData } = await supabase
      .from('project_tasks')
      .select('id, title')
      .in('id', taskIds);
    
    const taskTitles = tasksData?.map(task => task.title) || [];
    const taskDetails = requestData.taskDetails || taskTitles.join(', ');
    
    console.log(`Linking tasks to invoice ${documentNumber}${!noProjectNumber ? ` - Project ${fortnoxProjectNumber}` : ''}`);
    console.log(`Task details: ${taskDetails}`);
    
    try {
      // First, update the invoice in Fortnox with the project and task details
      // Fetch current invoice data
      const invoiceResponse = await fortnoxClient.get(`/invoices/${documentNumber}`);
      if (invoiceResponse.status !== 200) {
        return NextResponse.json({ 
          error: `Failed to fetch invoice from Fortnox: ${invoiceResponse.status}` 
        }, { status: invoiceResponse.status });
      }
      
      const invoice = invoiceResponse.data.Invoice;
      
      // Prepare the update with project number and task details in comments
      const invoiceUpdate = {
        Invoice: {
          ...invoice,
          // Only add Project if we have a Fortnox project number
          ...(noProjectNumber ? {} : { Project: fortnoxProjectNumber })
        }
      };
      
      // Add task details to comments if specified
      if (taskDetails) {
        invoiceUpdate.Invoice.Comments = invoice.Comments 
          ? `${invoice.Comments}\nTasks: ${taskDetails}`
          : `Tasks: ${taskDetails}`;
      }
      
      // Update the invoice in Fortnox
      const updateResponse = await fortnoxClient.put(`/invoices/${documentNumber}`, invoiceUpdate);
      if (updateResponse.status !== 200) {
        return NextResponse.json({ 
          error: `Failed to update invoice in Fortnox: ${updateResponse.status}` 
        }, { status: updateResponse.status });
      }
      
      // Now, store the task links in our database
      // 1. First store the project-invoice link if we have a project number
      if (!noProjectNumber) {
        const { error: linkError } = await supabase
          .from('project_invoice_links')
          .upsert({
            invoice_number: documentNumber,
            fortnox_project_number: fortnoxProjectNumber,
            project_id: requestData.projectId,
            task_details: taskDetails,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'invoice_number,fortnox_project_number'
          });
        
        if (linkError) {
          console.error('Error storing project-invoice link:', linkError);
        }
      }
      
      // 2. Store individual task links
      let successfulLinks = 0;
      for (const taskId of taskIds) {
        const { error: taskLinkError } = await supabase
          .from('invoice_task_links')
          .upsert({
            invoice_number: documentNumber,
            task_id: taskId,
            project_id: requestData.projectId,
            created_at: new Date().toISOString()
          }, {
            onConflict: 'invoice_number,task_id'
          });
        
        if (taskLinkError) {
          console.error(`Error linking task ${taskId} to invoice:`, taskLinkError);
        } else {
          successfulLinks++;
        }
      }
      
      console.log(`Successfully linked ${successfulLinks} of ${taskIds.length} tasks to invoice ${documentNumber}`);
      
      // Return success response
      return NextResponse.json({
        message: 'Tasks successfully linked to invoice',
        invoice: {
          documentNumber: documentNumber,
          projectNumber: noProjectNumber ? null : fortnoxProjectNumber,
          tasksLinked: successfulLinks,
          taskDetails: taskDetails
        }
      });
      
    } catch (error) {
      console.error('Error linking tasks to invoice:', error);
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'Unknown error' }, 
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error processing link tasks to invoice request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' }, 
      { status: 500 }
    );
  }
} 