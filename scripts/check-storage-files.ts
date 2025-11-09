/**
 * Diagnostic script to check storage file paths
 * Compares database paths with actual files on disk
 */
import { getMongoDb } from '@/lib/mongodb';
import { readdir, stat } from 'fs/promises';
import { join } from 'path';

async function checkStorageFiles() {
  try {
    const db = await getMongoDb();
    const uploadsDir = join(process.cwd(), 'uploads');
    
    console.log('=== Storage File Diagnostic ===\n');
    console.log(`Uploads directory: ${uploadsDir}\n`);
    
    // Get all sessions with video paths
    const sessions = await db.collection('sessions').find({
      videoPath: { $exists: true, $ne: null }
    }).toArray();
    
    console.log(`Found ${sessions.length} sessions with video paths\n`);
    
    let found = 0;
    let missing = 0;
    
    for (const session of sessions.slice(0, 20)) { // Check first 20
      const videoPath = session.videoPath as string;
      const fullPath = join(uploadsDir, videoPath);
      
      try {
        await stat(fullPath);
        found++;
        console.log(`✅ ${videoPath}`);
      } catch {
        missing++;
        console.log(`❌ ${videoPath} - FILE NOT FOUND`);
        // Check if directory exists
        const pathParts = videoPath.split('/');
        const dirPath = join(uploadsDir, ...pathParts.slice(0, -1));
        try {
          const files = await readdir(dirPath);
          console.log(`   Directory exists. Files: ${files.join(', ')}`);
        } catch {
          console.log(`   Directory also doesn't exist: ${dirPath}`);
        }
      }
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Found: ${found}`);
    console.log(`Missing: ${missing}`);
    
    // Check what files actually exist
    console.log(`\n=== Actual Files in uploads/videos ===`);
    try {
      const videosDir = join(uploadsDir, 'videos');
      const users = await readdir(videosDir);
      for (const user of users.slice(0, 5)) {
        const userDir = join(videosDir, user);
        const files = await readdir(userDir);
        console.log(`${user}: ${files.length} files`);
        files.slice(0, 3).forEach(f => console.log(`  - ${f}`));
      }
    } catch (error: any) {
      console.log(`Error reading videos directory: ${error.message}`);
    }
    
  } catch (error: any) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkStorageFiles();

