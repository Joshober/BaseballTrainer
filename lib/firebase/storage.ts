import { ref, uploadBytes, getDownloadURL, deleteObject, FirebaseStorage } from 'firebase/storage';
import { getFirebaseStorage } from './config';

// Lazy-load Firebase Storage (only when needed)
function getStorage(): FirebaseStorage {
  const storage = getFirebaseStorage();
  if (!storage) {
    throw new Error('Firebase Storage is not configured or disabled. Please set STORAGE_TYPE=local to use local storage instead.');
  }
  return storage;
}

export async function uploadFile(
  path: string,
  file: Blob | Uint8Array | ArrayBuffer
): Promise<string> {
  const storage = getStorage();
  const storageRef = ref(storage, path);
  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function getFileURL(path: string): Promise<string> {
  const storage = getStorage();
  const storageRef = ref(storage, path);
  return getDownloadURL(storageRef);
}

export async function deleteFile(path: string): Promise<void> {
  const storage = getStorage();
  const storageRef = ref(storage, path);
  await deleteObject(storageRef);
}


