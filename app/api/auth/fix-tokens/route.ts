import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import authOptions from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    // Check session details
    const sessionDetails = {
      userId: session.user.id,
      email: session.user.email,
      name: session.user.name,
      hasAccessToken: !!(session as any).access_token,
      hasRefreshToken: !!(session as any).refresh_token,
      expires: session.expires
    };

    return NextResponse.json({
      status: 'session_check',
      timestamp: new Date().toISOString(),
      session: sessionDetails,
      message: 'Session information retrieved successfully',
      recommendations: [
        'If access tokens are missing, try signing out and signing back in',
        'Check if session has expired and needs refresh',
        'Verify NextAuth configuration for token persistence'
      ]
    });

  } catch (error: any) {
    console.error('Auth token check error:', error);
    return NextResponse.json({ 
      error: 'Failed to check auth tokens', 
      details: error.message 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No active session' }, { status: 401 });
    }

    const { action } = await request.json();
    
    if (action === 'refresh_session') {
      // Simple session refresh attempt
      const newSession = await getServerSession(authOptions);
      
      return NextResponse.json({
        status: 'refresh_attempted',
        message: 'Session refresh attempted',
        hasSession: !!newSession,
        userId: newSession?.user?.id || null
      });
    }
    
    return NextResponse.json({
      error: 'Unknown action'
    }, { status: 400 });

  } catch (error: any) {
    console.error('Auth token fix action error:', error);
    return NextResponse.json({ 
      error: 'Failed to perform auth fix action', 
      details: error.message 
    }, { status: 500 });
  }
} 