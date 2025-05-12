import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox API URL
const BASE_API_URL = 'https://api.fortnox.se/3/';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';

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

export async function GET(req: NextRequest) {
  console.log('\n=== Verifying Fortnox Token ===');
  
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Server configuration error: Supabase not initialized' }, 
      { status: 500 }
    );
  }
  
  // Get user ID from session
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    console.log(`Checking Fortnox token for user ID: ${session.user.id}`);
    console.log(`User email: ${session.user.email || 'not available'}`);
    
    // Check the database structure first
    console.log('Verifying settings table structure...');
    const { data: tableInfo, error: tableError } = await supabaseAdmin
      .from('settings')
      .select('*')
      .limit(1);
    
    if (tableError) {
      console.error('Error querying settings table:', tableError);
      return NextResponse.json({
        verified: false,
        database_check: 'failed',
        error: `Settings table error: ${tableError.message}`
      });
    }
    
    console.log(`Settings table exists. Sample data attributes: ${tableInfo && tableInfo.length > 0 ? Object.keys(tableInfo[0]).join(', ') : 'No sample data'}`);
    
    // Check the database for token
    console.log('Querying for Fortnox token...');
    const { data, error } = await supabaseAdmin
      .from('settings')
      .select('*')
      .eq('service_name', 'fortnox')
      .eq('user_id', session.user.id)
      .single();
    
    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ 
        verified: false, 
        has_token: false,
        database_check: 'passed',
        query_error: error.message,
        error: 'Database error when fetching token'
      });
    }
    
    if (!data) {
      console.log('No Fortnox token found for user');
      
      // Check if there are any Fortnox tokens in the system
      const { data: allTokens, error: countError } = await supabaseAdmin
        .from('settings')
        .select('user_id')
        .eq('service_name', 'fortnox');
      
      let totalTokenCount = 0;
      if (!countError && allTokens) {
        totalTokenCount = allTokens.length;
        console.log(`Found ${totalTokenCount} total Fortnox tokens in the system`);
        if (totalTokenCount > 0) {
          console.log(`User IDs with tokens: ${allTokens.map(t => t.user_id).join(', ')}`);
        }
      }
      
      return NextResponse.json({ 
        verified: false, 
        has_token: false,
        database_check: 'passed',
        total_fortnox_tokens: totalTokenCount,
        error: 'No Fortnox token found'
      });
    }
    
    // Check token data - could be in direct columns or in settings_data
    // Try direct columns first, then fall back to settings_data
    const accessToken = data.access_token || (data.settings_data && data.settings_data.access_token);
    const refreshToken = data.refresh_token || (data.settings_data && data.settings_data.refresh_token);
    const expiresAtStr = data.expires_at || (data.settings_data && data.settings_data.expires_at);
    const expiresAt = expiresAtStr ? new Date(expiresAtStr) : null;
    const now = new Date();
    
    console.log(`Found token record ID: ${data.id}`);
    console.log(`Access token (first 10 chars): ${accessToken ? accessToken.substring(0, 10) + '...' : 'missing'}`);
    console.log(`Refresh token (first 10 chars): ${refreshToken ? refreshToken.substring(0, 10) + '...' : 'missing'}`);
    console.log(`Token expires at: ${expiresAt ? expiresAt.toISOString() : 'unknown'}, Current time: ${now.toISOString()}`);
    console.log(`Token expired: ${expiresAt && expiresAt <= now ? 'YES' : 'NO'}`);
    console.log(`Record created at: ${data.created_at || 'not available'}`);
    console.log(`Record last updated at: ${data.updated_at || 'not available'}`);
    console.log(`Settings data JSON: ${data.settings_data ? 'present' : 'missing'}`);
    
    if (!accessToken) {
      return NextResponse.json({ 
        verified: false, 
        has_token: false,
        has_refresh_token: !!refreshToken,
        database_record_exists: true,
        error: 'Access token is missing'
      });
    }
    
    // Test token against Fortnox API
    console.log('Testing token against Fortnox API...');
    console.log(`Using API URL: ${BASE_API_URL}companyinformation`);
    const apiResponse = await fetch(`${BASE_API_URL}companyinformation`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });
    
    console.log(`API response status: ${apiResponse.status}`);
    
    if (apiResponse.status === 200) {
      const companyInfo = await apiResponse.json();
      console.log('✅ Token is valid, API call successful');
      console.log(`Company name: ${companyInfo.CompanyInformation?.Name || 'not available'}`);
      console.log(`Organization number: ${companyInfo.CompanyInformation?.OrganizationNumber || 'not available'}`);
      return NextResponse.json({
        verified: true,
        has_token: true,
        database_record_exists: true,
        company_info: companyInfo.CompanyInformation,
        expires_at: expiresAt?.toISOString(),
        token_data: {
          expires_at: expiresAtStr,
          created_at: data.created_at,
          updated_at: data.updated_at
        }
      });
    } else {
      const errorText = await apiResponse.text();
      console.error(`❌ API error: ${errorText}`);
      return NextResponse.json({
        verified: false,
        has_token: true,
        token_tested: true,
        token_valid: false,
        status_code: apiResponse.status,
        token_data: {
          expires_at: expiresAtStr,
          created_at: data.created_at,
          updated_at: data.updated_at
        },
        error: `API rejected token with status ${apiResponse.status}`
      });
    }
  } catch (e) {
    console.error('Error verifying token:', e);
    return NextResponse.json({
      verified: false,
      error: 'Error verifying token: ' + (e instanceof Error ? e.message : String(e))
    });
  }
} 