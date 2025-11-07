'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Video, Play, Square, Camera, TrendingUp, Target, AlertCircle } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase/auth';
import type { VideoAnalysis } from '@/types/session';

interface RealTimeStreamProps {
  onAnalysisUpdate?: (analysis: VideoAnalysis) => void;
  onStop?: (finalAnalysis: VideoAnalysis | null) => void;
}

export default function RealTimeStream({ onAnalysisUpdate, onStop }: RealTimeStreamProps) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState({
    framesProcessed: 0,
    batSpeed: 0,
    exitVelocity: 0,
    launchAngle: 0,
  });

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const analysisIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const startStreaming = async () => {
    try {
      setError(null);
      
      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false,
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      // Set up MediaRecorder for chunked streaming
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
          // Send chunk for analysis
          analyzeChunk(event.data);
        }
      };

      // Start recording with timeslice for chunked streaming
      mediaRecorder.start(1000); // Send chunks every 1 second

      setIsStreaming(true);
      startRealTimeAnalysis();
    } catch (err) {
      console.error('Failed to start streaming:', err);
      setError('Failed to access camera. Please check permissions.');
    }
  };

  const stopStreaming = async () => {
    try {
      // Stop media recorder
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }

      // Stop camera stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }

      // Stop analysis interval
      if (analysisIntervalRef.current) {
        clearInterval(analysisIntervalRef.current);
        analysisIntervalRef.current = null;
      }

      // Clear video
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setIsStreaming(false);
      setIsAnalyzing(false);

      // Call onStop with final analysis
      if (onStop) {
        onStop(currentAnalysis);
      }
    } catch (err) {
      console.error('Failed to stop streaming:', err);
    }
  };

  const analyzeChunk = async (chunk: Blob) => {
    if (isAnalyzing) return; // Skip if already analyzing

    try {
      setIsAnalyzing(true);
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) {
        throw new Error('Not authenticated');
      }

      const token = await auth.currentUser.getIdToken();

      // Create FormData with chunk
      const formData = new FormData();
      const file = new File([chunk], `chunk-${Date.now()}.webm`, { type: chunk.type });
      formData.append('video', file);
      formData.append('processingMode', 'streaming');
      formData.append('sampleRate', '1');
      formData.append('maxFrames', '30'); // Analyze last 30 frames
      formData.append('enableYOLO', 'true');
      formData.append('yoloConfidence', '0.5');

      const response = await fetch('/api/pose/analyze-live', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Failed to analyze chunk');
      }

      const analysis: VideoAnalysis = await response.json();
      
      if (analysis.ok) {
        setCurrentAnalysis(analysis);
        
        // Update stats
        if (analysis.metrics) {
          setStats({
            framesProcessed: stats.framesProcessed + (analysis.videoInfo?.frameCount || 0),
            batSpeed: analysis.metrics.batLinearSpeedMph,
            exitVelocity: analysis.metrics.exitVelocityEstimateMph,
            launchAngle: analysis.metrics.launchAngle,
          });
        }

        // Call update callback
        if (onAnalysisUpdate) {
          onAnalysisUpdate(analysis);
        }

        // Draw pose overlay on canvas
        drawPoseOverlay(analysis);
      }
    } catch (err) {
      console.error('Failed to analyze chunk:', err);
      setError('Failed to analyze video chunk');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const startRealTimeAnalysis = () => {
    // Analyze frames periodically
    analysisIntervalRef.current = setInterval(() => {
      if (videoRef.current && canvasRef.current && isStreaming) {
        captureAndAnalyzeFrame();
      }
    }, 2000); // Analyze every 2 seconds
  };

  const captureAndAnalyzeFrame = async () => {
    if (!videoRef.current || !canvasRef.current || isAnalyzing) return;

    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Draw current frame
      ctx.drawImage(video, 0, 0);

      // Convert canvas to blob
      canvas.toBlob(async (blob) => {
        if (blob) {
          await analyzeChunk(blob);
        }
      }, 'image/jpeg', 0.9);
    } catch (err) {
      console.error('Failed to capture frame:', err);
    }
  };

  const drawPoseOverlay = (analysis: VideoAnalysis) => {
    if (!canvasRef.current || !analysis.frames || analysis.frames.length === 0) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get the latest frame
    const latestFrame = analysis.frames[analysis.frames.length - 1];
    
    if (latestFrame.pose) {
      // Draw pose keypoints
      ctx.strokeStyle = '#00ff00';
      ctx.lineWidth = 2;
      
      // Draw skeleton connections (simplified)
      const keypoints = latestFrame.pose.keypoints || [];
      keypoints.forEach((kp: any) => {
        if (kp.score > 0.5) {
          ctx.beginPath();
          ctx.arc(kp.x, kp.y, 5, 0, 2 * Math.PI);
          ctx.fillStyle = '#00ff00';
          ctx.fill();
        }
      });
    }

    // Draw bat position if available
    if (latestFrame.batPosition) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(latestFrame.batPosition[0], latestFrame.batPosition[1], 10, 0, 2 * Math.PI);
      ctx.stroke();
    }

    // Draw ball position if available
    if (latestFrame.ball) {
      ctx.strokeStyle = '#0000ff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(
        latestFrame.ball.center[0],
        latestFrame.ball.center[1],
        latestFrame.ball.radius,
        0,
        2 * Math.PI
      );
      ctx.stroke();
    }
  };

  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  return (
    <div className="space-y-4">
      {/* Video Display */}
      <div className="relative bg-black rounded-lg overflow-hidden">
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full max-h-[600px] object-contain"
        />
        <canvas
          ref={canvasRef}
          className="absolute top-0 left-0 w-full h-full pointer-events-none"
          style={{ display: isStreaming ? 'block' : 'none' }}
        />
        
        {/* Overlay Stats */}
        {isStreaming && currentAnalysis && (
          <div className="absolute top-4 left-4 bg-black bg-opacity-70 text-white p-4 rounded-lg space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Bat Speed: {stats.batSpeed.toFixed(1)} mph</span>
            </div>
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4" />
              <span className="text-sm">Exit Velocity: {stats.exitVelocity.toFixed(1)} mph</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm">Launch Angle: {stats.launchAngle.toFixed(1)}°</span>
            </div>
            {isAnalyzing && (
              <div className="text-xs text-yellow-400 animate-pulse">
                Analyzing...
              </div>
            )}
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="absolute top-4 right-4 bg-red-600 text-white p-3 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-5 h-5" />
            <span className="text-sm">{error}</span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {!isStreaming ? (
          <button
            onClick={startStreaming}
            className="flex items-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Camera className="w-5 h-5" />
            Start Live Analysis
          </button>
        ) : (
          <button
            onClick={stopStreaming}
            className="flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
          >
            <Square className="w-5 h-5" />
            Stop Analysis
          </button>
        )}
      </div>

      {/* Real-time Feedback */}
      {currentAnalysis && currentAnalysis.formAnalysis && (
        <div className="bg-white rounded-lg shadow-md p-4">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Target className="w-5 h-5 text-blue-600" />
            Real-time Feedback
          </h3>
          {currentAnalysis.formAnalysis.feedback && currentAnalysis.formAnalysis.feedback.length > 0 ? (
            <ul className="space-y-1 text-sm">
              {currentAnalysis.formAnalysis.feedback.map((fb, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="text-blue-600">•</span>
                  <span>{fb}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-600">Keep swinging! Analysis will appear here.</p>
          )}
        </div>
      )}
    </div>
  );
}

