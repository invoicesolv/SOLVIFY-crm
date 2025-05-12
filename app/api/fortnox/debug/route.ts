import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Create Supabase client at runtime only
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // Check for both variable names, preferring the non-public one if both exist
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Define API test response types
type ApiTestSuccess = {
  status: 'success';
  status_code: number;
  invoices_count: number;
};

type ApiTestError = {
  status: 'error';
  status_code: number;
  response: string;
};

type ApiTestException = {
  status: 'exception';
  error: string;
};

type ApiTest = ApiTestSuccess | ApiTestError | ApiTestException | null;

// Diagnostic endpoint
export async function GET(req: NextRequest) {
  console.log('\n=== Fortnox API Diagnostic ===');
  
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
    // Check if settings table exists and fetch structure
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .rpc('get_table_definition', { table_name: 'settings' });
    
    if (tableError) {
      return NextResponse.json(
        { error: 'Error checking settings table', details: tableError }, 
        { status: 500 }
      );
    }
    
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
    
    // Sanitize token data for response
    const sanitizedTokens = tokens?.map(token => {
      const { access_token, refresh_token, ...rest } = token;
      return {
        ...rest,
        has_access_token: !!access_token,
        has_refresh_token: !!refresh_token,
        access_token_preview: access_token ? `${access_token.substring(0, 5)}...` : null,
      };
    });
    
    // Test Fortnox API with minimal date range
    let apiTest: ApiTest = null;
    if (tokens && tokens.length > 0 && tokens[0].access_token) {
      try {
        const today = new Date();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const day = today.getDate();
        
        const dateStr = `${year}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
        const url = `https://api.fortnox.se/3/invoices?fromdate=${dateStr}&todate=${dateStr}`;
        
        console.log(`Testing Fortnox API with URL: ${url}`);
        
        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${tokens[0].access_token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
        
        if (response.status === 200) {
          const data = await response.json();
          apiTest = {
            status: 'success',
            status_code: response.status,
            invoices_count: data.Invoices ? data.Invoices.length : 0
          };
        } else {
          const text = await response.text();
          apiTest = {
            status: 'error',
            status_code: response.status,
            response: text
          };
        }
      } catch (e) {
        apiTest = {
          status: 'exception',
          error: e instanceof Error ? e.message : String(e)
        };
      }
    }
    
    return NextResponse.json({
      table_info: tableInfo,
      token_count: tokens?.length || 0,
      tokens: sanitizedTokens,
      api_test: apiTest,
      server_time: new Date().toISOString(),
      years: [new Date().getFullYear(), new Date().getFullYear() + 1]
    });
  } catch (error) {
    console.error('Diagnostic error:', error);
    return NextResponse.json(
      { error: 'Diagnostic failed', details: error instanceof Error ? error.message : String(error) }, 
      { status: 500 }
    );
  }
} 