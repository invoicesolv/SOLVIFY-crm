import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabase';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

import { GOOGLE_SCOPES } from '@/lib/oauth-scopes';

export async function GET(request: NextRequest) {
  console.log('🔍 Google OAuth callback called:', request.nextUrl.pathname);
  
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const error = searchParams.get('error');

  console.log('📋 OAuth callback params:', { 
    hasCode: !!code, 
    hasState: !!state, 
    error: error
  });

  // Handle OAuth errors
  if (error) {
    console.error('❌ Google OAuth error:', error);
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?status=error&error=${encodeURIComponent(error)}`);
  }

  if (!code) {
    console.error('❌ No authorization code received');
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?status=error&error=no_code`);
  }

  try {
    let userId;
    let selectedServices = [];
    
    // Parse state parameter to get user ID and selected services
    if (state) {
      try {
        const stateData = JSON.parse(atob(state));
        userId = stateData.userId;
        selectedServices = stateData.services || [];
        console.log('📋 Parsed state:', { userId, selectedServices });
      } catch (e) {
        console.error('Failed to parse state:', e);
      }
    }

    if (!userId) {
      throw new Error('No user ID found in state');
    }

    // Use the correct callback endpoint for token exchange
    const isDevelopment = request.nextUrl.origin.includes('localhost');
    const redirectUri = isDevelopment 
      ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3001'}/api/oauth/google/callback`
      : 'https://crm.solvify.se/api/oauth/google/callback';

    console.log('🔄 Exchanging code for tokens...', { redirectUri, environment: isDevelopment ? 'development' : 'production' });
    
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', errorText);
      throw new Error('Failed to get access token');
    }

    const tokenData = await tokenResponse.json();
    console.log('✅ Token exchange successful, scopes:', tokenData.scope);

    // Get the granted scopes
    const grantedScopes = tokenData.scope.split(' ');
    
    // Determine which services were authenticated based on the granted scopes
    const authenticatedServices = new Set<string>();
    grantedScopes.forEach((scope: string) => {
      const service = GOOGLE_SCOPES[scope as keyof typeof GOOGLE_SCOPES];
      if (service) {
        authenticatedServices.add(service);
      }
    });

    console.log('🔗 Authenticated services:', Array.from(authenticatedServices));

    // Save tokens to Supabase for each authenticated service
    const now = new Date();
    // Set expiration to 2 months for maximum duration
    const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 2 months

    for (const service of Array.from(authenticatedServices)) {
      console.log(`💾 Saving integration for ${service}...`);
      const { error } = await supabaseAdmin
        .from('integrations')
        .upsert({
          user_id: userId,
          service_name: service,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          scopes: grantedScopes,
          expires_at: expiresAt.toISOString(),
          updated_at: now.toISOString()
        }, {
          onConflict: 'user_id,service_name'
        });

      if (error) {
        console.error(`Failed to save integration for ${service}:`, error);
      } else {
        console.log(`✅ Saved integration for ${service}`);
      }
    }

    // Clean up the temporary cookies
    const cookieStore = cookies();
    cookieStore.delete('requested_scopes');
    cookieStore.delete('selected_services');

    // Redirect back with all authenticated services
    const servicesParam = Array.from(authenticatedServices).join(',');
    const redirectUrl = `${request.nextUrl.origin}/settings?auth=${servicesParam}&status=success`;
    
    console.log('🔙 Redirecting back to settings:', redirectUrl);
    return NextResponse.redirect(redirectUrl);
  } catch (error) {
    console.error('💥 Authentication error:', error);
    return NextResponse.redirect(`${request.nextUrl.origin}/settings?status=error&error=${encodeURIComponent(error instanceof Error ? error.message : 'Unknown error')}`);
  }
} 