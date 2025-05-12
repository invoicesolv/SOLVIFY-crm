import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { google } from 'googleapis';

export async function GET(request: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the email ID from query parameters
    const url = new URL(request.url);
    const messageId = url.searchParams.get('id');

    if (!messageId) {
      return NextResponse.json({ error: 'Missing email ID' }, { status: 400 });
    }

    // Get OAuth tokens
    const accessToken = (session as any).access_token;
    const refreshToken = (session as any).refresh_token;

    if (!accessToken) {
      return NextResponse.json({ error: 'No Gmail integration found', code: 'NO_INTEGRATION' }, { status: 400 });
    }

    // Create OAuth2 client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.NEXTAUTH_URL + '/api/auth/callback/google'
    );

    // Set credentials
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken,
    });

    // Create Gmail API client
    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

    // Fetch the message details
    const message = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    // Process email body - extract both plain text and HTML versions
    let plainText = '';
    let htmlBody = '';
    const payload = message.data.payload;
    
    if (payload) {
      // Function to recursively extract the different parts of the email
      const extractParts = (parts: any[]) => {
        let foundText = '';
        let foundHtml = '';
        
        for (const part of parts) {
          if (part.mimeType === 'text/plain' && part.body && part.body.data) {
            foundText = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.mimeType === 'text/html' && part.body && part.body.data) {
            foundHtml = Buffer.from(part.body.data, 'base64').toString('utf-8');
          } else if (part.parts) {
            const { text, html } = extractParts(part.parts);
            if (text && !foundText) foundText = text;
            if (html && !foundHtml) foundHtml = html;
          }
        }
        
        return { text: foundText, html: foundHtml };
      };

      // Try to get the body from parts
      if (payload.parts) {
        const { text, html } = extractParts(payload.parts);
        plainText = text;
        htmlBody = html;
      } 
      // If no parts, try the body directly
      else if (payload.body && payload.body.data) {
        // Check the MIME type of the message
        if (payload.mimeType === 'text/plain') {
          plainText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else if (payload.mimeType === 'text/html') {
          htmlBody = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        } else {
          // Default to treating as plain text if we can't determine
          plainText = Buffer.from(payload.body.data, 'base64').toString('utf-8');
        }
      }
    }

    // If we only have HTML, do a basic conversion to get plaintext
    if (!plainText && htmlBody) {
      // Very basic HTML to text conversion (can be improved)
      plainText = htmlBody
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<[^>]+>/g, '') // Remove HTML tags
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    // Fetch message headers
    let from = '';
    let fromEmail = '';
    let subject = '';
    let date = '';
    
    if (payload && payload.headers) {
      for (const header of payload.headers) {
        if (header.name === 'From') {
          from = header.value || '';
          // Try to extract email from format "Name <email@example.com>"
          const emailMatch = from.match(/<([^>]+)>/);
          fromEmail = emailMatch ? emailMatch[1] : from;
        } else if (header.name === 'Subject') {
          subject = header.value || '';
        } else if (header.name === 'Date') {
          date = header.value || '';
        }
      }
    }

    return NextResponse.json({
      id: message.data.id,
      threadId: message.data.threadId,
      body: plainText,            // Plain text version
      htmlBody: htmlBody,         // HTML version (if available)
      from,
      from_email: fromEmail,
      subject,
      date
    });
  } catch (error: any) {
    console.error('Error fetching Gmail message:', error);
    
    // Handle token expiration or revocation
    if (error.message?.includes('invalid_grant') || error.message?.includes('Invalid Credentials')) {
      return NextResponse.json({ error: 'Gmail authentication failed', code: 'INVALID_TOKEN' }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to fetch email message: ' + error.message },
      { status: 500 }
    );
  }
} 