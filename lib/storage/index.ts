import type { StorageAdapter } from './adapter';

let adapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (!adapter) {
    // Always use local storage adapter
    const { LocalStorageAdapter } = require('./local-adapter');
    adapter = new LocalStorageAdapter();
  }
  return adapter;
}


