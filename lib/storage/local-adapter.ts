import type { StorageAdapter } from './adapter';

export class LocalStorageAdapter implements StorageAdapter {
  async uploadFile(path: string, file: Blob | File | Buffer): Promise<string> {
    const formData = new FormData();
    const blob = file instanceof Buffer ? new Blob([file]) : file;
    formData.append('file', blob);
    formData.append('path', path);

    // Get auth token for upload
    const { getFirebaseAuth } = await import('@/lib/firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      throw new Error('User not authenticated');
    }
    const token = await auth.currentUser.getIdToken();

    // Upload to Next.js API route (client-side)
    const response = await fetch('/api/storage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: response.statusText }));
      throw new Error(`Failed to upload file: ${error.error || response.statusText}`);
    }

    const data = await response.json();
    return data.url;
  }

  async getFileURL(path: string): Promise<string> {
    // Return Next.js API route URL for file access
    return `/api/storage/${path}`;
  }

  async deleteFile(path: string): Promise<void> {
    // Get auth token for delete
    const { getFirebaseAuth } = await import('@/lib/firebase/auth');
    const auth = getFirebaseAuth();
    if (!auth?.currentUser) {
      throw new Error('User not authenticated');
    }
    const token = await auth.currentUser.getIdToken();

    const response = await fetch(`/api/storage?path=${encodeURIComponent(path)}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }
}


