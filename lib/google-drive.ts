/**
 * Google Drive Utilities
 * Provides easy-to-use functions for Google Drive operations in workflows
 */

export interface DriveOperationOptions {
  userId: string;
}

export interface CreateFolderOptions extends DriveOperationOptions {
  name: string;
  parentId?: string;
  description?: string;
}

export interface ShareFolderOptions extends DriveOperationOptions {
  folderId: string;
  email: string;
  role?: 'reader' | 'commenter' | 'writer' | 'fileOrganizer';
  type?: 'user' | 'group' | 'domain' | 'anyone';
  sendNotificationEmail?: boolean;
}

export interface UploadFileOptions extends DriveOperationOptions {
  name: string;
  content: string;
  mimeType?: string;
  parentId?: string;
  description?: string;
}

export interface ListFilesOptions extends DriveOperationOptions {
  parentId?: string;
  pageSize?: number;
  pageToken?: string;
  query?: string;
  orderBy?: string;
}

export interface DeleteFileOptions extends DriveOperationOptions {
  fileId: string;
}

/**
 * Create a folder in Google Drive
 */
export async function createFolder(options: CreateFolderOptions): Promise<{ success: boolean; folder?: any; error?: string }> {
  try {
    const response = await fetch('/api/google-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'create_folder',
        userId: options.userId,
        name: options.name,
        parentId: options.parentId,
        description: options.description
      })
    });

    const result = await response.json();
    return { 
      success: result.success, 
      folder: result.folder, 
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Share a folder with someone
 */
export async function shareFolder(options: ShareFolderOptions): Promise<{ success: boolean; permission?: any; folder?: any; error?: string }> {
  try {
    const response = await fetch('/api/google-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'share_folder',
        userId: options.userId,
        folderId: options.folderId,
        email: options.email,
        role: options.role || 'reader',
        type: options.type || 'user',
        sendNotificationEmail: options.sendNotificationEmail !== false
      })
    });

    const result = await response.json();
    return { 
      success: result.success, 
      permission: result.permission,
      folder: result.folder,
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Upload a file to Google Drive
 */
export async function uploadFile(options: UploadFileOptions): Promise<{ success: boolean; file?: any; error?: string }> {
  try {
    const response = await fetch('/api/google-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'upload_file',
        userId: options.userId,
        name: options.name,
        content: options.content,
        mimeType: options.mimeType,
        parentId: options.parentId,
        description: options.description
      })
    });

    const result = await response.json();
    return { 
      success: result.success, 
      file: result.file, 
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * List files in Google Drive
 */
export async function listFiles(options: ListFilesOptions): Promise<{ success: boolean; files?: any[]; nextPageToken?: string; count?: number; error?: string }> {
  try {
    const response = await fetch('/api/google-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'list_files',
        userId: options.userId,
        parentId: options.parentId,
        pageSize: options.pageSize,
        pageToken: options.pageToken,
        query: options.query,
        orderBy: options.orderBy
      })
    });

    const result = await response.json();
    return { 
      success: result.success, 
      files: result.files,
      nextPageToken: result.nextPageToken,
      count: result.count,
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Get Google Drive storage information
 */
export async function getStorageInfo(options: DriveOperationOptions): Promise<{ success: boolean; storage?: any; user?: any; error?: string }> {
  try {
    const response = await fetch('/api/google-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'get_storage_info',
        userId: options.userId
      })
    });

    const result = await response.json();
    return { 
      success: result.success, 
      storage: result.storage,
      user: result.user,
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Delete a file from Google Drive
 */
export async function deleteFile(options: DeleteFileOptions): Promise<{ success: boolean; deletedFile?: any; error?: string }> {
  try {
    const response = await fetch('/api/google-drive', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'delete_file',
        userId: options.userId,
        fileId: options.fileId
      })
    });

    const result = await response.json();
    return { 
      success: result.success, 
      deletedFile: result.deletedFile, 
      error: result.error 
    };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Google Drive helper class for easier workflow integration
 */
export class GoogleDriveManager {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async createFolder(name: string, parentId?: string, description?: string) {
    return createFolder({ userId: this.userId, name, parentId, description });
  }

  async shareFolder(folderId: string, email: string, role: ShareFolderOptions['role'] = 'reader') {
    return shareFolder({ userId: this.userId, folderId, email, role });
  }

  async uploadFile(name: string, content: string, parentId?: string, mimeType?: string) {
    return uploadFile({ userId: this.userId, name, content, parentId, mimeType });
  }

  async listFiles(parentId?: string, query?: string) {
    return listFiles({ userId: this.userId, parentId, query });
  }

  async getStorageInfo() {
    return getStorageInfo({ userId: this.userId });
  }

  async deleteFile(fileId: string) {
    return deleteFile({ userId: this.userId, fileId });
  }

  // Convenience methods for common workflows
  async createProjectFolder(projectName: string, parentId?: string) {
    const timestamp = new Date().toISOString().split('T')[0];
    const folderName = `${projectName} - ${timestamp}`;
    return this.createFolder(folderName, parentId, `Project folder for ${projectName}`);
  }

  async createCustomerFolder(customerName: string, parentId?: string) {
    const folderName = `Customer - ${customerName}`;
    return this.createFolder(folderName, parentId, `Customer folder for ${customerName}`);
  }

  async uploadReport(reportName: string, reportData: any, parentId?: string) {
    const fileName = `${reportName} - ${new Date().toISOString().split('T')[0]}.json`;
    const content = JSON.stringify(reportData, null, 2);
    return this.uploadFile(fileName, content, parentId, 'application/json');
  }

  async shareWithTeam(folderId: string, teamEmails: string[], role: ShareFolderOptions['role'] = 'reader') {
    const results: Array<{ email: string; success: boolean; permission?: any; folder?: any; error?: string }> = [];
    for (const email of teamEmails) {
      const result = await this.shareFolder(folderId, email, role);
      results.push({ email, ...result });
    }
    return results;
  }

  async formatStorageInfo() {
    const result = await this.getStorageInfo();
    if (!result.success || !result.storage) {
      return { error: result.error };
    }

    const storage = result.storage;
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 Bytes';
      const k = 1024;
      const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    return {
      success: true,
      formatted: {
        totalUsage: formatBytes(storage.usage),
        driveUsage: formatBytes(storage.usageInDrive),
        gmailUsage: formatBytes(storage.usageInGmail),
        photosUsage: formatBytes(storage.usageInPhotos),
        trashUsage: formatBytes(storage.usageInDriveTrash),
        limit: storage.limit ? formatBytes(storage.limit) : 'Unlimited',
        percentUsed: storage.limit ? Math.round((storage.usage / storage.limit) * 100) : 0
      },
      raw: storage,
      user: result.user
    };
  }
} 