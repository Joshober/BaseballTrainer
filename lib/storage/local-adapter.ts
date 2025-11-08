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

    // Upload via Next.js API route (which proxies to storage server)
    // This avoids CORS issues and allows server-side env vars to be used
    const response = await fetch('/api/storage', {
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
    // Storage server now returns full URL (with ngrok domain if configured)
    // If it's a relative URL, prepend storage server URL
    if (data.url.startsWith('http://') || data.url.startsWith('https://')) {
      return data.url;
    }
    // If relative URL, get storage server URL for client-side access
    const storageServerUrl = getStorageServerUrl();
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

    // Delete via Next.js API route (which proxies to storage server)
    const response = await fetch(`/api/storage?path=${encodeURIComponent(path)}`, {
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


