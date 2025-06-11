import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

// LinkedIn OAuth callback
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.id) {
    console.error('LinkedIn OAuth callback: No user session found');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/login`));
  }

  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    console.error('LinkedIn OAuth error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=linkedin_auth_failed`));
  }

  if (!code) {
    console.error('LinkedIn OAuth callback: No authorization code received');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=no_code`));
  }

  try {
    console.log('LinkedIn OAuth: Exchanging code for access token');
    
    // Exchange code for access token
    const tokenResponse = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        client_id: process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri: `${process.env.NEXTAUTH_URL}/api/oauth/linkedin/callback`,
      }),
    });

    const tokenData = await tokenResponse.json();
    console.log('LinkedIn OAuth: Token response status:', tokenResponse.status);

    if (!tokenResponse.ok) {
      console.error('LinkedIn OAuth token error:', tokenData);
      throw new Error(tokenData.error_description || 'Failed to exchange code for token');
    }

    console.log('LinkedIn OAuth: Successfully received access token');

    // TODO: Store the access token in your database
    // This is where you'd save the LinkedIn connection for the user
    
    console.log('LinkedIn OAuth: Redirecting to settings with success');
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?success=linkedin_connected`));
  } catch (error) {
    console.error('LinkedIn OAuth callback error:', error);
    return NextResponse.redirect(new URL(`${process.env.NEXTAUTH_URL}/settings?error=linkedin_auth_failed`));
  }
} 