import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';
import { supabase } from '@/lib/supabase';

// Re-export the GET function from the fetch route
export { GET } from './fetch/route';

// Optionally handle POST/DELETE/etc here or forward to the appropriate sub-route
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
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
      },
      body: JSON.stringify(body),
    });
    
    return response;
  }

  // Default return - unsupported action
  return NextResponse.json({ error: 'Unsupported action' }, { status: 400 });
} 