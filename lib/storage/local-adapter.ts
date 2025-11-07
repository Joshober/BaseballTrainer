import type { StorageAdapter } from './adapter';
import { getStorageServerUrl } from '@/lib/utils/storage-server-url';

export class LocalStorageAdapter implements StorageAdapter {
  async uploadFile(path: string, file: Blob | File | Buffer): Promise<string> {
    const formData = new FormData();
    const blob = file instanceof Buffer ? new Blob([file]) : file;
    formData.append('file', blob);
    formData.append('path', path);

    // Get auth token for upload
    const { getAuthToken } = await import('@/lib/auth0/client');
    const token = getAuthToken();
    if (!token) {
      throw new Error('User not authenticated. Please sign in first.');
    }

    // Upload to Flask storage server
    const storageServerUrl = getStorageServerUrl();
    const response = await fetch(`${storageServerUrl}/api/storage/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Failed to upload file: ${error.error || error.message || response.statusText}`);
    }

    const data = await response.json();
    // Return full URL to storage server
    return `${storageServerUrl}${data.url}`;
  }

  async getFileURL(path: string): Promise<string> {
    // Return storage server URL for file access
    const storageServerUrl = getStorageServerUrl();
    return `${storageServerUrl}/api/storage/${path}`;
  }

  async deleteFile(path: string): Promise<void> {
    // Get auth token for delete
    const { getAuthToken } = await import('@/lib/auth0/client');
    const token = getAuthToken();
    if (!token) {
      throw new Error('User not authenticated. Please sign in first.');
    }

    // Delete from Flask storage server
    const storageServerUrl = getStorageServerUrl();
    const response = await fetch(`${storageServerUrl}/api/storage?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Failed to delete file: ${error.error || error.message || response.statusText}`);
    }
  }
}


