import type { StorageAdapter } from './adapter';
import * as firebaseStorage from '@/lib/firebase/storage';

export class FirebaseStorageAdapter implements StorageAdapter {
  async uploadFile(path: string, file: Blob | File | Buffer): Promise<string> {
    const blob = file instanceof Buffer ? new Blob([file]) : file;
    return firebaseStorage.uploadFile(path, blob);
  }

  async getFileURL(path: string): Promise<string> {
    return firebaseStorage.getFileURL(path);
  }

  async deleteFile(path: string): Promise<void> {
    return firebaseStorage.deleteFile(path);
  }
}


