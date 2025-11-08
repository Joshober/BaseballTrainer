import { config } from './config';

/**
 * Get the storage server URL
 * Prioritizes localhost/STORAGE_SERVER_URL over ngrok URLs
 * Works in both server-side and client-side code
 */
export function getStorageServerUrl(): string {
  const normalize = (u: string | undefined): string => {
    let s = (u || '').trim();
    // Remove accidental annotations like "(line 5003)" and spaces
    s = s.replace(/\s*\([^)]*\)\s*/g, '').replace(/\s+/g, '');
    if (!s) return '';
    // Ensure protocol
    if (!/^https?:\/\//i.test(s)) s = `http://${s}`;
    // Drop trailing slash
    s = s.replace(/\/$/, '');
    return s;
  };

  const def = 'http://localhost:5003';

  const isClient = typeof window !== 'undefined';
  if (isClient) {
    const clientUrl = normalize(process.env.NEXT_PUBLIC_STORAGE_SERVER_URL) || normalize(def);
    console.log('[Storage URL] Client-side:', clientUrl);
    return clientUrl;
  }

  const serverUrl = normalize(process.env.STORAGE_SERVER_URL);
  const chosen = serverUrl || normalize(def);
  console.log('[Storage URL] Server-side:', chosen);
  return chosen;
}
