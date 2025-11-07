/**
 * Main Backend Gateway
 * Handles authentication and routes requests to Flask services
 */
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from '../lib/utils/config';
import { verifyIdToken } from '../lib/firebase/admin';
import axios from 'axios';
import type { Request, Response, NextFunction } from 'express';

const app = express();
const PORT = process.env.GATEWAY_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

// Auth middleware
async function authenticate(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
  }

  const token = authHeader.substring(7);
  const decodedToken = await verifyIdToken(token);
  
  if (!decodedToken) {
    return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
  }

  (req as any).user = decodedToken;
  (req as any).userId = decodedToken.uid;
  next();
}

// Service URLs
const POSE_DETECTION_SERVICE_URL = config.poseDetectionService.url;
const DRILL_RECOMMENDER_URL = config.drillRecommender.url;
const BLAST_CONNECTOR_URL = config.blastConnector.url;

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'backend-gateway',
    version: '1.0.0',
    services: {
      poseDetectionService: POSE_DETECTION_SERVICE_URL,
      drillRecommender: DRILL_RECOMMENDER_URL,
      blastConnector: BLAST_CONNECTOR_URL,
    }
  });
});

// Proxy to Python Backend (Pose Detection)
app.post('/api/pose/detect', authenticate, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    // Create FormData for Python backend
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('image', req.file.buffer, {
      filename: req.file.originalname || 'image.jpg',
      contentType: req.file.mimetype || 'image/jpeg',
    });

    // Forward to Pose Detection Service
    const response = await axios.post(
      `${POSE_DETECTION_SERVICE_URL}/api/pose/detect`,
      formData,
      {
        headers: {
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Pose detection error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Proxy to Drill Recommender
app.post('/api/drills/recommend', authenticate, async (req, res) => {
  try {
    const response = await axios.post(
      `${DRILL_RECOMMENDER_URL}/api/drills/recommend`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Drill recommendation error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/api/drills', authenticate, async (req, res) => {
  try {
    const params = new URLSearchParams(req.query as any).toString();
    const response = await axios.get(
      `${DRILL_RECOMMENDER_URL}/api/drills?${params}`,
      {
        headers: {
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Get drills error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/api/drills/:drillId', authenticate, async (req, res) => {
  try {
    const { drillId } = req.params;
    const response = await axios.get(
      `${DRILL_RECOMMENDER_URL}/api/drills/${drillId}`,
      {
        headers: {
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Get drill error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/api/drills/search', authenticate, async (req, res) => {
  try {
    const params = new URLSearchParams(req.query as any).toString();
    const response = await axios.get(
      `${DRILL_RECOMMENDER_URL}/api/drills/search?${params}`,
      {
        headers: {
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Search drills error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/drills/search', authenticate, async (req, res) => {
  try {
    const response = await axios.post(
      `${DRILL_RECOMMENDER_URL}/api/drills/search`,
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true', // Mark as internal request from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Search drills error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Proxy to Blast Connector
app.post('/api/blast/connect', authenticate, async (req, res) => {
  try {
    const response = await axios.post(
      `${BLAST_CONNECTOR_URL}/api/blast/connect`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Blast connect error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/blast/data', authenticate, async (req, res) => {
  try {
    const response = await axios.post(
      `${BLAST_CONNECTOR_URL}/api/blast/data`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Blast data error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/api/blast/sessions', authenticate, async (req, res) => {
  try {
    const params = new URLSearchParams(req.query as any).toString();
    const response = await axios.get(
      `${BLAST_CONNECTOR_URL}/api/blast/sessions?${params}`,
      {
        headers: {
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Get Blast sessions error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.get('/api/blast/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const response = await axios.get(
      `${BLAST_CONNECTOR_URL}/api/blast/sessions/${sessionId}`,
      {
        headers: {
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Get Blast session error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.delete('/api/blast/sessions/:sessionId', authenticate, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const response = await axios.delete(
      `${BLAST_CONNECTOR_URL}/api/blast/sessions/${sessionId}`,
      {
        headers: {
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Delete Blast session error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/blast/sync/session', authenticate, async (req, res) => {
  try {
    const response = await axios.post(
      `${BLAST_CONNECTOR_URL}/api/blast/sync/session`,
      req.body,
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true', // Mark as internal request from gateway
          'X-User-Id': (req as any).userId || 'anonymous', // Forward user ID from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Blast sync error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/blast/sync/metrics', authenticate, async (req, res) => {
  try {
    const response = await axios.post(
      `${BLAST_CONNECTOR_URL}/api/blast/sync/metrics`,
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true', // Mark as internal request from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Blast metrics sync error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

app.post('/api/blast/sync/compare', authenticate, async (req, res) => {
  try {
    const response = await axios.post(
      `${BLAST_CONNECTOR_URL}/api/blast/sync/compare`,
      req.body,
      {
        headers: {
          'Authorization': req.headers.authorization || '',
          'Content-Type': 'application/json',
          'X-Internal-Request': 'true', // Mark as internal request from gateway
        },
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Blast compare error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log('\n' + '='.repeat(60));
  console.log('  Backend Gateway - Main Service');
  console.log('='.repeat(60));
  console.log(`✅ Gateway running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log('\n  Services:');
  console.log(`   - Pose Detection Service: ${POSE_DETECTION_SERVICE_URL}`);
  console.log(`   - Drill Recommender: ${DRILL_RECOMMENDER_URL}`);
  console.log(`   - Blast Connector: ${BLAST_CONNECTOR_URL}`);
  console.log('');
});

export default app;

