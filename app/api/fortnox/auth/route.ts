import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Fortnox credentials
const CLIENT_ID = '4LhJwn68IpdR';
const REDIRECT_URI = 'https://crm.solvify.se/oauth/callback';
const AUTH_URL = 'https://apps.fortnox.se/oauth-v1/auth';
// Define all required scopes
const REQUIRED_SCOPES = ['companyinformation', 'invoice', 'customer', 'project', 'bookkeeping', 'payment'];

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
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
  
  // Redirect to Fortnox auth page
  return NextResponse.redirect(authUrl);
} 