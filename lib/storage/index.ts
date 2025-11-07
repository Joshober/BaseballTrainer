import { config } from '@/lib/utils/config';
import { FirebaseStorageAdapter } from './firebase-adapter';
import { LocalStorageAdapter } from './local-adapter';
import type { StorageAdapter } from './adapter';

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    if (config.storageType === 'local') {
      adapter = new LocalStorageAdapter();
    } else {
      adapter = new FirebaseStorageAdapter();
    }
  }
  return adapter;
}

export const storage = getStorageAdapter();

