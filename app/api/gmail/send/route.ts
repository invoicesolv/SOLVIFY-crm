import { NextRequest, NextResponse } from 'next/server';
import { supabaseClient } from '@/lib/supabase-client';
import { google } from 'googleapis';
import { supabaseAdmin } from '@/lib/supabase';
import { createClient } from '@supabase/supabase-js';

// Create Supabase admin client
function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseKey);
}

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  const supabaseAdmin = getSupabaseAdmin();
  
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) {
      return null;
    }
    return user;
  } catch (error) {
    console.error('Error verifying token:', error);
    return null;
  }
}

async function getRefreshedToken(userId: string): Promise<string | null> {
  try {
    const { data: integration, error } = await supabaseAdmin
      .from('integrations')
      .select('refresh_token, expires_at')
      .eq('user_id', userId)
      .eq('service_name', 'google-gmail')
      .single();

    if (error || !integration?.refresh_token) {
      console.error('No Google integration or refresh token found for user:', userId, error);
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

    const newExpiresAt = credentials.expiry_date ? new Date(credentials.expiry_date) : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
    const { error: updateError } = await supabaseAdmin
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

async function sendGmailMessage(accessToken: string, threadId: string, to: string, subject: string, body: string, fromEmail: string) {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  );
  oauth2Client.setCredentials({ access_token: accessToken });
  
  const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
  
  // Create email content in RFC 822 format
  const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
  const messageParts = [
    `From: ${fromEmail}`,
    `To: ${to}`,
    `Subject: ${utf8Subject}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    body,
  ];
  const message = messageParts.join('\n');

  // Encode the message to base64 format as required by Gmail API
  const encodedMessage = Buffer.from(message)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  // Send the email as a reply to the thread
  return await gmail.users.messages.send({
    userId: 'me',
    requestBody: {
      raw: encodedMessage,
      threadId: threadId,
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body  
    const { threadId, to, subject, body } = await request.json();

    // Validate required fields
    if (!threadId || !to || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if the user has Gmail integration
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('access_token, refresh_token')
      .eq('user_id', user.id)
      .eq('service_name', 'google-gmail')
      .maybeSingle();

    if (integrationError || !integration) {
      return NextResponse.json({ error: 'Gmail integration not found', code: 'NO_INTEGRATION' }, { status: 401 });
    }

    let accessToken = integration.access_token;

    // If no access token, try to refresh
    if (!accessToken) {
      const refreshedToken = await getRefreshedToken(user.id!);
      if (!refreshedToken) {
        return NextResponse.json({ 
          error: 'Failed to refresh access token', 
          code: 'AUTH_FAILED_AFTER_REFRESH' 
        }, { status: 401 });
      }
      accessToken = refreshedToken;
    }

    try {
      // Send the email
      const res = await sendGmailMessage(accessToken, threadId, to, subject, body, user.user_metadata.email!);
      
      // Log success and return response
      console.log('Email sent successfully:', res.data);
      return NextResponse.json({ success: true, messageId: res.data.id });
    } catch (apiError: any) {
      console.error('Gmail API Error:', apiError);
      
      // Handle specific Gmail API errors
      if (apiError.code === 403 || apiError.message?.includes('permission')) {
        return NextResponse.json({ 
          error: 'Insufficient permission. Please reconnect your Gmail account with the necessary permissions.',
          code: 'INSUFFICIENT_PERMISSION' 
        }, { status: 403 });
      }
      
      throw apiError; // Rethrow to be caught by outer catch block
    }
  } catch (error: any) {
    console.error('Error sending Gmail message:', error);
    
    // Handle token expiration or revocation with retry
    if (error.code === 401 || 
        error.message?.includes('invalid_grant') || 
        error.message?.includes('Invalid Credentials') ||
        (error.response && error.response.status === 401)) {
      
      console.log('[API/Gmail] 401 error detected, attempting token refresh and retry');
      const refreshedToken = await getRefreshedToken(user.id!);
      
      if (refreshedToken) {
        try {
          // Retry sending the email with refreshed token
          const retryRes = await sendGmailMessage(refreshedToken, threadId, to, subject, body, user.user_metadata.email!);
          
          console.log('[API/Gmail] Successfully sent email after token refresh');
          return NextResponse.json({ success: true, messageId: retryRes.data.id });
          
        } catch (retryError) {
          console.error('[API/Gmail] Retry failed after token refresh:', retryError);
        }
      }
      
      return NextResponse.json({ 
        error: 'Gmail authentication failed. Please reconnect your Gmail account.', 
        code: 'AUTH_FAILED_AFTER_REFRESH'
      }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to send email: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 