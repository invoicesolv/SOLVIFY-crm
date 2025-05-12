import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";

// Fortnox API constants
const BASE_API_URL = 'https://api.fortnox.se/3/';

export async function GET(req: NextRequest) {
  console.log('\n=== Fortnox Date Analyzer API ===');

  try {
    // Get workspace_id from headers
    const workspaceId = req.headers.get('workspace-id');
    
    console.log(`Request received for workspace ID: ${workspaceId || 'Not provided'}`);
    
    if (!workspaceId) {
      console.warn("No workspace ID provided in request headers");
      return NextResponse.json(
        { error: 'workspace_id is required in the request headers' },
        { status: 400 }
      );
    }
    
    // Get Fortnox token for the workspace using supabaseAdmin
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('fortnox_tokens')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (tokenError) {
      console.error('Error fetching Fortnox token:', tokenError);
      return NextResponse.json(
        { error: 'Database error when fetching token', details: tokenError.message },
        { status: 500 }
      );
    }
    
    if (!tokenData || !tokenData.access_token) {
      console.error('No Fortnox token found for workspace');
      return NextResponse.json(
        { error: 'Fortnox API token not found for this workspace. Please connect Fortnox first.' },
        { status: 404 }
      );
    }
    
    console.log("Successfully retrieved Fortnox access token");
    
    // Fetch invoice dates from Fortnox API
    // We'll limit this to the last 2 years and upcoming 1 year to keep it efficient
    const currentYear = new Date().getFullYear();
    const years = [currentYear - 2, currentYear - 1, currentYear, currentYear + 1];
    
    const invoice_dates: string[] = [];
    const due_dates: string[] = [];
    
    // Process each year
    for (const year of years) {
      // Fetch invoices for this year
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      const url = `${BASE_API_URL}invoices?fromdate=${startDate}&todate=${endDate}&limit=500`;
      
      console.log(`Fetching invoices for year ${year} with URL: ${url}`);
      
      try {
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${tokenData.access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 200) {
          const data = await response.json();
          const invoices = data.Invoices || [];
          
          console.log(`Retrieved ${invoices.length} invoices for year ${year}`);
          
          // Extract date information
          for (const invoice of invoices) {
            if (invoice.InvoiceDate) invoice_dates.push(invoice.InvoiceDate);
            if (invoice.DueDate) due_dates.push(invoice.DueDate);
          }
        } else {
          const errorText = await response.text();
          console.warn(`Fortnox API error for year ${year}: ${response.status} - ${errorText}`);
          // Continue with other years even if one fails
        }
      } catch (fetchError) {
        console.error(`Error fetching year ${year}:`, fetchError);
        // Continue with other years even if one fails
      }
    }
    
    // Remove duplicates and sort dates
    const uniqueInvoiceDates = [...new Set(invoice_dates)].sort();
    const uniqueDueDates = [...new Set(due_dates)].sort();
    
    // Group by year and month for analysis
    const years_data: number[] = [];
    const months_by_year: Record<number, number[]> = {};
    
    for (const date of uniqueInvoiceDates) {
      const [year, month] = date.split('-').map(Number);
      
      if (!years_data.includes(year)) {
        years_data.push(year);
      }
      
      if (!months_by_year[year]) {
        months_by_year[year] = [];
      }
      
      if (!months_by_year[year].includes(month)) {
        months_by_year[year].push(month);
      }
    }
    
    // Sort the data
    years_data.sort((a, b) => a - b);
    for (const year in months_by_year) {
      months_by_year[year].sort((a, b) => a - b);
    }
    
    // Build the response
    const response = {
      invoice_dates: uniqueInvoiceDates,
      due_dates: uniqueDueDates,
      years: years_data,
      months_by_year: months_by_year,
      analysis: {
        earliest_date: uniqueInvoiceDates[0] || null,
        latest_date: uniqueInvoiceDates[uniqueInvoiceDates.length - 1] || null,
        total_invoices: uniqueInvoiceDates.length
      }
    };
    
    console.log("Fortnox date analysis complete");
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Error in Fortnox date analyzer:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 