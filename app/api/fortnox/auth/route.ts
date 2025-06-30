import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { createClient } from '@supabase/supabase-js';

// Fortnox credentials
const CLIENT_ID = '4LhJwn68IpdR';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';
const AUTH_URL = 'https://apps.fortnox.se/oauth-v1/auth';
// Define all required scopes
const REQUIRED_SCOPES = ['companyinformation', 'invoice', 'customer', 'project', 'bookkeeping', 'payment'];

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

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return null;
  }

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
  // Get user from JWT token
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Use the expanded list of scopes
  const scopeStr = REQUIRED_SCOPES.join(' ');
  
  // Auth parameters
  const authParams = new URLSearchParams({
    'client_id': CLIENT_ID,
    'scope': scopeStr,
    'state': 'somestate123',
    'access_type': 'offline',
    'response_type': 'code',
    'redirect_uri': REDIRECT_URI
  });
  
  const authUrl = `${AUTH_URL}?${authParams.toString()}`;
  
  // Return the auth URL as JSON so frontend can redirect
  return NextResponse.json({ authUrl });
} 