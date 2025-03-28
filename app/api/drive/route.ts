import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../auth/[...nextauth]/route';
import { supabase } from '@/lib/supabase';

async function getAccessToken(userId: string): Promise<string | null> {
  console.log('Getting Drive token for user:', userId);
  
  const { data: integration, error } = await supabase
    .from('integrations')
    .select('access_token, refresh_token, expires_at, scopes')
    .eq('user_id', userId)
    .eq('service_name', 'google-drive')
    .single();

  if (error) {
    console.error('Error fetching Drive token:', {
      error,
      userId,
      service: 'google-drive'
    });
    return null;
  }

  if (!integration) {
    console.error('No Drive integration found for user:', {
      userId,
      service: 'google-drive'
    });
    return null;
  }

  console.log('Found Drive integration:', {
    hasAccessToken: !!integration.access_token,
    hasRefreshToken: !!integration.refresh_token,
    expiresAt: integration.expires_at,
    scopes: integration.scopes
  });

  // Check if token is expired
  if (new Date(integration.expires_at) <= new Date()) {
    console.error('Drive token is expired:', {
      expiresAt: integration.expires_at,
      now: new Date().toISOString()
    });
    return null;
  }

  return integration.access_token;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { action, ...params } = await request.json();

    // Get access token for all actions
    const accessToken = await getAccessToken(userId);
    if (!accessToken) {
      return NextResponse.json({ error: 'Drive not connected' }, { status: 401 });
    }

    switch (action) {
      case 'get_token': {
        return NextResponse.json({ accessToken });
      }
      case 'create_folder':
        return await createFolder(accessToken, params.name);
      case 'upload_file':
        return await uploadFile(accessToken, params.folderId, params.file, params.filename);
      case 'list_files':
        return await listFiles(accessToken, params.folderId);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error: any) {
    console.error('Drive API error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function createFolder(accessToken: string, name: string) {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name,
      mimeType: 'application/vnd.google-apps.folder'
    })
  });

  if (!response.ok) {
    throw new Error('Failed to create folder');
  }

  const data = await response.json();
  return NextResponse.json(data);
}

async function uploadFile(accessToken: string, folderId: string, file: any, filename: string) {
  const metadata = {
    name: filename,
    parents: folderId ? [folderId] : []
  };

  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  form.append('file', file);

  const response = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: form
  });

  if (!response.ok) {
    throw new Error('Failed to upload file');
  }

  const data = await response.json();
  return NextResponse.json(data);
}

async function listFiles(accessToken: string, folderId?: string) {
  try {
    // First verify the token works by getting user info
    console.log('Verifying Drive access token...');
    const userInfoResponse = await fetch('https://www.googleapis.com/drive/v3/about?fields=user', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (!userInfoResponse.ok) {
      const errorData = await userInfoResponse.json().catch(() => null);
      console.error('Drive token verification failed:', {
        status: userInfoResponse.status,
        statusText: userInfoResponse.statusText,
        error: errorData
      });
      throw new Error('Invalid Drive token');
    }

    const userInfo = await userInfoResponse.json();
    console.log('Drive token verified for user:', userInfo);

    // List all files
    console.log('Fetching files...');
    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files?q=trashed=false&orderBy=modifiedTime desc&fields=files(id,name,mimeType,webViewLink,iconLink,size,modifiedTime,exportLinks,parents)&pageSize=100&supportsAllDrives=true&includeItemsFromAllDrives=true`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      console.error('Drive API error:', {
        status: response.status,
        statusText: response.statusText,
        error: errorData
      });
      throw new Error('Failed to list files');
    }

    const data = await response.json();
    console.log('Files found:', {
      totalFiles: data.files?.length || 0,
      files: data.files?.map((f: { name: string, mimeType: string }) => ({
        name: f.name,
        type: f.mimeType
      })) || []
    });
    
    // Add download URLs for spreadsheets
    const files = data.files?.map((file: any) => ({
      ...file,
      downloadUrl: file.mimeType.includes('spreadsheet') 
        ? `https://www.googleapis.com/drive/v3/files/${file.id}/export?mimeType=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
        : `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`,
    })) || [];

    return NextResponse.json({ files });
  } catch (error: any) {
    console.error('Error in listFiles:', {
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
} 