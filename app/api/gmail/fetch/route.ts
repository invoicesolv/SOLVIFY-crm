import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { google } from 'googleapis';
import authOptions from '@/lib/auth'; // Assuming authOptions includes credentials
import { supabase } from '@/lib/supabase'; // Import supabase client

export const dynamic = 'force-dynamic';

// Function to get a refreshed access token if needed
async function getRefreshedToken(userId: string): Promise<string | null> {
  try {
    const { data: integration, error } = await supabase
      .from('integrations')
      .select('refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('service_name', 'google-gmail') // Ensure we get the Gmail token
      .single();

    if (error || !integration?.refresh_token) {
      console.error('No Google integration or refresh token found for user:', userId, error);
      return null;
    }

    // Check if token is expired or close to expiring (e.g., within 5 minutes)
    const expiryDate = integration.expires_at ? new Date(integration.expires_at) : new Date();
    if (expiryDate > new Date(Date.now() + 5 * 60 * 1000)) {
       // Token is still valid, no need to refresh immediately in this check, 
       // but the API call might still fail if it just expired.
       // We rely on the main API call to handle potential 401 and trigger refresh then.
       console.log('[API/Gmail] Token potentially valid, proceeding with existing token.');
       return null; // Indicate no refresh needed *right now*
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

    // Update the database with the new token and expiry
    const newExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 3600 * 1000);
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
        // Continue with the new token anyway, but log the error
    }

    console.log('[API/Gmail] Token refreshed successfully for user:', userId);
    return credentials.access_token;

  } catch (error) {
    console.error('[API/Gmail] Error refreshing token:', error);
    return null;
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized: No valid session' }, { status: 401 });
  }

  const userId = session.user.id;
  let accessToken = (session as any).access_token;

  // Try to get token from integrations table if not in session
  if (!accessToken) {
    console.log('[API/Gmail] No access token in session, trying integrations table');
    try {
      const { data: integration, error } = await supabase
        .from('integrations')
        .select('access_token')
        .eq('user_id', userId)
        .eq('service_name', 'google-gmail')
        .single();

      if (error) {
        console.error('[API/Gmail] Error fetching token from integrations:', error);
        return NextResponse.json({ 
          error: 'Gmail integration not found. Please connect your Gmail account in settings.',
          code: 'NO_INTEGRATION' 
        }, { status: 401 });
      }

      accessToken = integration.access_token;
    } catch (error) {
      console.error('[API/Gmail] Error fetching token:', error);
      return NextResponse.json({ error: 'Failed to retrieve Gmail token' }, { status: 500 });
    }
  }

  // Check if we need to refresh the token
  const newToken = await getRefreshedToken(userId);
  if (newToken) {
    accessToken = newToken;
  }

  if (!accessToken) {
    return NextResponse.json({ 
      error: 'No valid Gmail access token. Please reconnect your Gmail account in settings.',
      code: 'INVALID_TOKEN' 
    }, { status: 401 });
  }

  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });

  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

  try {
    // Get custom search query from URL params
    const url = new URL(req.url);
    const customQuery = url.searchParams.get('q');
    
    // Use the provided query or default to showing all recent emails (no filters)
    const searchQuery = customQuery || '';
    console.log(`[API/Gmail] Fetching emails with query: ${searchQuery}`); 

    const response = await gmail.users.messages.list({
      userId: 'me',
      q: searchQuery, 
      maxResults: 50,
    });

    const messages = response.data.messages || [];
    if (messages.length === 0) {
      return NextResponse.json({ emails: [] });
    }

    // Fetch full details for each message
    const emailPromises = messages.map(async (message) => {
      try {
        const { data: fullMessage } = await gmail.users.messages.get({
          userId: 'me',
          id: message.id!,
          format: 'metadata',
          metadataHeaders: ['From', 'Subject', 'Date'],
        });

        const headers = fullMessage.payload?.headers || [];
        const from = headers.find(h => h.name === 'From')?.value || '';
        const subject = headers.find(h => h.name === 'Subject')?.value || '';
        const date = headers.find(h => h.name === 'Date')?.value || '';
        
        // Check if the email is unread
        const isUnread = fullMessage.labelIds?.includes('UNREAD') || false;

        // Extract email address from "Name <email@example.com>" format
        const fromEmail = from.match(/<([^>]+)>/) ? from.match(/<([^>]+)>/)?.[1] : from;

        return {
          id: fullMessage.id!,
          threadId: fullMessage.threadId!,
          snippet: fullMessage.snippet || '',
          from,
          from_email: fromEmail,
          subject,
          date,
          unread: isUnread,
        };
      } catch (error) {
        console.error(`[API/Gmail] Error fetching email ${message.id}:`, error);
        return null;
      }
    });

    const emails = (await Promise.all(emailPromises)).filter(email => email !== null);

    return NextResponse.json({ emails });
  } catch (error: any) {
    console.error('Error fetching emails:', error);

    // Check if it's an auth error and try to refresh the token
    if (error.code === 401 || (error.response && error.response.status === 401)) {
      const newToken = await getRefreshedToken(userId);
      if (newToken) {
        // Retry the request with the new token
        oauth2Client.setCredentials({ access_token: newToken });
        try {
          // Get custom search query from URL params again
          const url = new URL(req.url);
          const customQuery = url.searchParams.get('q');
          
          const response = await gmail.users.messages.list({
            userId: 'me',
            q: '', // No filter, show all emails
            maxResults: 50,
          });

          const messages = response.data.messages || [];
          if (messages.length === 0) {
            return NextResponse.json({ emails: [] });
          }

          const emailPromises = messages.map(async (message) => {
            try {
              const { data: fullMessage } = await gmail.users.messages.get({
                userId: 'me',
                id: message.id!,
                format: 'metadata',
                metadataHeaders: ['From', 'Subject', 'Date'],
              });

              const headers = fullMessage.payload?.headers || [];
              const from = headers.find(h => h.name === 'From')?.value || '';
              const subject = headers.find(h => h.name === 'Subject')?.value || '';
              const date = headers.find(h => h.name === 'Date')?.value || '';
              
              // Check if the email is unread
              const isUnread = fullMessage.labelIds?.includes('UNREAD') || false;
              
              // Extract email address
              const fromEmail = from.match(/<([^>]+)>/) ? from.match(/<([^>]+)>/)?.[1] : from;

              return {
                id: fullMessage.id!,
                threadId: fullMessage.threadId!,
                snippet: fullMessage.snippet || '',
                from,
                from_email: fromEmail,
                subject,
                date,
                unread: isUnread,
              };
            } catch (error) {
              console.error(`[API/Gmail] Error fetching email ${message.id} after token refresh:`, error);
              return null;
            }
          });

          const emails = (await Promise.all(emailPromises)).filter(email => email !== null);
          return NextResponse.json({ emails });
        } catch (retryError) {
          console.error('Error after token refresh:', retryError);
          return NextResponse.json(
            { 
              error: 'Failed to access Gmail even after token refresh. Please reconnect your Gmail account.',
              code: 'AUTH_FAILED_AFTER_REFRESH'
            },
            { status: 403 }
          );
        }
      } else {
        return NextResponse.json(
          { 
            error: 'Gmail authentication failed and token refresh failed. Please reconnect your Gmail account in settings.',
            code: 'REFRESH_FAILED'
          },
          { status: 401 }
        );
      }
    }

    // Handle permission errors with a clearer message
    if (error.code === 403 || (error.response && error.response.status === 403)) {
      return NextResponse.json(
        { 
          error: 'Gmail access denied. You may need additional permissions. Please reconnect your Gmail account with the correct scopes.',
          code: 'PERMISSION_DENIED'
        },
        { status: 403 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch emails', details: error.message },
      { status: error.code || 500 }
    );
  }
} 