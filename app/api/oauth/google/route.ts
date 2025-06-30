import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseClient as supabase } from '@/lib/supabase-client';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

import { GOOGLE_SCOPES } from '@/lib/oauth-scopes';

export async function GET(request: NextRequest) {
  console.log('🔍 Google OAuth route called:', request.nextUrl.pathname);
  
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const customScopes = searchParams.get('scopes');
  const providedRedirectUri = searchParams.get('redirect_uri');

  console.log('📋 OAuth params:', { 
    hasCode: !!code, 
    hasState: !!state, 
    customScopes: customScopes?.substring(0, 100) + '...', 
    providedRedirectUri 
  });

  if (!code) {
    // Initial auth request - redirect to Google OAuth
    const scope = customScopes || '';
    
    // Use the correct callback endpoint that matches Google OAuth configuration
    const isDevelopment = request.nextUrl.origin.includes('localhost');
    const redirectUri = providedRedirectUri || 
      (isDevelopment 
        ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/oauth/google/callback`
        : 'https://crm.solvify.se/api/oauth/google/callback'
      );

    console.log('🚀 Creating Google OAuth URL:', { 
      scope: scope.substring(0, 100) + '...', 
      redirectUri,
      environment: isDevelopment ? 'development' : 'production'
    });

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    if (state) {
      authUrl.searchParams.append('state', state);
    }

    // Store the requested scopes and services in cookies
    const cookieStore = cookies();
    cookieStore.set('requested_scopes', scope, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 300 // 5 minutes
    });
    
    if (providedRedirectUri) {
      cookieStore.set('selected_services', providedRedirectUri, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 300 // 5 minutes
      });
    }

    console.log('🔗 Redirecting to Google:', authUrl.toString());
    return NextResponse.redirect(authUrl.toString());
  } else {
    // This route should not handle callbacks - redirect to callback endpoint
    console.log('📥 Received callback on main route, redirecting to callback endpoint');
    const callbackUrl = new URL(`${request.nextUrl.origin}/api/oauth/google/callback`);
    
    // Forward all parameters to the callback endpoint
    searchParams.forEach((value, key) => {
      callbackUrl.searchParams.append(key, value);
    });
    
    return NextResponse.redirect(callbackUrl.toString());
  }
} 