import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabase } from '@/lib/supabase';

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET!;

// Map scopes to services
const SCOPE_TO_SERVICE = {
  'https://www.googleapis.com/auth/analytics.readonly': 'google-analytics',
  'https://www.googleapis.com/auth/analytics': 'google-analytics',
  'https://www.googleapis.com/auth/webmasters.readonly': 'google-searchconsole',
  'https://www.googleapis.com/auth/webmasters': 'google-searchconsole',
  'https://www.googleapis.com/auth/calendar.readonly': 'google-calendar',
  'https://www.googleapis.com/auth/calendar': 'google-calendar',
  'https://www.googleapis.com/auth/drive.file': 'google-drive',
  'https://www.googleapis.com/auth/drive.appdata': 'google-drive',
  'https://www.googleapis.com/auth/drive.readonly': 'google-drive',
  'https://www.googleapis.com/auth/drive': 'google-drive',
  'https://www.googleapis.com/auth/drive.metadata': 'google-drive',
  'https://www.googleapis.com/auth/youtube': 'youtube',
  'https://www.googleapis.com/auth/youtube.upload': 'youtube',
  'https://www.googleapis.com/auth/youtube.readonly': 'youtube',
  'https://www.googleapis.com/auth/youtube.force-ssl': 'youtube'
};

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');
  const customScopes = searchParams.get('scopes');
  const providedRedirectUri = searchParams.get('redirect_uri');

  if (!code) {
    // Initial auth request
    const scope = customScopes || '';
    const redirectUri = providedRedirectUri || `${request.nextUrl.origin}/api/oauth/google/callback`;

    const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authUrl.searchParams.append('client_id', CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', redirectUri);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', scope);
    authUrl.searchParams.append('access_type', 'offline');
    authUrl.searchParams.append('prompt', 'consent');
    authUrl.searchParams.append('include_granted_scopes', 'true');
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

    return NextResponse.redirect(authUrl.toString());
  } else {
    // Handle callback with auth code
    try {
      let userId;
      let selectedServices = [];
      
      // Parse state parameter to get user ID and selected services
      if (state) {
        try {
          const stateData = JSON.parse(atob(state));
          userId = stateData.userId;
          selectedServices = stateData.services || [];
        } catch (e) {
          console.error('Failed to parse state:', e);
        }
      }

      if (!userId) {
        throw new Error('No user ID found in state');
      }

      const redirectUri = providedRedirectUri || `${request.nextUrl.origin}/api/oauth/google/callback`;

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
        throw new Error('Failed to get access token');
      }

      const tokenData = await tokenResponse.json();
      const cookieStore = cookies();

      // Get the granted scopes
      const grantedScopes = tokenData.scope.split(' ');
      
      // Determine which services were authenticated based on the granted scopes
      const authenticatedServices = new Set<string>();
      grantedScopes.forEach((scope: string) => {
        const service = SCOPE_TO_SERVICE[scope as keyof typeof SCOPE_TO_SERVICE];
        if (service) {
          authenticatedServices.add(service);
        }
      });

      // Save tokens to Supabase for each authenticated service
      const now = new Date();
      // Set expiration to 2 months for maximum duration
      const expiresAt = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000); // 2 months

      for (const service of Array.from(authenticatedServices)) {
        const { error } = await supabase
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
        }
      }

      // Clean up the temporary cookies
      cookieStore.delete('requested_scopes');
      cookieStore.delete('selected_services');

      // Encode token data for URL
      const encodedTokens = btoa(JSON.stringify({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        scope: tokenData.scope,
        expires_in: tokenData.expires_in
      }));

      // Redirect back with all authenticated services and tokens
      const servicesParam = Array.from(authenticatedServices).join(',');
      return NextResponse.redirect(
        `${request.nextUrl.origin}/settings?auth=${servicesParam}&status=success&tokens=${encodedTokens}`
      );
    } catch (error) {
      console.error('Authentication error:', error);
      return NextResponse.redirect(`${request.nextUrl.origin}/settings?status=error`);
    }
  }
} 