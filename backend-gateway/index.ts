/**
 * Main Backend Gateway
 * Handles authentication and routes requests to Flask services
 */
// Load environment variables from .env.local
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../.env.local') });

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from '../lib/utils/config';
import { verifyIdToken } from '../lib/auth0/admin';
import axios from 'axios';
import type { Request, Response, NextFunction } from 'express';

const app = express();
const PORT = process.env.GATEWAY_PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Multer for file uploads
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for video files
  }
});

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
  // Auth0 uses 'sub' as the user ID
  (req as any).userId = decodedToken.sub;
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

// Auth0 Authentication Endpoints
app.get('/api/auth/login', (req, res) => {
  // Redirect to Auth0 login
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  // Auth0 callback should go to backend gateway
  const backendUrl = process.env.AUTH0_BASE_URL || `http://localhost:${PORT}`;
  const connection = req.query.connection || 'google-oauth2';
  const screenHint = req.query.screen_hint || 'login';
  
  if (!domain || !clientId) {
    return res.status(500).json({ error: 'Auth0 not configured' });
  }
  
  const authUrl = `https://${domain}/authorize?` +
    `response_type=code&` +
    `client_id=${clientId}&` +
    `redirect_uri=${encodeURIComponent(`${backendUrl}/api/auth/callback`)}&` +
    `scope=openid profile email&` +
    `connection=${connection}&` +
    `screen_hint=${screenHint}`;
  
  res.redirect(authUrl);
});

app.get('/api/auth/callback', async (req, res) => {
  // Handle Auth0 callback
  const code = req.query.code;
  const error = req.query.error;
  
  if (error) {
    return res.redirect(`/?error=${encodeURIComponent(error as string)}`);
  }
  
  if (!code) {
    return res.redirect('/?error=no_code');
  }
  
  try {
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    // Auth0 callback URL should be the backend gateway
    const backendUrl = process.env.AUTH0_BASE_URL || `http://localhost:${PORT}`;
    const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'http://localhost:3000';
    
    if (!domain || !clientId || !clientSecret) {
      return res.status(500).json({ error: 'Auth0 not configured' });
    }
    
    // Exchange code for tokens
    const tokenResponse = await axios.post(`https://${domain}/oauth/token`, {
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code: code as string,
      redirect_uri: `${backendUrl}/api/auth/callback`,
    });
    
    const { access_token, id_token } = tokenResponse.data;
    
    // Get user info
    const userResponse = await axios.get(`https://${domain}/userinfo`, {
      headers: {
        Authorization: `Bearer ${access_token}`,
      },
    });
    
    const user = userResponse.data;
    
    // Redirect to frontend with tokens
    // Note: In production, use secure HTTP-only cookies instead of query params
    res.redirect(`${frontendUrl}/auth/callback?token=${access_token}&user=${encodeURIComponent(JSON.stringify(user))}`);
  } catch (error: any) {
    console.error('Auth callback error:', error);
    res.redirect(`/?error=${encodeURIComponent(error.message || 'auth_failed')}`);
  }
});

// Email/Password Registration
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, connection = 'Username-Password-Authentication' } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    
    if (!domain || !clientId || !clientSecret) {
      return res.status(500).json({ error: 'Auth0 not configured' });
    }
    
    // Create user in Auth0 using the signup endpoint
    try {
      await axios.post(`https://${domain}/dbconnections/signup`, {
        client_id: clientId,
        email,
        password,
        connection,
      });
    } catch (signupError: any) {
      // If user already exists, that's okay - they can just login
      if (signupError.response?.status === 409 || signupError.response?.data?.code === 'user_exists') {
        return res.status(409).json({ 
          error: 'User already exists',
          message: 'An account with this email already exists. Please sign in instead.'
        });
      }
      throw signupError;
    }
    
    // After creating user, redirect them to login
    // We can't use password grant type (not enabled by default for security)
    // Instead, return success and let frontend redirect to login
    res.json({
      success: true,
      message: 'Account created successfully. Please sign in.',
      email,
    });
  } catch (error: any) {
    console.error('Registration error:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.description || error.response?.data?.error_description || error.response?.data?.error || error.message || 'Registration failed';
    res.status(error.response?.status || 500).json({ error: errorMessage });
  }
});

// Email/Password Login
// Note: This requires the "Password" grant type to be enabled in Auth0
// To enable: Auth0 Dashboard > Applications > Your App > Advanced Settings > Grant Types > Enable "Password"
app.post('/api/auth/login-email', async (req, res) => {
  try {
    const { email, password, connection = 'Username-Password-Authentication' } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }
    
    const domain = process.env.AUTH0_DOMAIN;
    const clientId = process.env.AUTH0_CLIENT_ID;
    const clientSecret = process.env.AUTH0_CLIENT_SECRET;
    
    if (!domain || !clientId || !clientSecret) {
      return res.status(500).json({ error: 'Auth0 not configured' });
    }
    
    // Authenticate user using password grant
    // This requires the grant type to be enabled in Auth0 Dashboard
    try {
      const tokenResponse = await axios.post(`https://${domain}/oauth/token`, {
        grant_type: 'password',
        client_id: clientId,
        client_secret: clientSecret,
        username: email,
        password,
        connection,
        scope: 'openid profile email',
      });
      
      const { access_token, id_token } = tokenResponse.data;
      
      // Get user info
      const userResponse = await axios.get(`https://${domain}/userinfo`, {
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
      });
      
      const user = userResponse.data;
      
      res.json({
        access_token,
        id_token,
        user,
      });
    } catch (tokenError: any) {
      // If password grant is not enabled, provide helpful error
      if (tokenError.response?.data?.error === 'unauthorized_client' || 
          tokenError.response?.data?.error === 'invalid_grant') {
        return res.status(400).json({ 
          error: 'Password grant type not enabled',
          message: 'Please enable the "Password" grant type in Auth0 Dashboard: Applications > Your App > Advanced Settings > Grant Types > Enable "Password"'
        });
      }
      throw tokenError;
    }
  } catch (error: any) {
    console.error('Login error:', error.response?.data || error.message);
    const errorMessage = error.response?.data?.description || error.response?.data?.error_description || error.response?.data?.error || error.message || 'Login failed';
    res.status(error.response?.status || 401).json({ error: errorMessage });
  }
});

app.get('/api/auth/logout', (req, res) => {
  // Logout from Auth0
  const domain = process.env.AUTH0_DOMAIN;
  const clientId = process.env.AUTH0_CLIENT_ID;
  const returnTo = req.query.returnTo || process.env.AUTH0_BASE_URL || 'http://localhost:3000';
  
  if (!domain || !clientId) {
    return res.status(500).json({ error: 'Auth0 not configured' });
  }
  
  const logoutUrl = `https://${domain}/v2/logout?` +
    `client_id=${clientId}&` +
    `returnTo=${encodeURIComponent(returnTo as string)}`;
  
  res.redirect(logoutUrl);
});

app.get('/api/auth/user', authenticate, (req, res) => {
  // Get current user info
  res.json({
    sub: (req as any).user.sub,
    email: (req as any).user.email,
    name: (req as any).user.name,
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

// Proxy to Python Backend (Video Analysis)
app.post('/api/pose/analyze-video', authenticate, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video provided' });
    }

    // Get configuration parameters from request body or query
    const config = {
      processingMode: req.body.processingMode || 'full',
      sampleRate: parseInt(req.body.sampleRate || '1', 10),
      maxFrames: req.body.maxFrames ? parseInt(req.body.maxFrames, 10) : undefined,
      enableYOLO: req.body.enableYOLO !== 'false',
      yoloConfidence: parseFloat(req.body.yoloConfidence || '0.5'),
      calibration: req.body.calibration ? parseFloat(req.body.calibration) : undefined,
    };

    // Create FormData for Python backend
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('video', req.file.buffer, {
      filename: req.file.originalname || 'video.mp4',
      contentType: req.file.mimetype || 'video/mp4',
    });
    
    // Append configuration parameters
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    // Forward to Pose Detection Service
    const response = await axios.post(
      `${POSE_DETECTION_SERVICE_URL}/api/pose/analyze-video`,
      formData,
      {
        headers: {
          'X-Internal-Request': 'true',
          'X-User-Id': (req as any).userId || 'anonymous',
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 300000, // 5 minute timeout for video processing
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Video analysis error:', error.message);
    res.status(error.response?.status || 500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

// Proxy to Python Backend (Live Stream Analysis)
app.post('/api/pose/analyze-live', authenticate, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No video stream provided' });
    }

    // Get configuration parameters
    const config = {
      processingMode: 'streaming',
      sampleRate: parseInt(req.body.sampleRate || '1', 10),
      maxFrames: req.body.maxFrames ? parseInt(req.body.maxFrames, 10) : undefined,
      enableYOLO: req.body.enableYOLO !== 'false',
      yoloConfidence: parseFloat(req.body.yoloConfidence || '0.5'),
      calibration: req.body.calibration ? parseFloat(req.body.calibration) : undefined,
    };

    // Create FormData for Python backend
    const FormData = require('form-data');
    const formData = new FormData();
    formData.append('video', req.file.buffer, {
      filename: req.file.originalname || 'stream.webm',
      contentType: req.file.mimetype || 'video/webm',
    });
    
    // Append configuration parameters
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    // Forward to Pose Detection Service
    const response = await axios.post(
      `${POSE_DETECTION_SERVICE_URL}/api/pose/analyze-live`,
      formData,
      {
        headers: {
          'X-Internal-Request': 'true',
          'X-User-Id': (req as any).userId || 'anonymous',
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
        timeout: 60000, // 1 minute timeout for live stream chunks
      }
    );
    res.json(response.data);
  } catch (error: any) {
    console.error('Live stream analysis error:', error.message);
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

