import type { StorageAdapter } from './adapter';
import { config } from '@/lib/utils/config';
import { getBackendUrl } from '@/lib/utils/backend-url';

export class LocalStorageAdapter implements StorageAdapter {
  private baseUrl: string;

  constructor() {
    // Use ngrok URL if available, otherwise use config
    this.baseUrl = getBackendUrl();
  }

  async uploadFile(path: string, file: Blob | File | Buffer): Promise<string> {
    const formData = new FormData();
    const blob = file instanceof Buffer ? new Blob([file]) : file;
    formData.append('file', blob);
    formData.append('path', path);

    const response = await fetch(`${this.baseUrl}/api/storage/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }

    const data = await response.json();
    return data.url;
  }

  async getFileURL(path: string): Promise<string> {
    return `${this.baseUrl}/api/storage/${path}`;
  }

  async deleteFile(path: string): Promise<void> {
    const response = await fetch(`${this.baseUrl}/api/storage/${path}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }
}


