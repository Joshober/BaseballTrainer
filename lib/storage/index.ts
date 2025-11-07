import { config } from '@/lib/utils/config';
import type { StorageAdapter } from './adapter';

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    if (config.storageType === 'local') {
      // Lazy-load local adapter (only when needed)
      const { LocalStorageAdapter } = require('./local-adapter');
      adapter = new LocalStorageAdapter();
    } else {
      // Lazy-load Firebase adapter (only when needed)
      const { FirebaseStorageAdapter } = require('./firebase-adapter');
      adapter = new FirebaseStorageAdapter();
    }
  }
  return adapter;
}

// Don't export storage at module level - use getStorageAdapter() instead
// This prevents Firebase Storage from being initialized if using local storage


