import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    const authStatus = {
      timestamp: new Date().toISOString(),
      session: {
        exists: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id || null,
        userEmail: session?.user?.email || null,
        hasAccessToken: !!(session as any)?.access_token,
        hasRefreshToken: !!(session as any)?.refresh_token,
      },
      environment: {
        nodeEnv: process.env.NODE_ENV,
        nextAuthUrl: process.env.NEXTAUTH_URL,
        hasFacebookAppId: !!process.env.FACEBOOK_APP_ID,
        hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      },
      instagram: {
        fallbackUrl: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : (process.env.NEXTAUTH_URL || 'https://crm.solvify.se')}/api/oauth/instagram-fallback?state=debug-test`,
        callbackUrl: `${process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : (process.env.NEXTAUTH_URL || 'https://crm.solvify.se')}/api/oauth/instagram/callback`,
      },
      instructions: [
        "1. Make sure you're logged in to the CRM system first",
        "2. Then try the Instagram OAuth flow",
        "3. On Facebook's permission screen, click 'Continue' or 'Allow' (don't cancel)",
        "4. Grant all requested permissions for the integration to work",
        "5. If you see 'Invalid Scopes: instagram_basic', the Facebook configuration still has the deprecated permission"
      ]
    };

    return NextResponse.json(authStatus, { status: 200 });
  } catch (error) {
    console.error('🔴 [AUTH STATUS] Error:', error);
    return NextResponse.json({ 
      error: 'Failed to check auth status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 