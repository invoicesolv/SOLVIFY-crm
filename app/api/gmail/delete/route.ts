import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { google } from 'googleapis';

async function getRefreshedToken(userId: string): Promise<string | null> {
  try {
    const supabase = supabaseClient;
    
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('service_name', 'google-gmail') 
      .single();

    if (error || !integration?.refresh_token) {
      console.error('No Google integration or refresh token found for user:', userId, error);
      return null;
    }

    const expiryDate = integration.expires_at ? new Date(integration.expires_at) : new Date();
    if (expiryDate > new Date(Date.now() + 5 * 60 * 1000)) {
      console.log('[API/Gmail] Token potentially valid, proceeding with existing token.');
      return null;
    }

    console.log('[API/Gmail] Refreshing Google token for user:', userId);
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: integration.refresh_token });

    const { credentials } = await oauth2Client.refreshAccessToken();
    
    if (!credentials.access_token) {
      throw new Error('Failed to refresh access token');
    }

    const newExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000); // 2 months
    const { error: updateError } = await supabase
      .from('integrations')
      .update({ 
        access_token: credentials.access_token,
        expires_at: newExpiresAt.toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .eq('service_name', 'google-gmail');

    if (updateError) {
      console.error('[API/Gmail] Failed to update new token in DB:', updateError);
    }

    console.log('[API/Gmail] Token refreshed successfully for user:', userId);
    return credentials.access_token;

  } catch (error) {
    console.error('[API/Gmail] Error refreshing token:', error);
    return null;
  }
}

export async function DELETE(req: NextRequest) {
  // Get the JWT token from the Authorization header
  const token = req.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify the token and get user
  const supabase = supabaseClient;
  
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = user.id;

  // Get the email ID from the URL parameters
  const url = new URL(req.url);
  const emailId = url.searchParams.get('id');
  
  if (!emailId) {
    return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
  }

  try {
    // First check if we need to refresh the token
    const newToken = await getRefreshedToken(userId);
    let accessToken = newToken;

    // If we still don't have a valid token, try to get it from the integrations table
    if (!accessToken) {
      const { data: integration, error } = await supabase
        .from('integrations')
        .select('access_token')
        .eq('user_id', userId)
        .eq('service_name', 'google-gmail')
        .single();

      if (error || !integration?.access_token) {
        return NextResponse.json({ error: 'No valid Gmail access token found' }, { status: 401 });
      }

      accessToken = integration.access_token;
    }

    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ access_token: accessToken });

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Trash the message (move to trash)
    await gmail.users.messages.trash({
      userId: 'me',
      id: emailId,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting email:', error);
    
    // If we get a 401 error, try to refresh the token and retry
    if (error.code === 401) {
      const newToken = await getRefreshedToken(userId);
      if (newToken) {
        try {
          const oauth2Client = new google.auth.OAuth2(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET
          );
          oauth2Client.setCredentials({ access_token: newToken });

          const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

          await gmail.users.messages.trash({
            userId: 'me',
            id: emailId,
          });

          return NextResponse.json({ success: true });
        } catch (retryError) {
          console.error('Error after token refresh:', retryError);
        }
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to delete email' },
      { status: error.code || 500 }
    );
  }
} 