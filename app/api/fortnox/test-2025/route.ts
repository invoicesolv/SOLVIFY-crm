import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';
const CLIENT_ID = '4LhJwn68IpdR';
const CLIENT_SECRET = 'pude4Qk6dK';

// Create Supabase client at runtime only
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

export async function GET(req: NextRequest) {
  console.log('\n=== Test 2025 Invoices Endpoint ===');
  
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase client not initialized' },
      { status: 500 }
    );
  }
  
  // Get user ID from session or headers as fallback
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id || req.headers.get('user-id');
  
  if (!userId) {
    return NextResponse.json(
      { error: 'User not authenticated - please log in' },
      { status: 401 }
    );
  }
  
  try {
    // Get Fortnox tokens for this user
    const { data: tokens, error: tokenError } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', userId);
    
    if (tokenError) {
      return NextResponse.json(
        { error: 'Error fetching Fortnox tokens', details: tokenError },
        { status: 500 }
      );
    }
    
    if (!tokens || tokens.length === 0) {
      return NextResponse.json(
        { error: 'No Fortnox token found' },
        { status: 404 }
      );
    }
    
    // Extract token from either direct columns or settings_data
    let accessToken = tokens[0].access_token;
    if (!accessToken && tokens[0].settings_data) {
      if (typeof tokens[0].settings_data === 'string') {
        try {
          const settingsData = JSON.parse(tokens[0].settings_data);
          accessToken = settingsData.access_token;
        } catch (e) {
          console.error('Failed to parse settings_data string');
        }
      } else if (typeof tokens[0].settings_data === 'object') {
        accessToken = tokens[0].settings_data.access_token;
      }
    }
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No access token found' },
        { status: 401 }
      );
    }
    
    // Fetch 2025 invoices with full date range
    const year = 2025;
    const startDate = `${year}-01-01`;
    const endDate = `${year}-12-31`;
    const url = `${BASE_API_URL}invoices?fromdate=${startDate}&todate=${endDate}&limit=1000`;
    
    console.log(`Testing fetch of 2025 invoices with URL: ${url}`);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    if (response.status === 200) {
      const data = await response.json();
      const invoices = data.Invoices || [];
      
      console.log(`Successfully fetched ${invoices.length} invoices for 2025`);
      
      return NextResponse.json({
        success: true,
        invoices_count: invoices.length,
        invoices: invoices.map((inv: any) => ({
          DocumentNumber: inv.DocumentNumber,
          InvoiceDate: inv.InvoiceDate,
          CustomerName: inv.CustomerName,
          Total: inv.Total
        }))
      });
    } else {
      const errorText = await response.text();
      console.error(`Fortnox API error: ${response.status} - ${errorText}`);
      
      return NextResponse.json(
        { error: `API Error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }
  } catch (error) {
    console.error('Error in test endpoint:', error);
    return NextResponse.json(
      { error: 'Diagnostic failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
} 