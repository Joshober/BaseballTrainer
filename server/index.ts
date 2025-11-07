import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { config, validateConfig } from '../lib/utils/config';
import { verifyIdToken } from '../lib/firebase/admin';
// Import pose detection (may fail on Windows due to native bindings)
let estimateAnglesFromImageBuffer: any = null;
try {
  const poseServer = require('../lib/pose/server');
  estimateAnglesFromImageBuffer = poseServer.estimateAnglesFromImageBuffer;
  console.log('✅ Server-side pose detection loaded');
} catch (error: any) {
  console.warn('⚠️  Server-side pose detection not available:', error.message);
  console.warn('   Client-side pose detection will still work.');
}
import { readFile, unlink } from 'fs/promises';

const app = express();
const PORT = config.localServer.port;
const UPLOAD_DIR = join(process.cwd(), 'server', 'uploads');

// Log configuration on startup
console.log('\n' + '='.repeat(60));
console.log('  Baseball Swing Analysis - Express Backend');
console.log('='.repeat(60));
console.log(`Database Type: ${config.databaseType}`);
console.log(`Storage Type: ${config.storageType}`);
if (config.databaseType === 'mongodb') {
  console.log(`MongoDB URI: ${config.mongodb.uri ? 'Set ✓' : 'Not set ✗'}`);
}
if (config.storageType === 'local') {
  console.log(`Local Storage: ${UPLOAD_DIR}`);
  console.log(`Server URL: ${config.localServer.url}`);
}
console.log('='.repeat(60) + '\n');

// Validate configuration
const configValid = validateConfig();
if (!configValid) {
  console.warn('⚠️  Configuration validation failed. Some features may not work.');
  console.warn('   Check your .env.local file for missing required variables.\n');
}

// Middleware
app.use(cors());
app.use(express.json());

// Multer configuration
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Auth middleware
async function authenticate(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  const decodedToken = await verifyIdToken(token);
  if (!decodedToken) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  (req as any).user = decodedToken;
  next();
}

// Routes
app.post('/api/pose/detect', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    if (!estimateAnglesFromImageBuffer) {
      return res.status(503).json({ 
        error: 'Server-side pose detection is not available. Please use client-side detection instead.',
        ok: false,
        message: 'TensorFlow.js Node native bindings could not be loaded. This is common on Windows. Use client-side pose detection in the browser.'
      });
    }

    const buffer = req.file.buffer;
    const result = await estimateAnglesFromImageBuffer(buffer);
    res.json(result);
  } catch (error) {
    console.error('Pose detection error:', error);
    res.status(500).json({ error: 'Internal server error', ok: false });
  }
});

app.post('/api/storage/upload', authenticate, upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.body.path) {
      return res.status(400).json({ error: 'Missing file or path' });
    }

    const path = req.body.path;
    const fullPath = join(UPLOAD_DIR, path);
    const dir = fullPath.substring(0, fullPath.lastIndexOf('/'));
    await mkdir(dir, { recursive: true });

    const { writeFile } = await import('fs/promises');
    await writeFile(fullPath, req.file.buffer);

    const url = `${config.localServer.url}/api/storage/${path}`;
    res.json({ url, path });
  } catch (error) {
    console.error('Storage upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Use a catch-all route for file paths
// Express 5 uses different syntax - use regex or multiple route handlers
app.get(/^\/api\/storage\/(.+)$/, async (req, res) => {
  try {
    // Extract path from URL
    const match = req.url?.match(/^\/api\/storage\/(.+)$/);
    const path = match ? match[1] : '';
    if (!path) {
      return res.status(400).json({ error: 'Path required' });
    }
    const fullPath = join(UPLOAD_DIR, path);
    const file = await readFile(fullPath);

    const ext = path.split('.').pop()?.toLowerCase();
    const contentType = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' :
                        ext === 'png' ? 'image/png' :
                        ext === 'mp4' ? 'video/mp4' : 'application/octet-stream';

    res.setHeader('Content-Type', contentType);
    res.send(file);
  } catch (error) {
    console.error('File read error:', error);
    res.status(404).json({ error: 'File not found' });
  }
});

app.delete(/^\/api\/storage\/(.+)$/, authenticate, async (req, res) => {
  try {
    // Extract path from URL
    const match = req.url?.match(/^\/api\/storage\/(.+)$/);
    const path = match ? match[1] : '';
    if (!path) {
      return res.status(400).json({ error: 'Path required' });
    }
    const fullPath = join(UPLOAD_DIR, path);
    await unlink(fullPath);
    res.json({ success: true });
  } catch (error) {
    console.error('File delete error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Start server
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`✅ Express server running on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Storage: ${config.storageType === 'local' ? 'Local file system' : 'Firebase Storage'}`);
    console.log(`   Database: ${config.databaseType === 'mongodb' ? 'MongoDB Atlas' : 'Firebase Firestore'}`);
    console.log('');
  });
}

export default app;


