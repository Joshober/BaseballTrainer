export interface StorageAdapter {
  uploadFile(path: string, file: Blob | File | Buffer): Promise<string>;
  getFileURL(path: string): Promise<string>;
  deleteFile(path: string): Promise<void>;
}

