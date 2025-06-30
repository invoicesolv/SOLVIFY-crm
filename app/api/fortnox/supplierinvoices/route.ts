import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

const BASE_API_URL = 'https://api.fortnox.se/3/';

// Create Supabase client at runtime only
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
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId)
      .single();
    
    if (error || !data) {
      return null;
    }
    
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at
    };
  } catch (e) {
    console.error('Error loading token from Supabase:', e);
    return null;
  }
}

// Fetch supplier invoices from Fortnox
async function fetchSupplierInvoices(accessToken: string, year?: string) {
  try {
    let url = `${BASE_API_URL}supplierinvoices`;
    
    // Add date filters if year is provided (use fromdate and todate instead of financialyear)
    if (year) {
      url += `?fromdate=${year}-01-01&todate=${year}-12-31`;
    }
    
    console.log(`[SupplierInvoices] Calling Fortnox API: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Fortnox API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response body:', errorText);
      throw new Error(`Fortnox API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log('Fortnox supplier invoices API response:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('Error fetching supplier invoices from Fortnox:', error);
    throw error;
  }
}

// Fetch supplier invoices for multiple years
async function fetchSupplierInvoicesForMultipleYears(accessToken: string) {
  const currentYear = new Date().getFullYear();
  const years = [
    currentYear.toString(),
    (currentYear + 1).toString(), // Next year
    (currentYear - 1).toString(), // Previous year
    (currentYear - 2).toString(), // 2 years ago
    (currentYear - 3).toString()  // 3 years ago
  ];
  
  const allSupplierInvoices: any[] = [];
  
  for (const year of years) {
    try {
      console.log(`[SupplierInvoices] Fetching supplier invoices for year ${year}`);
      
      const yearData = await fetchSupplierInvoices(accessToken, year);
      const supplierInvoices = yearData.SupplierInvoices || [];
      
      // Add year info to each supplier invoice for tracking
      const invoicesWithYear = supplierInvoices.map((invoice: any) => ({
        ...invoice,
        FiscalYear: year
      }));
      
      allSupplierInvoices.push(...invoicesWithYear);
      console.log(`[SupplierInvoices] Found ${supplierInvoices.length} supplier invoices for year ${year}`);
      
    } catch (error) {
      console.error(`[SupplierInvoices] Error fetching supplier invoices for year ${year}:`, error);
      // Continue with other years even if one fails
    }
  }
  
  console.log(`[SupplierInvoices] Total supplier invoices fetched across all years: ${allSupplierInvoices.length}`);
  
  return {
    SupplierInvoices: allSupplierInvoices,
    MetaInformation: {
      TotalResources: allSupplierInvoices.length,
      YearsCovered: years
    }
  };
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
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error: Supabase not initialized' }, 
      { status: 500 }
    );
  }
  
  const session = await getUserFromToken(req);
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user ID from headers (fallback to session)
    const userId = req.headers.get('user-id') || session.id;
    
    // Load Fortnox token
    const tokenData = await loadTokenFromSupabase(userId);
    if (!tokenData) {
      return NextResponse.json({ 
        error: 'Fortnox not connected. Please connect your Fortnox account first.' 
      }, { status: 400 });
    }

    // Check if token is expired
    if (new Date() > new Date(tokenData.expires_at)) {
      return NextResponse.json({ 
        error: 'Fortnox token expired. Please reconnect your account.' 
      }, { status: 401 });
    }

    // Get year parameter if provided
    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year');
    const allYears = searchParams.get('all_years') === 'true';

    console.log(`[SupplierInvoices] Fetching supplier invoices for user: ${userId}`, year ? `for year: ${year}` : allYears ? 'for all years' : '');

    let supplierInvoicesData;
    
    if (allYears) {
      // Fetch supplier invoices for multiple years for financial analysis
      supplierInvoicesData = await fetchSupplierInvoicesForMultipleYears(tokenData.access_token);
    } else {
      // Fetch supplier invoices for specific year or current year
      supplierInvoicesData = await fetchSupplierInvoices(tokenData.access_token, year || undefined);
    }
    
    console.log(`[SupplierInvoices] Successfully fetched ${supplierInvoicesData.SupplierInvoices?.length || 0} supplier invoices`);

    return NextResponse.json({
      SupplierInvoices: supplierInvoicesData.SupplierInvoices || [],
      MetaInformation: supplierInvoicesData.MetaInformation || {}
    });

  } catch (error) {
    console.error('[SupplierInvoices] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch supplier invoices',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 