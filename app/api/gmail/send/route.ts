import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import authOptions from '@/lib/auth';
import { google } from 'googleapis';

export async function POST(request: Request) {
  try {
    // Get the user session
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const { threadId, to, subject, body } = await request.json();

    // Validate required fields
    if (!threadId || !to || !body) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
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

    try {
      // Create email content in RFC 822 format
      const utf8Subject = `=?utf-8?B?${Buffer.from(subject).toString('base64')}?=`;
      const messageParts = [
        `From: ${session.user.email}`,
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
      const res = await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
          threadId: threadId,
        },
      });

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
    
    // Handle token expiration or revocation
    if (error.message?.includes('invalid_grant') || error.message?.includes('Invalid Credentials')) {
      return NextResponse.json({ 
        error: 'Gmail authentication failed. Please reconnect your Gmail account.', 
        code: 'INVALID_TOKEN' 
      }, { status: 401 });
    }
    
    return NextResponse.json(
      { error: 'Failed to send email: ' + (error.message || 'Unknown error') },
      { status: 500 }
    );
  }
} 