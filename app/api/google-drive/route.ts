import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Missing Supabase environment variables');
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, userId, ...params } = body;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    // Get Google Drive integration
    const supabaseAdmin = getSupabaseAdmin();
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('integrations')
      .select('*')
      .eq('user_id', userId)
      .eq('service_name', 'google-drive')
      .single();

    if (integrationError || !integration) {
      return NextResponse.json(
        { error: 'Google Drive integration not found. Please connect Google Drive first.' },
        { status: 404 }
      );
    }

    // Set up Google Drive API client
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    oauth2Client.setCredentials({
      access_token: integration.access_token,
      refresh_token: integration.refresh_token,
    });

    const drive = google.drive({ version: 'v3', auth: oauth2Client });

    switch (action) {
      case 'create_folder':
        return await createFolder(drive, params);
      
      case 'share_folder':
        return await shareFolder(drive, params);
      
      case 'list_files':
        return await listFiles(drive, params);
      
      case 'get_storage_info':
        return await getStorageInfo(drive);
      
      case 'upload_file':
        return await uploadFile(drive, params);
      
      case 'delete_file':
        return await deleteFile(drive, params);
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Google Drive API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function createFolder(drive: any, params: any) {
  const { name, parentId, description } = params;

  if (!name) {
    return NextResponse.json(
      { error: 'Folder name is required' },
      { status: 400 }
    );
  }

  try {
    const fileMetadata = {
      name: name,
      mimeType: 'application/vnd.google-apps.folder',
      parents: parentId ? [parentId] : undefined,
      description: description || undefined
    };

    const response = await drive.files.create({
      resource: fileMetadata,
      fields: 'id, name, parents, createdTime, modifiedTime, webViewLink'
    });

    return NextResponse.json({
      success: true,
      folder: response.data,
      message: `Folder '${name}' created successfully`
    });

  } catch (error) {
    console.error('Error creating folder:', error);
    return NextResponse.json(
      { error: 'Failed to create folder' },
      { status: 500 }
    );
  }
}

async function shareFolder(drive: any, params: any) {
  const { folderId, email, role = 'reader', type = 'user', sendNotificationEmail = true } = params;

  if (!folderId) {
    return NextResponse.json(
      { error: 'Folder ID is required' },
      { status: 400 }
    );
  }

  try {
    const permission = {
      type: type, // 'user', 'group', 'domain', 'anyone'
      role: role, // 'owner', 'organizer', 'fileOrganizer', 'writer', 'commenter', 'reader'
      emailAddress: email
    };

    const response = await drive.permissions.create({
      fileId: folderId,
      resource: permission,
      sendNotificationEmail: sendNotificationEmail,
      fields: 'id, type, role, emailAddress'
    });

    // Get folder info
    const folderInfo = await drive.files.get({
      fileId: folderId,
      fields: 'id, name, webViewLink'
    });

    return NextResponse.json({
      success: true,
      permission: response.data,
      folder: folderInfo.data,
      message: `Folder shared successfully with ${email || 'specified recipient'}`
    });

  } catch (error) {
    console.error('Error sharing folder:', error);
    return NextResponse.json(
      { error: 'Failed to share folder' },
      { status: 500 }
    );
  }
}

async function listFiles(drive: any, params: any) {
  const { 
    parentId, 
    pageSize = 10, 
    pageToken, 
    query,
    orderBy = 'modifiedTime desc'
  } = params;

  try {
    let q = '';
    
    if (parentId) {
      q += `'${parentId}' in parents`;
    }
    
    if (query) {
      if (q) q += ' and ';
      q += `name contains '${query}'`;
    }

    // Add trashed filter
    if (q) q += ' and ';
    q += 'trashed=false';

    const response = await drive.files.list({
      q: q || undefined,
      pageSize: pageSize,
      pageToken: pageToken,
      orderBy: orderBy,
      fields: 'nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, parents, thumbnailLink)'
    });

    return NextResponse.json({
      success: true,
      files: response.data.files,
      nextPageToken: response.data.nextPageToken,
      count: response.data.files?.length || 0
    });

  } catch (error) {
    console.error('Error listing files:', error);
    return NextResponse.json(
      { error: 'Failed to list files' },
      { status: 500 }
    );
  }
}

async function getStorageInfo(drive: any) {
  try {
    const response = await drive.about.get({
      fields: 'storageQuota, user'
    });

    const quota = response.data.storageQuota;
    const user = response.data.user;

    return NextResponse.json({
      success: true,
      storage: {
        limit: quota?.limit ? parseInt(quota.limit) : null,
        usage: quota?.usage ? parseInt(quota.usage) : 0,
        usageInDrive: quota?.usageInDrive ? parseInt(quota.usageInDrive) : 0,
        usageInDriveTrash: quota?.usageInDriveTrash ? parseInt(quota.usageInDriveTrash) : 0,
        usageInGmail: quota?.usageInGmail ? parseInt(quota.usageInGmail) : 0,
        usageInPhotos: quota?.usageInPhotos ? parseInt(quota.usageInPhotos) : 0
      },
      user: {
        displayName: user?.displayName,
        emailAddress: user?.emailAddress,
        photoLink: user?.photoLink
      }
    });

  } catch (error) {
    console.error('Error getting storage info:', error);
    return NextResponse.json(
      { error: 'Failed to get storage information' },
      { status: 500 }
    );
  }
}

async function uploadFile(drive: any, params: any) {
  const { name, content, mimeType, parentId, description } = params;

  if (!name || !content) {
    return NextResponse.json(
      { error: 'File name and content are required' },
      { status: 400 }
    );
  }

  try {
    const fileMetadata = {
      name: name,
      parents: parentId ? [parentId] : undefined,
      description: description || undefined
    };

    // Convert base64 content to buffer if needed
    let media;
    if (typeof content === 'string' && content.startsWith('data:')) {
      // Handle data URLs
      const base64Data = content.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      media = {
        mimeType: mimeType || 'application/octet-stream',
        body: buffer
      };
    } else {
      media = {
        mimeType: mimeType || 'text/plain',
        body: content
      };
    }

    const response = await drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id, name, size, mimeType, createdTime, webViewLink'
    });

    return NextResponse.json({
      success: true,
      file: response.data,
      message: `File '${name}' uploaded successfully`
    });

  } catch (error) {
    console.error('Error uploading file:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

async function deleteFile(drive: any, params: any) {
  const { fileId } = params;

  if (!fileId) {
    return NextResponse.json(
      { error: 'File ID is required' },
      { status: 400 }
    );
  }

  try {
    // Get file info before deletion
    const fileInfo = await drive.files.get({
      fileId: fileId,
      fields: 'id, name, mimeType'
    });

    // Delete the file
    await drive.files.delete({
      fileId: fileId
    });

    return NextResponse.json({
      success: true,
      deletedFile: fileInfo.data,
      message: `File '${fileInfo.data.name}' deleted successfully`
    });

  } catch (error) {
    console.error('Error deleting file:', error);
    return NextResponse.json(
      { error: 'Failed to delete file' },
      { status: 500 }
    );
  }
} 