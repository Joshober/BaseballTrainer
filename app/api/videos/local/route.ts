import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import type { Session } from '@/types/session';

export const dynamic = 'force-dynamic';

/**
 * API route that scans the local uploads/videos directory
 * and returns sessions based on found video files
 */
export async function GET(request: NextRequest) {
  try {
    let uid = request.nextUrl.searchParams.get('uid');
    if (!uid) {
      console.error('[Local Videos API] Missing uid parameter');
      return NextResponse.json({ error: 'Missing uid parameter' }, { status: 400 });
    }

    // Normalize UID: Auth0 uses pipe (|) but directories use underscore (_)
    // Also handle the case where it might already be normalized
    const normalizedUid = uid.replace(/\|/g, '_');
    
    console.log(`[Local Videos API] Original UID: ${uid}, Normalized: ${normalizedUid}`);

    const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'videos');
    
    // Try both formats: normalized first, then original
    let userVideoDir = path.join(UPLOAD_DIR, normalizedUid);
    let foundDir = normalizedUid;
    
    // Check if normalized directory exists, if not try original
    try {
      await fs.access(userVideoDir);
    } catch {
      // Try original format
      userVideoDir = path.join(UPLOAD_DIR, uid);
      foundDir = uid;
      try {
        await fs.access(userVideoDir);
      } catch {
        // Neither exists, use normalized for creation
        userVideoDir = path.join(UPLOAD_DIR, normalizedUid);
        foundDir = normalizedUid;
      }
    }

    console.log(`[Local Videos API] Looking in directory: ${userVideoDir}`);

    // Check if user directory exists
    let files: string[] = [];
    try {
      // Check if directory exists
      try {
        await fs.access(userVideoDir);
      } catch {
        console.log(`[Local Videos API] Directory does not exist: ${userVideoDir}`);
        return NextResponse.json([]);
      }

      const entries = await fs.readdir(userVideoDir, { withFileTypes: true });
      console.log(`[Local Videos API] Found ${entries.length} entries in directory`);
      
      files = entries
        .filter(entry => entry.isFile() && /\.(mp4|webm|mov|avi|mkv)$/i.test(entry.name))
        .map(entry => entry.name);
      
      console.log(`[Local Videos API] Found ${files.length} video files:`, files);
    } catch (error) {
      // Directory doesn't exist or can't be read
      console.error(`[Local Videos API] Error reading directory ${userVideoDir}:`, error);
      return NextResponse.json([]);
    }

    // Create sessions from video files
    const sessions: Session[] = await Promise.all(
      files.map(async (filename) => {
        const videoPath = path.join(userVideoDir, filename);
        const relativePath = `videos/${foundDir}/${filename}`;
        // Serve videos directly from local filesystem
        const videoURL = `/uploads/${relativePath}`;
        
        // Get file stats
        let stats;
        try {
          stats = await fs.stat(videoPath);
        } catch {
          stats = null;
        }

        // Generate a session ID from filename (remove extension)
        const sessionId = filename.replace(/\.[^/.]+$/, '');

        // Create a session object
        const session: Session = {
          id: sessionId,
          uid: normalizedUid, // Use normalized UID for consistency
          teamId: '', // Not available from file system
          photoPath: '',
          photoURL: '',
          videoPath: relativePath,
          videoURL: videoURL,
          createdAt: stats?.mtime || new Date(),
          metrics: {
            launchAngleEst: 0,
            attackAngleEst: null,
            exitVelocity: 0,
            confidence: 0,
          },
          game: {
            distanceFt: 0,
            zone: '',
            milestone: '',
            progressToNext: 0,
          },
          label: 'needs_work', // Default label
        };

        return session;
      })
    );

    // Sort by creation date (newest first)
    sessions.sort((a, b) => {
      const dateA = a.createdAt instanceof Date ? a.createdAt : new Date(a.createdAt);
      const dateB = b.createdAt instanceof Date ? b.createdAt : new Date(b.createdAt);
      return dateB.getTime() - dateA.getTime();
    });

    console.log(`[Local Videos API] Found ${sessions.length} videos for user ${normalizedUid} (original: ${uid})`);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error('[Local Videos API] Error scanning videos:', error);
    return NextResponse.json({ error: 'Failed to scan videos' }, { status: 500 });
  }
}

