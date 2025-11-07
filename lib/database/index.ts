/**
 * Database adapter exports
 * 
 * IMPORTANT: This module should ONLY be imported in:
 * - Next.js API routes (server-side)
 * - Server components
 * - Server-side code
 * 
 * NEVER import this in client components!
 * Use API routes instead.
 */

// Re-export from server-only module using require to prevent bundling
// This ensures MongoDB is never imported in client components
export function getDatabaseAdapter() {
  // Use require to prevent static analysis
  const serverOnly = require('./server-only');
  return serverOnly.getDatabaseAdapter();
}

// Only export db on server side - this will be null in client
// Using require to prevent static analysis
export const db = typeof window === 'undefined' 
  ? (() => {
      try {
        const serverOnly = require('./server-only');
        return serverOnly.getDatabaseAdapter();
      } catch {
        return null;
      }
    })()
  : null;


