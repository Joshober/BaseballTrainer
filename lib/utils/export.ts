/**
 * Export utilities for sessions and videos
 */

import type { Session } from '@/types/session';

/**
 * Export session data as CSV
 */
export function exportSessionsToCSV(sessions: Session[]): string {
  const headers = [
    'Date',
    'Distance (ft)',
    'Exit Velocity (mph)',
    'Launch Angle (°)',
    'Attack Angle (°)',
    'Zone',
    'Label',
    'Confidence',
  ];

  const rows = sessions.map((session) => [
    new Date(session.createdAt).toLocaleDateString(),
    session.game.distanceFt.toFixed(0),
    session.metrics.exitVelocity.toFixed(1),
    session.metrics.launchAngleEst.toFixed(1),
    session.metrics.attackAngleEst?.toFixed(1) || 'N/A',
    session.game.zone,
    session.label,
    session.metrics.confidence?.toFixed(2) || 'N/A',
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) => row.join(',')),
  ].join('\n');

  return csvContent;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export session data as JSON
 */
export function exportSessionsToJSON(sessions: Session[]): string {
  return JSON.stringify(sessions, null, 2);
}

/**
 * Download JSON file
 */
export function downloadJSON(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Generate shareable link for a session
 */
export function generateSessionShareLink(sessionId: string, baseUrl?: string): string {
  const base = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  return `${base}/sessions/${sessionId}`;
}

/**
 * Copy text to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        document.execCommand('copy');
        return true;
      } catch (err) {
        console.error('Failed to copy:', err);
        return false;
      } finally {
        document.body.removeChild(textArea);
      }
    }
  } catch (err) {
    console.error('Failed to copy to clipboard:', err);
    return false;
  }
}

/**
 * Share via Web Share API (if available)
 */
export async function shareSession(session: Session, shareData?: ShareData): Promise<boolean> {
  if (!navigator.share) {
    return false;
  }

  try {
    const shareText = `Check out my swing: ${session.game.distanceFt.toFixed(0)} ft distance!`;
    const shareUrl = generateSessionShareLink(session.id);
    
    await navigator.share({
      title: 'My Baseball Swing',
      text: shareText,
      url: shareUrl,
      ...shareData,
    });
    
    return true;
  } catch (err) {
    if ((err as Error).name !== 'AbortError') {
      console.error('Failed to share:', err);
    }
    return false;
  }
}

