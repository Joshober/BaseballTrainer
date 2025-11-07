import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { join } from 'path';
import { mkdir } from 'fs/promises';
import { config } from '../lib/utils/config';
import { verifyIdToken } from '../lib/firebase/admin';
import { estimateAnglesFromImageBuffer } from '../lib/pose/server';
import { readFile, unlink } from 'fs/promises';

const app = express();
const PORT = config.localServer.port;
const UPLOAD_DIR = join(process.cwd(), 'server', 'uploads');

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

app.get('/api/storage/:path(*)', async (req, res) => {
  try {
    const path = req.params.path;
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

app.delete('/api/storage/:path(*)', authenticate, async (req, res) => {
  try {
    const path = req.params.path;
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
    console.log(`Express server running on port ${PORT}`);
  });
}

export default app;

