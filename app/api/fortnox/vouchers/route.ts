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

// Fetch vouchers from Fortnox
async function fetchVouchers(accessToken: string, year?: string) {
  try {
    let url = `${BASE_API_URL}vouchers`;
    
    // Add year filter if provided
    if (year) {
      url += `?financialyear=${year}`;
    }
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.error('Fortnox API error:', response.status, response.statusText);
      throw new Error(`Fortnox API error: ${response.status}`);
    }

    const data = await response.json();
    
    // For now, let's just return the basic voucher data without fetching individual details
    // This will be much faster and we can handle amount calculation on the frontend
    console.log(`[Vouchers] Successfully fetched ${data.Vouchers?.length || 0} vouchers`);
    
    // Sample the first voucher to see the structure
    if (data.Vouchers && data.Vouchers.length > 0) {
      console.log('[Vouchers] Sample voucher structure:', JSON.stringify(data.Vouchers[0], null, 2));
    }
    
    return data;
  } catch (error) {
    console.error('Error fetching vouchers from Fortnox:', error);
    throw error;
  }
}

// Fetch vouchers for multiple years
async function fetchVouchersForMultipleYears(accessToken: string) {
  const currentYear = new Date().getFullYear();
  const years = [
    currentYear.toString(),
    (currentYear + 1).toString(), // Next year
    (currentYear - 1).toString(), // Previous year
    (currentYear - 2).toString(), // 2 years ago
    (currentYear - 3).toString()  // 3 years ago
  ];
  
  const allVouchers: any[] = [];
  
  for (const year of years) {
    try {
      console.log(`[Vouchers] Fetching vouchers for year ${year}`);
      
      const yearVouchers = await fetchVouchers(accessToken, year);
      const vouchers = yearVouchers.Vouchers || [];
      
      // Add year info to each voucher for tracking
      const vouchersWithYear = vouchers.map((voucher: any) => ({
        ...voucher,
        FiscalYear: year
      }));
      
      allVouchers.push(...vouchersWithYear);
      console.log(`[Vouchers] Found ${vouchers.length} vouchers for year ${year}`);
      
    } catch (error) {
      console.error(`[Vouchers] Error fetching vouchers for year ${year}:`, error);
      // Continue with other years even if one fails
    }
  }
  
  console.log(`[Vouchers] Total vouchers fetched across all years: ${allVouchers.length}`);
  
  return {
    Vouchers: allVouchers,
    MetaInformation: {
      TotalResources: allVouchers.length,
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
  
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Get user ID from headers (fallback to session)
    const userId = req.headers.get('user-id') || user.id;
    
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

    console.log(`[Vouchers] Fetching vouchers for user: ${userId}`, year ? `for year: ${year}` : allYears ? 'for all years' : '');

    let vouchersData;
    
    if (allYears) {
      // Fetch vouchers for multiple years for financial analysis
      vouchersData = await fetchVouchersForMultipleYears(tokenData.access_token);
    } else {
      // Fetch vouchers for specific year or current year
      vouchersData = await fetchVouchers(tokenData.access_token, year || undefined);
    }
    
    console.log(`[Vouchers] Successfully fetched ${vouchersData.Vouchers?.length || 0} vouchers`);

    return NextResponse.json({
      Vouchers: vouchersData.Vouchers || [],
      MetaInformation: vouchersData.MetaInformation || {}
    });

  } catch (error) {
    console.error('[Vouchers] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch vouchers',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 