import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client for database operations only
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Helper function to get user from NextAuth session
async function getUserFromSession() {
  try {
    const session = await getServerSession();
    return session?.user || null;
  } catch (error) {
    console.error('Error getting user from session:', error);
    return null;
  }
}

// Re-export the GET function from the fetch route
export { GET } from './fetch/route';

// Optionally handle POST/DELETE/etc here or forward to the appropriate sub-route
export async function POST(req: NextRequest) {
  // Get user from NextAuth session
  const user = await getUserFromSession();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized: No valid session' }, { status: 401 });
  }

  // Forward to the appropriate route based on the action
  const body = await req.json();
  const action = body.action;

  if (action === 'delete') {
    // Forward to delete route
    const response = await fetch(new URL('/api/gmail/delete', req.url), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('authorization') || '',
      },
      body: JSON.stringify(body),
    });
    
    return response;
  }

  // Default return - unsupported action
  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
} 