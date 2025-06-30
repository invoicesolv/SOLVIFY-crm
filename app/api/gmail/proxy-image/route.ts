import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { google } from 'googleapis';

// Helper function to get user from Supabase JWT token
async function getUserFromToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  
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

export async function GET(request: NextRequest) {
  try {
    // Get user from JWT token
    const user = await getUserFromToken(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get the target URL from the query string
    const { searchParams } = new URL(request.url);
    const imageUrl = searchParams.get('url');
    const messageId = searchParams.get('messageId');
    const attachmentId = searchParams.get('attachmentId');

    // If no URL is provided, return an error
    if (!imageUrl) {
      return new Response('Missing image URL', { status: 400 });
    }

    // Handle Content-ID (cid:) images - these are inline attachments
    if (imageUrl.startsWith('cid:') && messageId && attachmentId) {
      try {
        // Get access token
        const accessToken = (user as any).access_token;
        if (!accessToken) {
          return new Response('No access token available', { status: 401 });
        }

        // Create Gmail API client
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const gmail = google.gmail({ version: 'v1', auth: oauth2Client });

        // Fetch the attachment
        const attachment = await gmail.users.messages.attachments.get({
          userId: 'me',
          messageId: messageId,
          id: attachmentId
        });

        if (!attachment.data || !attachment.data.data) {
          return new Response('Attachment not found', { status: 404 });
        }

        // Convert base64 data to binary
        const binaryData = Buffer.from(attachment.data.data, 'base64');
        
        // Use a default content type since Schema$MessagePartBody doesn't expose mimeType
        const contentType = 'image/jpeg';
        
        return new Response(binaryData, {
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      } catch (error) {
        console.error('Error fetching inline attachment:', error);
        return new Response('Failed to fetch inline attachment', { status: 500 });
      }
    }

    // Validate external URL
    if (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://')) {
      return new Response('Invalid image URL', { status: 400 });
    }

    // Fetch the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Solvify/1.0; +https://solvify.se)'
      }
    });
    
    if (!response.ok) {
      return new Response('Failed to fetch image', { status: response.status });
    }

    // Get the image data
    const imageData = await response.arrayBuffer();
    
    // Get the content type from the response
    const contentType = response.headers.get('content-type') || 'image/jpeg';
    
    // Return the image with proper headers
    return new Response(imageData, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (error) {
    console.error('Error proxying image:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 