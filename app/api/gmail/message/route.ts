import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { getUserFromToken } from '@/lib/auth-utils';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  try {
    // Use the centralized auth utility
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the email ID from query parameters
    const url = new URL(request.url);
    const messageId = url.searchParams.get('id');

    if (!messageId) {
      return NextResponse.json({ error: 'Missing email ID' }, { status: 400 });
    }

    console.log('🔍 Looking for Gmail integration for user:', user.id);
    
    // Get OAuth tokens specifically for Gmail
    const { data: integration, error: integrationError } = await supabaseAdmin
      .rpc('get_user_integration', {
        p_user_id: user.id,
        p_service_name: 'google-gmail'
      });

    console.log('🔍 Using dedicated Gmail integration');

    // Extract the actual integration data from the RPC response
    const actualIntegration = integration?.get_user_integration || integration;
    
    if (integrationError || !actualIntegration?.access_token) {
      console.log('❌ No Google integration found');
      return NextResponse.json({ 
        error: 'No Google integration found. Please connect your Google account in Settings.',
        code: 'NO_GOOGLE_INTEGRATION',
        requiresReconnect: true
      }, { status: 400 });
    }

    // Check if this integration has Gmail scopes
    const hasGmailScopes = actualIntegration.scopes?.some((scope: string) => 
      scope.includes('gmail') || scope.includes('mail.google.com')
    );

    if (!hasGmailScopes) {
      return NextResponse.json({ 
        error: 'Google integration does not have Gmail access. Please reconnect your Google account with Gmail permissions.',
        code: 'NO_GMAIL_SCOPES',
        requiresReconnect: true
      }, { status: 403 });
    }

    console.log('✅ Found Google integration with Gmail scopes');

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NODE_ENV === 'development' 
        ? 'http://localhost:3000/api/oauth/google/callback'
        : 'https://crm.solvify.se/api/oauth/google/callback'
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: actualIntegration.access_token,
      refresh_token: actualIntegration.refresh_token,
    });

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    console.log('📧 Attempting Gmail API call with FULL format...');
    
    // Get the full message with complete email body
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    });
    
    console.log('✅ Gmail FULL format access successful!');
    
    let body = '';
    let htmlBody = '';
    
    // Extract full email body from full format
    if (message.data.payload) {
      const extractBody = (payload: any): { text: string, html: string } => {
        let textBody = '';
        let htmlBody = '';
        
        if (payload.body && payload.body.data) {
          const bodyData = Buffer.from(payload.body.data, 'base64').toString('utf-8');
          if (payload.mimeType === 'text/plain') {
            textBody = bodyData;
          } else if (payload.mimeType === 'text/html') {
            htmlBody = bodyData;
          }
        }
        
        if (payload.parts) {
          for (const part of payload.parts) {
            const partBody = extractBody(part);
            if (partBody.text) textBody += partBody.text;
            if (partBody.html) htmlBody += partBody.html;
          }
        }
        
        return { text: textBody, html: htmlBody };
      };
      
      const extractedBody = extractBody(message.data.payload);
      body = extractedBody.text || message.data.snippet || '';
      htmlBody = extractedBody.html;
    }

    // Extract email headers
    let from = '';
    let fromEmail = '';
    let to = '';
    let subject = '';
    let date = '';
    
    if (message.data.payload && message.data.payload.headers) {
      for (const header of message.data.payload.headers) {
        if (header.name === 'From') {
          from = header.value || '';
          // Try to extract email from format "Name <email@example.com>"
          const emailMatch = from.match(/<([^>]+)>/);
          fromEmail = emailMatch ? emailMatch[1] : from;
        } else if (header.name === 'To') {
          to = header.value || '';
        } else if (header.name === 'Subject') {
          subject = header.value || '';
        } else if (header.name === 'Date') {
          date = header.value || '';
        }
      }
    }

    const response = {
      id: message.data.id,
      threadId: message.data.threadId,
      body: body,
      htmlBody: htmlBody,
      from,
      from_email: fromEmail,
      to,
      subject,
      date,
      hasFullAccess: true,
      limitedAccess: false,
      accessType: 'full',
      sizeEstimate: message.data.sizeEstimate,
      labels: message.data.labelIds || []
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('❌ Gmail API call failed:', error.code, error.message);
    
    if (error.code === 403) {
      return NextResponse.json({
        error: 'Gmail access denied. Your Google account connection has insufficient permissions.',
        code: 'GMAIL_ACCESS_DENIED',
        requiresReconnect: true,
        details: error.message,
        solution: 'Please disconnect and reconnect your Google account in Settings with full Gmail permissions.'
      }, { status: 403 });
    }

    return NextResponse.json({
      error: 'Gmail API error: ' + (error.message || 'Unknown error'),
      code: 'GMAIL_API_ERROR',
      requiresReconnect: false,
      details: error.message
    }, { status: 500 });
  }
}