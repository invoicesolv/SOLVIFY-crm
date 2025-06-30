import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { getUserFromToken } from '@/lib/auth-utils';
import { createClient } from '@supabase/supabase-js';

// Fortnox API URL
const FORTNOX_API_URL = 'https://api.fortnox.se/3/';

// Types
interface FortnoxCustomer {
  CustomerNumber: string;
  Name: string;
  Email: string;
  EmailInvoice?: string;
  EmailInvoiceCC?: string;
  EmailInvoiceBCC?: string;
  EmailOffer?: string;
  EmailOfferCC?: string;
  EmailOfferBCC?: string;
  // Other fields not needed for this endpoint
}

interface DbCustomer {
  id: string;
  name: string;
  customer_number: string;
}

interface UpdatedCustomer {
  id: string;
  name: string;
  customer_number: string;
  email: string;
}

interface FailedCustomer {
  id: string;
  name: string;
  customer_number: string;
  error: string;
}

interface DebugInfo {
  customer_number: string;
  name: string;
  fortnox_data: {
    Email: string;
    EmailInvoice?: string;
    EmailInvoiceCC?: string;
    EmailInvoiceBCC?: string;
    EmailOffer?: string;
    EmailOfferCC?: string;
    EmailOfferBCC?: string;
  };
}

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing environment variables for Supabase');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Helper function to load token from database
async function loadFortnoxToken() {
  const supabase = getSupabaseAdmin();
  if (!supabase) return null;
  
  try {
    const { data, error } = await supabase
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .limit(1)
      .single();
    
    if (error || !data) {
      console.error('Error loading Fortnox token:', error);
      return null;
    }
    
    return data.access_token;
  } catch (error) {
    console.error('Error in loadFortnoxToken:', error);
    return null;
  }
}

// Helper to validate email
function validateEmail(email: string) {
  if (!email) return false;
  // Simple regex for basic email validation
  return /\S+@\S+\.\S+/.test(email);
}

// Helper to find the first valid email from all email fields
function findValidEmail(customer: FortnoxCustomer): string | null {
  // Check primary email first
  if (customer.Email && validateEmail(customer.Email)) {
    return customer.Email;
  }
  
  // Check all alternative email fields
  const alternativeEmails = [
    customer.EmailInvoice,
    customer.EmailInvoiceCC,
    customer.EmailInvoiceBCC,
    customer.EmailOffer,
    customer.EmailOfferCC,
    customer.EmailOfferBCC
  ];
  
  for (const email of alternativeEmails) {
    if (email && validateEmail(email)) {
      return email;
    }
  }
  
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log("=== Starting fix-missing-emails operation ===");
    
    // Get workspace ID from query params
    const { searchParams } = new URL(request.url);
    const workspaceId = searchParams.get('workspace_id');
    const debug = searchParams.get('debug') === 'true';
    
    if (!workspaceId) {
      return NextResponse.json({ error: 'Missing workspace_id parameter' }, { status: 400 });
    }
    
    // Initialize Supabase
    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return NextResponse.json({ error: 'Failed to initialize database connection' }, { status: 500 });
    }
    
    // Get Fortnox API token
    const accessToken = await loadFortnoxToken();
    if (!accessToken) {
      return NextResponse.json({ error: 'Failed to load Fortnox API token' }, { status: 500 });
    }
    
    // 1. Find customers with missing emails that have customer numbers
    console.log(`Finding customers with missing emails in workspace ${workspaceId}`);
    const { data: customersWithoutEmails, error: fetchError } = await supabase
      .from('customers')
      .select('id, name, customer_number')
      .eq('workspace_id', workspaceId)
      .or('email.is.null,email.eq.-,email.eq.null,email.ilike.null')
      .not('customer_number', 'is', null);
    
    if (fetchError) {
      console.error('Error fetching customers without emails:', fetchError);
      return NextResponse.json({ 
        error: 'Failed to fetch customers without emails', 
        details: fetchError.message 
      }, { status: 500 });
    }
    
    if (!customersWithoutEmails || customersWithoutEmails.length === 0) {
      console.log('No customers with missing emails found');
      return NextResponse.json({ 
        message: 'No customers with missing emails found', 
        count: 0 
      });
    }
    
    console.log(`Found ${customersWithoutEmails.length} customers with missing emails`);
    
    // 2. For each customer, directly fetch their data from Fortnox
    const updatedCustomers: UpdatedCustomer[] = [];
    const failedCustomers: FailedCustomer[] = [];
    const debugInfo: DebugInfo[] = [];
    
    for (const customer of customersWithoutEmails as DbCustomer[]) {
      try {
        if (!customer.customer_number) continue;
        
        // Get customer details directly from Fortnox
        console.log(`Fetching details for customer ${customer.customer_number} (${customer.name})`);
        const url = `${FORTNOX_API_URL}customers/${customer.customer_number}`;
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          console.error(`Failed to fetch customer ${customer.customer_number}: ${response.status}`);
          failedCustomers.push({
            id: customer.id,
            name: customer.name,
            customer_number: customer.customer_number,
            error: `API error: ${response.status}`
          });
          continue;
        }
        
        const fortnoxData = await response.json();
        
        if (!fortnoxData.Customer) {
          console.error(`Invalid response for customer ${customer.customer_number}`);
          failedCustomers.push({
            id: customer.id,
            name: customer.name,
            customer_number: customer.customer_number,
            error: 'Invalid Fortnox response'
          });
          continue;
        }
        
        const fortnoxCustomer = fortnoxData.Customer as FortnoxCustomer;
        
        // Add to debug info if requested
        if (debug) {
          debugInfo.push({
            customer_number: customer.customer_number,
            name: customer.name,
            fortnox_data: {
              Email: fortnoxCustomer.Email,
              EmailInvoice: fortnoxCustomer.EmailInvoice,
              EmailInvoiceCC: fortnoxCustomer.EmailInvoiceCC,
              EmailInvoiceBCC: fortnoxCustomer.EmailInvoiceBCC,
              EmailOffer: fortnoxCustomer.EmailOffer,
              EmailOfferCC: fortnoxCustomer.EmailOfferCC,
              EmailOfferBCC: fortnoxCustomer.EmailOfferBCC
            }
          });
        }
        
        // Find the best email option from all available email fields
        const validEmail = findValidEmail(fortnoxCustomer);
        
        if (!validEmail) {
          console.log(`No valid email found for customer ${customer.customer_number}`);
          failedCustomers.push({
            id: customer.id,
            name: customer.name,
            customer_number: customer.customer_number,
            error: 'No valid email found in Fortnox'
          });
          continue;
        }
        
        console.log(`Found valid email for customer ${customer.customer_number}: ${validEmail}`);
        
        // Create email metadata
        const emailMetadata = {
          email_invoice: fortnoxCustomer.EmailInvoice || null,
          email_invoice_cc: fortnoxCustomer.EmailInvoiceCC || null,
          email_invoice_bcc: fortnoxCustomer.EmailInvoiceBCC || null,
          email_offer: fortnoxCustomer.EmailOffer || null,
          email_offer_cc: fortnoxCustomer.EmailOfferCC || null,
          email_offer_bcc: fortnoxCustomer.EmailOfferBCC || null
        };
        
        // Update the customer in our database
        const { error: updateError } = await supabase
          .from('customers')
          .update({ 
            email: validEmail,
            email_metadata: emailMetadata,
            updated_at: new Date().toISOString()
          })
          .eq('id', customer.id);
        
        if (updateError) {
          console.error(`Error updating customer ${customer.id}:`, updateError);
          failedCustomers.push({
            id: customer.id,
            name: customer.name,
            customer_number: customer.customer_number,
            error: updateError.message
          });
        } else {
          updatedCustomers.push({
            id: customer.id,
            name: customer.name,
            customer_number: customer.customer_number,
            email: validEmail
          });
        }
      } catch (error) {
        console.error(`Error processing customer ${customer.id}:`, error);
        failedCustomers.push({
          id: customer.id,
          name: customer.name,
          customer_number: customer.customer_number,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    // 3. Return the results
    return NextResponse.json({
      success: true,
      message: `Updated ${updatedCustomers.length} of ${customersWithoutEmails.length} customers with emails from Fortnox`,
      updated: updatedCustomers,
      failed: failedCustomers,
      total: customersWithoutEmails.length,
      debug: debug ? debugInfo : undefined
    });
  } catch (error) {
    console.error('Error in fix-missing-emails endpoint:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unknown error occurred' },
      { status: 500 }
    );
  }
} 