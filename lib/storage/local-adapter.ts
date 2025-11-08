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
    // For simplified local setup, accept and return relative URLs as-is
    if (typeof data.url === 'string' && data.url.startsWith('/')) {
      return data.url;
    }
    // If absolute, return directly
    if (typeof data.url === 'string' && (data.url.startsWith('http://') || data.url.startsWith('https://'))) {
      return data.url;
    }
    // Fallback to relative path
    return `/api/storage/${path}`;
  }

  async getFileURL(path: string): Promise<string> {
    // Return relative URL handled by Next.js API routes
    return `/api/storage/${path}`;
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


