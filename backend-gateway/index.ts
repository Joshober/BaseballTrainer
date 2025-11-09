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
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized', message: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    
    if (!decodedToken) {
      console.error('Token verification failed - decodedToken is null');
      return res.status(401).json({ error: 'Unauthorized', message: 'Invalid token' });
    }

    (req as any).user = decodedToken;
    // Auth0 uses 'sub' as the user ID
    (req as any).userId = decodedToken.sub || decodedToken.user_id || 'anonymous';
    next();
  } catch (error: any) {
    console.error('Authentication error:', error.message);
    return res.status(401).json({ error: 'Unauthorized', message: error.message || 'Authentication failed' });
  }
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
    
    // Use id_token if available (it's always a regular JWT), otherwise use access_token
    // id_token is a regular JWT that can be verified, while access_token might be encrypted
    const tokenToUse = id_token || access_token;
    
    // Redirect to frontend with tokens
    // Note: In production, use secure HTTP-only cookies instead of query params
    // URL encode the token to handle special characters
    const encodedToken = encodeURIComponent(tokenToUse);
    const encodedUser = encodeURIComponent(JSON.stringify(user));
    res.redirect(`${frontendUrl}/auth/callback?token=${encodedToken}&user=${encodedUser}`);
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
      
      // Use id_token if available (it's always a regular JWT), otherwise use access_token
      // id_token is a regular JWT that can be verified, while access_token might be encrypted
      const tokenToUse = id_token || access_token;
      
      res.json({
        access_token: tokenToUse,
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
// Use upload.any() to allow optional file upload when videoPath is provided
app.post('/api/pose/analyze-video', authenticate, upload.any(), async (req, res) => {
  try {
    // Get videoUrl if provided (for videos already in storage)
    const videoUrl = req.body.videoUrl as string | undefined;
    
    // Extract videoPath from videoUrl if provided
    let videoPath: string | undefined;
    if (videoUrl) {
      // Extract path from URL format: /api/storage/videos/user_id/file.mp4 or full URL
      try {
        const urlMatch = videoUrl.match(/\/api\/storage\/(.+)/);
        if (urlMatch) {
          videoPath = urlMatch[1];
        } else {
          // Try parsing as full URL
          const urlObj = new URL(videoUrl);
          const pathMatch = urlObj.pathname.match(/\/api\/storage\/(.+)/);
          if (pathMatch) {
            videoPath = pathMatch[1];
          }
        }
      } catch (e) {
        // If URL parsing fails, try to extract path directly
        const pathMatch = videoUrl.match(/\/api\/storage\/(.+)/);
        if (pathMatch) {
          videoPath = pathMatch[1];
        }
      }
    }

    // Get uploaded file if any (multer stores files in req.files array when using upload.any())
    const uploadedFile = Array.isArray(req.files) && req.files.length > 0 
      ? req.files[0] 
      : (req as any).file;
    
    // If videoPath is provided, we can use direct file access (no file upload needed)
    // Otherwise, require file upload
    if (!videoPath && !uploadedFile) {
      return res.status(400).json({ error: 'No video provided. Either upload a video file or provide videoUrl.' });
    }

    // Get configuration parameters from request body or query
    // Validate and sanitize parameters
    const rawProcessingMode = req.body.processingMode || 'full';
    const validProcessingModes = ['full', 'sampled', 'streaming'];
    const processingMode = validProcessingModes.includes(rawProcessingMode) ? rawProcessingMode : 'full';
    
    const rawSampleRate = parseInt(req.body.sampleRate || '1', 10);
    const sampleRate = Math.max(1, Math.min(10, rawSampleRate)); // Clamp between 1-10
    
    const rawMaxFrames = req.body.maxFrames ? parseInt(req.body.maxFrames, 10) : undefined;
    const maxFrames = rawMaxFrames ? Math.max(1, Math.min(1000, rawMaxFrames)) : undefined; // Clamp between 1-1000
    
    const enableYOLO = req.body.enableYOLO !== 'false';
    
    const rawYoloConfidence = parseFloat(req.body.yoloConfidence || '0.5');
    const yoloConfidence = Math.max(0.1, Math.min(1.0, rawYoloConfidence)); // Clamp between 0.1-1.0
    
    const rawCalibration = req.body.calibration ? parseFloat(req.body.calibration) : undefined;
    const calibration = rawCalibration ? Math.max(0.5, Math.min(3.0, rawCalibration)) : undefined; // Clamp between 0.5-3.0m
    
    const config = {
      processingMode,
      sampleRate,
      maxFrames,
      enableYOLO,
      yoloConfidence,
      calibration,
    };

    // Create FormData for Python backend
    const FormData = require('form-data');
    const formData = new FormData();
    
    // If videoPath is provided, use direct file access (more efficient)
    if (videoPath) {
      console.log(`[Gateway] Using direct file access for video: ${videoPath}`);
      formData.append('videoPath', videoPath);
    } else if (uploadedFile) {
      // Otherwise, upload video bytes
      console.log(`[Gateway] Uploading video file: ${uploadedFile.originalname || uploadedFile.fieldname}`);
      formData.append('video', uploadedFile.buffer, {
        filename: uploadedFile.originalname || 'video.mp4',
        contentType: uploadedFile.mimetype || 'video/mp4',
      });
    }
    
    // Append configuration parameters
    Object.entries(config).forEach(([key, value]) => {
      if (value !== undefined) {
        formData.append(key, String(value));
      }
    });

    // Check service health before processing (optional but helpful for debugging)
    try {
      const healthCheck = await axios.get(`${POSE_DETECTION_SERVICE_URL}/api/health`, {
        timeout: 5000, // 5 second timeout for health check
      }).catch(() => null);
      
      if (!healthCheck || healthCheck.status !== 200) {
        console.warn(`[Gateway] Pose detection service health check failed, but continuing with request`);
      } else {
        console.log(`[Gateway] Pose detection service health check passed`);
      }
    } catch (healthError) {
      // Health check failed, but we'll try the request anyway
      console.warn(`[Gateway] Could not verify pose detection service health: ${healthError}`);
    }

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
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.error || error.response?.data?.message || error.message;
    
    // Check for service unavailable errors
    if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT' || statusCode === 503) {
      return res.status(503).json({
        error: 'Service unavailable',
        message: 'Pose detection service is not available. Please ensure the service is running.',
        hint: 'Check if the pose detection service is running on the configured port.'
      });
    }
    
    res.status(statusCode).json({
      error: 'Internal server error',
      message: errorMessage
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
    console.error('Error details:', error.response?.data || error.message);
    const statusCode = error.response?.status || 500;
    const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
    res.status(statusCode).json({
      error: 'Internal server error',
      message: errorMessage,
      details: error.response?.data
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

