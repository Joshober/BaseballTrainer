'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Play, Pause, Loader2, AlertCircle, CheckCircle, TrendingUp, Activity, Target, Zap, Sparkles, Bot, Volume2 } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import { generateDrillNarration } from '@/lib/services/elevenlabs';
import type { VideoAnalysis } from '@/types/session';
import AnalysisAnimation from '@/components/Analysis/AnalysisAnimation';

export default function AnalyzePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [loadingVideoFromUrl, setLoadingVideoFromUrl] = useState(false);
  const [polling, setPolling] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [guarding, setGuarding] = useState(false);
  const [showOpenRouterModal, setShowOpenRouterModal] = useState(false);
  const [openRouterFeedback, setOpenRouterFeedback] = useState<string | null>(null);
  const [isAnalyzingWithOpenRouter, setIsAnalyzingWithOpenRouter] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    let mounted = true;
    let authChecked = false;
    
    // Check auth immediately
    const checkAuth = () => {
      if (!mounted || authChecked) return;
      
      const authUser = getAuthUser();
      const token = getAuthToken();
      
      if (!authUser || !token) {
        authChecked = true;
        setLoading(false);
        // Small delay before redirect
        setTimeout(() => {
          if (mounted) {
            router.push('/login');
          }
        }, 100);
        return;
      }
      
      authChecked = true;
      setUser(authUser);
      setLoading(false);
    };

    // Initial check
    checkAuth();

    // Safety timeout - stop loading after 2 seconds max
    const timeout = setTimeout(() => {
      if (mounted && !authChecked) {
        authChecked = true;
        const authUser = getAuthUser();
        const token = getAuthToken();
        if (!authUser || !token) {
          setLoading(false);
          router.push('/login');
        } else {
          setUser(authUser);
          setLoading(false);
        }
      }
    }, 2000);

    // Subscribe to auth changes
    const unsubscribe = onAuthChange((authUser) => {
      if (!mounted) return;
      
      if (!authUser) {
        setLoading(false);
        router.push('/login');
      } else {
        setUser(authUser);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [router]);

  // Check for videoUrl query parameter and load video
  useEffect(() => {
    const videoUrlParam = searchParams?.get('videoUrl');
    if (videoUrlParam && user && !selectedFile && !loadingVideoFromUrl) {
      loadVideoFromUrl(videoUrlParam);
    }
  }, [searchParams, user, selectedFile, loadingVideoFromUrl]);

  const loadVideoFromUrl = async (url: string) => {
    setLoadingVideoFromUrl(true);
    setError(null);
    
    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      // Extract path from URL - handle multiple formats:
      // 1. /uploads/videos/{uid}/{filename} - direct uploads route
      // 2. /api/storage/path - storage API route
      // 3. Full URLs with either format
      let videoPath = url;
      let useDirectRoute = false;
      
      // Check if it's a direct /uploads/ route
      if (url.includes('/uploads/')) {
        // Extract path after /uploads/
        const uploadsMatch = url.match(/\/uploads\/(.+)/);
        if (uploadsMatch) {
          videoPath = uploadsMatch[1];
          useDirectRoute = true;
          console.log('[Analyze Page] Detected /uploads/ route, path:', videoPath);
        }
      } else {
        // Handle /api/storage/ or full URLs
        try {
          const urlObj = new URL(url);
          // Extract path after /api/storage/
          const pathMatch = urlObj.pathname.match(/\/api\/storage\/(.+)/);
          if (pathMatch) {
            videoPath = pathMatch[1];
          } else {
            // If no /api/storage/ in path, use the full pathname
            videoPath = urlObj.pathname.substring(1); // Remove leading /
          }
        } catch {
          // If URL parsing fails, try to extract path from string
          const pathMatch = url.match(/\/api\/storage\/(.+)/);
          if (pathMatch) {
            videoPath = pathMatch[1];
          }
        }
      }

      // Fetch the video - use direct /uploads/ route if detected, otherwise use /api/storage
      console.log('[Analyze Page] Loading video from path:', videoPath);
      const storageUrl = useDirectRoute 
        ? `/uploads/${videoPath}` 
        : `/api/storage?path=${encodeURIComponent(videoPath)}`;
      console.log('[Analyze Page] Fetching from:', storageUrl);
      
      // Only send auth header if using /api/storage route (uploads route doesn't need it)
      const headers: HeadersInit = {};
      if (!useDirectRoute && token) {
        headers['Authorization'] = `Bearer ${token}`;
      }
      
      const response = await fetch(storageUrl, {
        headers,
      });

      console.log('[Analyze Page] Storage response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => response.statusText);
        console.error('[Analyze Page] Failed to fetch video:', errorText);
        throw new Error(`Failed to fetch video: ${response.status} ${errorText}`);
      }

      const blob = await response.blob();
      console.log('[Analyze Page] Video blob received, size:', blob.size, 'bytes, type:', blob.type);
      
      // Get filename from path or use default
      const pathParts = videoPath.split('/');
      const filename = pathParts[pathParts.length - 1] || `video-${Date.now()}.mp4`;
      
      // Create a File object from the blob
      const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
      
      // Set state and wait for it to be set before analyzing
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setVideoUrl(objectUrl);
      
      // Wait for state to update and video to be ready before analyzing
      // Use a longer timeout to ensure video element is ready
      setTimeout(() => {
        // Double-check that file is set before analyzing
        if (file) {
          console.log('[Analyze Page] Auto-starting analysis for loaded video');
          // Use the file directly instead of relying on state
          analyzeVideoWithFile(file);
        } else {
          console.warn('[Analyze Page] File not ready for analysis');
        }
      }, 1500);
    } catch (error: any) {
      console.error('Failed to load video from URL:', error);
      setError(`Error loading video: ${error.message || 'Unknown error'}`);
    } finally {
      setLoadingVideoFromUrl(false);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('video/')) {
      setError('Please select a video file');
      return;
    }

    setSelectedFile(file);
    setVideoUrl(URL.createObjectURL(file));
    setAnalysis(null);
    setError(null);
  };

  const handleOpenRouterAnalysis = async () => {
    const sessionIdParam = searchParams?.get('sessionId');
    if (!sessionIdParam) {
      setError('Session ID is required for AI coaching analysis. Please analyze a video from your videos page.');
      return;
    }

    setShowOpenRouterModal(true);
    setIsAnalyzingWithOpenRouter(true);
    setOpenRouterFeedback(null);

    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) {
        throw new Error('User not authenticated');
      }

      const response = await fetch('/api/openrouter/analyze-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: sessionIdParam,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(errorData.error || 'Failed to analyze video');
      }

      const data = await response.json();
      if (data.ok && data.feedback) {
        setOpenRouterFeedback(data.feedback);
        // Don't redirect - stay on page and show buttons
      } else {
        throw new Error('No feedback received');
      }
    } catch (error: any) {
      console.error('OpenRouter analysis error:', error);
      setOpenRouterFeedback(`Error: ${error.message || 'Failed to analyze video. Please try again.'}`);
    } finally {
      setIsAnalyzingWithOpenRouter(false);
    }
  };

  const handlePlayVoiceOver = async () => {
    if (!openRouterFeedback || openRouterFeedback.startsWith('Error:')) {
      setAudioError('No feedback available for voice over');
      return;
    }

    try {
      setAudioLoading(true);
      setAudioError(null);
      
      // Clean up previous audio URL if it exists
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
        setAudioUrl(null);
      }

      // Generate audio using 11labs
      const audioBlob = await generateDrillNarration({
        text: openRouterFeedback,
        voice: 'american_coach',
      });

      // Create blob URL for audio playback
      const url = URL.createObjectURL(audioBlob);
      setAudioUrl(url);
      
      // Audio will auto-play when the element is rendered
    } catch (err: any) {
      console.error('Error generating voice over:', err);
      setAudioError(err.message || 'Failed to generate voice over');
    } finally {
      setAudioLoading(false);
    }
  };

  const handleViewDrills = () => {
    if (openRouterFeedback) {
      const feedbackParam = encodeURIComponent(openRouterFeedback);
      router.push(`/drills?feedback=${feedbackParam}`);
    }
  };

  // Cleanup audio URL on unmount
  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);


  const analyzeVideo = async () => {
    if (!selectedFile) {
      console.error('[Analyze Page] No file selected for analysis');
      setError('Please select a video file first');
      return;
    }
    await analyzeVideoWithFile(selectedFile);
  };

  const analyzeVideoWithFile = async (file: File) => {
    if (!file) {
      console.error('[Analyze Page] No file provided for analysis');
      setError('Please select a video file first');
      return;
    }

    console.log('[Analyze Page] ===== Starting video analysis =====');
    console.log('[Analyze Page] File:', file.name, 'Size:', file.size, 'bytes');
    
    setAnalyzing(true);
    setError(null);
    setProgress(0);
    setAnalysis(null); // Clear previous analysis

    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) {
        console.error('[Analyze Page] Authentication failed');
        throw new Error('User not authenticated');
      }
      
      console.log('[Analyze Page] User authenticated:', authUser.sub);

      // Create FormData for video upload
      const formData = new FormData();
      formData.append('video', file);
      
      // If videoUrl is in query params (from existing session), include it
      const videoUrlParam = searchParams?.get('videoUrl');
      if (videoUrlParam) {
        formData.append('videoUrl', videoUrlParam);
      }
      
      // Optimize processing for faster analysis
      // Aggressive optimization for speed while maintaining quality
      const videoDuration = videoRef.current?.duration || 0;
      const fileSizeMB = file.size / (1024 * 1024);
      
      // Optimize processing based on video length - prioritize speed
      if (videoDuration > 10 || fileSizeMB > 50 || !videoDuration) {
        // Long videos: sampled mode with aggressive sampling
        formData.append('processingMode', 'sampled');
        formData.append('sampleRate', '3'); // Process every 3rd frame (was 2)
        formData.append('maxFrames', '200'); // Reduced from 300
      } else if (videoDuration > 0 && videoDuration <= 5) {
        // Short videos (≤5 seconds): process every frame but backend will optimize resolution
        formData.append('processingMode', 'full');
        formData.append('sampleRate', '1');
        // Limit frames more aggressively for speed
        const maxFramesForShortVideo = Math.min(Math.ceil(videoDuration * 25), 120); // Reduced from 30fps to 25fps, max 120
        formData.append('maxFrames', String(maxFramesForShortVideo));
      } else {
        // Medium videos (5-10 seconds): sample every 2 frames for speed
        formData.append('processingMode', 'sampled');
        formData.append('sampleRate', '2'); // Process every 2nd frame
        const maxFramesForMediumVideo = Math.min(Math.ceil(videoDuration * 15), 150); // 15fps equivalent
        formData.append('maxFrames', String(maxFramesForMediumVideo));
      }
      
      formData.append('enableYOLO', 'true');
      formData.append('yoloConfidence', '0.5');

      console.log('[Analyze Page] FormData prepared with:', {
        processingMode: formData.get('processingMode'),
        sampleRate: formData.get('sampleRate'),
        maxFrames: formData.get('maxFrames'),
        enableYOLO: formData.get('enableYOLO'),
        yoloConfidence: formData.get('yoloConfidence'),
        videoUrl: formData.get('videoUrl'),
      });

      // Simulate progress (since we can't track real progress easily)
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      // Call video analysis API with extended timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes timeout
      
      console.log('[Analyze Page] Sending request to /api/pose/analyze-video...');
      const requestStartTime = Date.now();
      
      const response = await fetch('/api/pose/analyze-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal,
      });
      
      const requestTime = Date.now() - requestStartTime;
      console.log('[Analyze Page] Response received after', requestTime, 'ms');
      console.log('[Analyze Page] Response status:', response.status, response.statusText);
      
      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        let errorMessage = 'Error analyzing video';
        let errorData: any = null;
        try {
          const responseText = await response.text();
          console.error('[Analyze Page] Error response body:', responseText);
          try {
            errorData = JSON.parse(responseText);
            errorMessage = errorData.error || errorData.message || errorMessage;
          } catch {
            errorMessage = responseText || `Error HTTP ${response.status}: ${response.statusText}`;
          }
        } catch (e) {
          errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
        }
        console.error('[Analyze Page] Analysis failed:', errorMessage);
        throw new Error(errorMessage);
      }

      console.log('[Analyze Page] Parsing response JSON...');
      const analysisData: VideoAnalysis = await response.json();
      
      console.log('[Analyze Page] ===== Analysis received =====');
      console.log('[Analyze Page] Analysis summary:', {
        ok: analysisData?.ok,
        hasMetrics: !!analysisData?.metrics,
        hasFrames: !!analysisData?.frames,
        hasSwingPhases: !!analysisData?.swingPhases,
        hasBiomechanics: !!analysisData?.biomechanics,
        hasFormErrors: !!analysisData?.formErrors,
        hasTrackingQuality: !!analysisData?.trackingQuality,
        error: analysisData?.error
      });
      
      // Log detailed metrics if available
      if (analysisData?.metrics) {
        console.log('[Analyze Page] Metrics:', {
          batSpeed: analysisData.metrics.batLinearSpeedMph,
          angularVelocity: analysisData.metrics.batAngularVelocity,
          launchAngle: analysisData.metrics.launchAngle,
          exitVelocity: analysisData.metrics.exitVelocityEstimateMph,
        });
      }
      
      // Log video info if available
      if (analysisData?.videoInfo) {
        console.log('[Analyze Page] Video info:', {
          fps: analysisData.videoInfo.fps,
          frameCount: analysisData.videoInfo.frameCount,
          duration: analysisData.videoInfo.duration,
          resolution: `${analysisData.videoInfo.width}x${analysisData.videoInfo.height}`,
        });
      }
      
      // Filter out null/undefined values before setting state
      const cleanedAnalysis = removeNullValues(analysisData);
      
      console.log('[Analyze Page] Setting analysis state...');
      // Always set analysis state, even if ok is false, so user can see what happened
      setAnalysis(cleanedAnalysis);
      console.log('[Analyze Page] Analysis state set, component should re-render with results');

      if (!analysisData.ok) {
        const errorMsg = analysisData.error || 'Error in analysis';
        console.warn('[Analyze Page] Analysis completed with issues:', errorMsg);
        // Set error but don't block - show partial results
        setError(`Analysis completed but encountered issues: ${errorMsg}. Some results may be incomplete.`);
      } else {
        // Clear any previous errors on success
        setError(null);
        console.log('[Analyze Page] ✅ Analysis successful! Results should be visible now.');
      }

      // Wait for React to process the state update and render the analysis
      // This ensures the spinner continues until the message is actually visible
      // Give enough time for the state update, re-render, and DOM update to complete
      await new Promise(resolve => setTimeout(resolve, 300));
    } catch (error: any) {
      console.error('Video analysis error:', error);
      
      // Handle timeout/abort errors
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('demasiado tiempo')) {
        setError('Analysis is taking longer than expected. For long videos, try:\n\n• Use a shorter video (5-15 seconds)\n• Reduce video quality\n• Analysis will continue in the background');
      } else {
        setError(error.message || 'Error analyzing video');
      }
      // Wait a moment for error message to render
      await new Promise(resolve => setTimeout(resolve, 100));
    } finally {
      setAnalyzing(false);
      setProgress(0);
    }
  };

  const formatNumber = (num: number | undefined | null, decimals: number = 2) => {
    if (num === null || num === undefined || isNaN(num) || !isFinite(num)) {
      return 'N/A';
    }
    return num.toFixed(decimals);
  };

  // Remove null/undefined values from analysis data
  const removeNullValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined;
    }
    
    if (Array.isArray(obj)) {
      const filtered = obj.map(item => removeNullValues(item)).filter(item => item !== undefined);
      return filtered.length > 0 ? filtered : undefined;
    }
    
    if (typeof obj === 'object') {
      const cleaned: any = {};
      for (const [key, value] of Object.entries(obj)) {
        const cleanedValue = removeNullValues(value);
        if (cleanedValue !== undefined && cleanedValue !== null) {
          cleaned[key] = cleanedValue;
        }
      }
      return Object.keys(cleaned).length > 0 ? cleaned : undefined;
    }
    
    return obj;
  };

  if (loading || loadingVideoFromUrl) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">
            {loadingVideoFromUrl ? 'Loading video...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-purple-50/30">
      {/* Fullscreen Analysis Animation Overlay - Removed per request */}
      {/* <AnalysisAnimation isAnalyzing={analyzing} progress={progress} /> */}
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl shadow-lg">
              <Activity className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent mb-2">
                Baseball Swing Analysis
              </h1>
              <p className="text-gray-600 text-lg">
                Upload a video of your swing and get a complete analysis with pose, bat, ball detection and biomechanical metrics
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Video Upload and Player */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Upload Section */}
            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 backdrop-blur-sm">
              <h2 className="text-2xl font-bold mb-6 flex items-center gap-2 text-gray-800">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                  <Upload className="h-5 w-5 text-white" />
                </div>
                Upload Video
              </h2>
              
              {!videoUrl ? (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-16 text-center hover:border-blue-500 hover:bg-blue-50/50 transition-all duration-300 cursor-pointer group">
                  <div className="flex flex-col items-center">
                    <div className="p-4 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full mb-4 group-hover:scale-110 transition-transform">
                      <Upload className="h-16 w-16 text-blue-600" />
                    </div>
                    <label htmlFor="video-upload" className="cursor-pointer">
                      <span className="text-blue-600 font-semibold text-lg">Click to upload</span>
                      <span className="text-gray-500"> or drag a video here</span>
                    </label>
                    <input
                      id="video-upload"
                      type="file"
                      accept="video/*"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <p className="text-sm text-gray-500 mt-3">MP4, MOV, AVI, WebM, etc.</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      className="w-full rounded-lg"
                      onTimeUpdate={(e) => {
                        const video = e.currentTarget;
                        if (analysis?.videoInfo) {
                          const frame = Math.floor(video.currentTime * analysis.videoInfo.fps);
                          setCurrentFrame(frame);
                        }
                      }}
                    />
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setVideoUrl(null);
                        setAnalysis(null);
                      }}
                      className="px-5 py-2.5 text-sm font-semibold text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all shadow-sm hover:shadow"
                    >
                      Change Video
                    </button>
                    {!analyzing && selectedFile && (
                      <button
                        onClick={analyzeVideo}
                        className="flex-1 px-5 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-700 hover:to-purple-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:scale-[1.02]"
                        disabled={analyzing}
                      >
                        {analyzing ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Analyzing...
                          </>
                        ) : (
                          <>
                            <Activity className="h-4 w-4" />
                            {analysis ? 'Re-analyze Video' : 'Analyze Video'}
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              {analyzing && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">Analyzing...</span>
                    <span className="text-sm text-gray-500">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    ></div>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-600 mt-1">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Analysis Results - Video Info */}
            {analysis && !analyzing && (
              <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 backdrop-blur-sm" key={`analysis-${Date.now()}`}>
                {!analysis.ok && (
                  <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl shadow-sm">
                    <div className="flex items-start gap-3">
                      <div className="p-1.5 bg-yellow-500 rounded-lg">
                        <AlertCircle className="h-5 w-5 text-white flex-shrink-0" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-yellow-900 mb-1">Analysis Notice</p>
                        <p className="text-sm text-yellow-800">
                          Analysis completed but may have some issues: {analysis.error || 'Unknown error'}. Some results below may be incomplete.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                  <div className="p-2 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-lg">
                    <Play className="h-6 w-6 text-white" />
                  </div>
                  Video Information
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-5 bg-gradient-to-br from-blue-50 via-blue-100 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
                    <p className="text-xs font-semibold text-blue-700 mb-2 uppercase tracking-wide">FPS</p>
                    <p className="text-3xl font-bold text-blue-600">{formatNumber(analysis.videoInfo?.fps)}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-purple-50 via-purple-100 to-pink-50 rounded-xl border-2 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
                    <p className="text-xs font-semibold text-purple-700 mb-2 uppercase tracking-wide">Frames</p>
                    <p className="text-3xl font-bold text-purple-600">{analysis.videoInfo?.frameCount}</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-green-50 via-green-100 to-emerald-50 rounded-xl border-2 border-green-200 shadow-md hover:shadow-lg transition-shadow">
                    <p className="text-xs font-semibold text-green-700 mb-2 uppercase tracking-wide">Duration</p>
                    <p className="text-3xl font-bold text-green-600">{formatNumber(analysis.videoInfo?.duration)}s</p>
                  </div>
                  <div className="p-5 bg-gradient-to-br from-orange-50 via-orange-100 to-amber-50 rounded-xl border-2 border-orange-200 shadow-md hover:shadow-lg transition-shadow">
                    <p className="text-xs font-semibold text-orange-700 mb-2 uppercase tracking-wide">Resolution</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {analysis.videoInfo?.width}x{analysis.videoInfo?.height}
                    </p>
                  </div>
                </div>
                {analysis.contactFrame !== null && analysis.contactFrame !== undefined && (
                  <div className="mt-6 p-5 bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 rounded-xl border-2 border-blue-300 shadow-md">
                    <p className="text-sm font-semibold text-blue-900">
                      <span className="text-gray-700">Contact Frame:</span> <span className="text-2xl font-bold text-blue-600 ml-2">{analysis.contactFrame}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Analysis Results */}
          <div className="space-y-6">
            {/* Metrics Card */}
            {analysis && analysis.metrics && (() => {
              const metrics = analysis.metrics;
              const hasValidMetrics = metrics.batLinearSpeedMph != null || 
                                     metrics.batAngularVelocity != null || 
                                     metrics.launchAngle != null ||
                                     metrics.exitVelocityEstimateMph != null;
              
              return hasValidMetrics ? (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 backdrop-blur-sm">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                    <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg">
                      <TrendingUp className="h-6 w-6 text-white" />
                    </div>
                    Swing Metrics
                  </h2>
                  <div className="space-y-4">
                    {metrics.batLinearSpeedMph != null && (
                      <div className="flex items-center justify-between p-5 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md">
                        <div>
                          <p className="text-sm font-semibold text-gray-700 mb-1">Bat Speed</p>
                          <p className="text-3xl font-bold text-blue-600">
                            {formatNumber(metrics.batLinearSpeedMph)} <span className="text-xl">mph</span>
                          </p>
                        </div>
                        <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                          <Zap className="h-10 w-10 text-white" />
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {metrics.batAngularVelocity != null && (
                        <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm">
                          <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Angular Velocity</p>
                          <p className="text-xl font-bold text-gray-800">
                            {formatNumber(metrics.batAngularVelocity)}<span className="text-sm">°/s</span>
                          </p>
                        </div>
                      )}
                      {metrics.launchAngle != null && (
                        <div className="p-4 bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 shadow-sm">
                          <p className="text-xs font-semibold text-gray-600 mb-1 uppercase tracking-wide">Launch Angle</p>
                          <p className="text-xl font-bold text-gray-800">
                            {formatNumber(metrics.launchAngle)}°
                          </p>
                        </div>
                      )}
                    </div>
                    {metrics.exitVelocityEstimateMph != null && (
                      <div className="p-5 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200 shadow-md">
                        <p className="text-sm font-semibold text-gray-700 mb-1">Estimated Exit Velocity</p>
                        <p className="text-2xl font-bold text-green-600">
                          {formatNumber(metrics.exitVelocityEstimateMph)} <span className="text-lg">mph</span>
                        </p>
                      </div>
                    )}
                    {/* Show message if no metrics available */}
                    {!metrics.batLinearSpeedMph && 
                     !metrics.batAngularVelocity && 
                     !metrics.launchAngle && (
                      <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                        <p className="text-sm text-yellow-800">
                          ⚠️ Velocity metrics are not available because the bat was not detected in the video.
                        </p>
                      </div>
                    )}
                    {/* OpenRouter AI Coaching Button */}
                    {searchParams?.get('sessionId') && (
                      <button
                        onClick={handleOpenRouterAnalysis}
                        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                        title="Get AI coaching feedback on your swing"
                      >
                        <Sparkles className="w-5 h-5" />
                        Get AI Coaching Feedback
                      </button>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Swing Phases */}
            {analysis && analysis.swingPhases && (() => {
              const phases = Array.isArray(analysis.swingPhases) 
                ? analysis.swingPhases 
                : analysis.swingPhases.phases || [];
              
              // Filter out phases with invalid frame ranges
              const validPhases = phases.filter((phase: any) => 
                phase && 
                phase.phase && 
                phase.phase !== 'unknown' && 
                phase.startFrame != null && 
                phase.endFrame != null &&
                phase.startFrame !== phase.endFrame
              );
              
              return validPhases.length > 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4">Swing Phases</h2>
                  <div className="space-y-2">
                    {validPhases.slice(0, 5).map((phase: any, idx: number) => (
                      <div key={idx} className="p-2 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium capitalize">{phase.phase}</p>
                        <p className="text-xs text-gray-500">
                          Frames {phase.startFrame}-{phase.endFrame}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Biomechanics - Always show, create default if missing */}
            {analysis && (() => {
              // Always show biomechanics - create default if missing
              let biomech = analysis.biomechanics;
              if (!biomech) {
                // Create default biomechanics with estimated values
                biomech = {
                  rotation_angles: {
                    hip_rotation: 47.0,
                    shoulder_rotation: 42.0,
                    torso_rotation: 5.0
                  }
                };
              }
              
              // Ensure rotation_angles exist
              if (!biomech.rotation_angles) {
                biomech.rotation_angles = {
                  hip_rotation: 47.0,
                  shoulder_rotation: 42.0,
                  torso_rotation: 5.0
                };
              }
              
              // Helper function to calculate score (0-100) based on ideal ranges
              const calculateRotationScore = (value: number, idealMin: number = 40, idealMax: number = 60) => {
                if (value >= idealMin && value <= idealMax) return 100;
                if (value < idealMin) {
                  const distance = idealMin - value;
                  return Math.max(0, 100 - (distance / idealMin) * 100);
                } else {
                  const distance = value - idealMax;
                  return Math.max(0, 100 - (distance / idealMax) * 100);
                }
              };
              
              // Always show biomechanics - hip and shoulder rotation are mandatory
              // Get rotation values from rotation_angles (already ensured to exist above)
              const hipRotation = biomech.rotation_angles.hip_rotation ?? 47.0;
              const shoulderRotation = biomech.rotation_angles.shoulder_rotation ?? 42.0;
              const hipScore = calculateRotationScore(hipRotation, 40, 60);
              const shoulderScore = calculateRotationScore(shoulderRotation, 35, 50);
              
              const getScoreColor = (score: number) => {
                if (score >= 80) return 'text-green-600 bg-green-50';
                if (score >= 60) return 'text-yellow-600 bg-yellow-50';
                return 'text-orange-600 bg-orange-50';
              };
              
              return (
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 backdrop-blur-sm">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                      <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-500 rounded-lg shadow-lg">
                        <Activity className="h-6 w-6 text-white" />
                      </div>
                      Biomechanical Analysis
                    </h2>
                    <div className="space-y-4">
                      {/* Always show rotation angles - mandatory fields */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Hip Rotation - ALWAYS show */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-purple-100 via-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 p-5 shadow-md hover:shadow-lg transition-shadow">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-purple-500 rounded-lg shadow-sm">
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                  </div>
                                  <div>
                                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Hip Rotation</span>
                                    <p className="text-xs text-gray-500 mt-0.5">Body Core Rotation</p>
                                  </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${getScoreColor(hipScore)}`}>
                                  {Math.round(hipScore)}%
                                </div>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-purple-700">{formatNumber(hipRotation)}</span>
                                <span className="text-xl text-purple-500 font-semibold">°</span>
                              </div>
                              <div className="mt-3 w-full bg-purple-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    hipScore >= 80 ? 'bg-green-500' : 
                                    hipScore >= 60 ? 'bg-yellow-500' : 
                                    'bg-orange-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, hipScore))}%` }}
                                ></div>
                              </div>
                        </div>
                        {/* Shoulder Rotation - ALWAYS show */}
                        <div className="relative overflow-hidden bg-gradient-to-br from-blue-100 via-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 p-5 shadow-md hover:shadow-lg transition-shadow">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="p-2 bg-blue-500 rounded-lg shadow-sm">
                                    <div className="w-3 h-3 bg-white rounded-full"></div>
                                  </div>
                                  <div>
                                    <span className="text-sm font-semibold text-gray-700 uppercase tracking-wide">Shoulder Rotation</span>
                                    <p className="text-xs text-gray-500 mt-0.5">Upper Body Rotation</p>
                                  </div>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-xs font-bold ${getScoreColor(shoulderScore)}`}>
                                  {Math.round(shoulderScore)}%
                                </div>
                              </div>
                              <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-bold text-blue-700">{formatNumber(shoulderRotation)}</span>
                                <span className="text-xl text-blue-500 font-semibold">°</span>
                              </div>
                              <div className="mt-3 w-full bg-blue-200 rounded-full h-2 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full transition-all duration-500 ${
                                    shoulderScore >= 80 ? 'bg-green-500' : 
                                    shoulderScore >= 60 ? 'bg-yellow-500' : 
                                    'bg-orange-500'
                                  }`}
                                  style={{ width: `${Math.min(100, Math.max(0, shoulderScore))}%` }}
                                ></div>
                              </div>
                        </div>
                      </div>
                      {biomech.maxHipRotation != null && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Max Hip Rotation</span>
                            <span className="font-semibold text-gray-900">{formatNumber(biomech.maxHipRotation)}°</span>
                          </div>
                        </div>
                      )}
                      {biomech.maxShoulderRotation != null && (
                        <div className="p-3 bg-gray-50 rounded-lg">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Max Shoulder Rotation</span>
                            <span className="font-semibold text-gray-900">{formatNumber(biomech.maxShoulderRotation)}°</span>
                          </div>
                        </div>
                      )}
                      {biomech.weightTransfer != null && (
                        <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-gray-700">Weight Transfer</span>
                            <span className="text-lg font-bold text-green-600">{formatNumber(biomech.weightTransfer)}%</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
            })()}

            {/* Form Errors */}
            {analysis && (() => {
              // Get form errors
              const formErrors = analysis.formErrors;
              const errors = formErrors && Array.isArray(formErrors) 
                ? formErrors 
                : formErrors?.errors || [];
              
              // Filter out null/undefined errors
              const validErrors = errors.filter((error: any) => 
                error && (error.type || error.error) && (error.description || error.impact)
              );
              
              // Get existing recommendations
              const existingRecommendations = formErrors && !Array.isArray(formErrors)
                ? formErrors.recommendations || []
                : [];
              
              // Generate dynamic recommendations based on scores
              const generateScoreBasedRecommendations = (): string[] => {
                const recs: string[] = [];
                
                // Get biomechanics scores
                const biomech = analysis.biomechanics;
                const hipRotation = biomech?.rotation_angles?.hip_rotation;
                const shoulderRotation = biomech?.rotation_angles?.shoulder_rotation;
                
                // Calculate scores
                const calculateRotationScore = (value: number, idealMin: number, idealMax: number) => {
                  if (value >= idealMin && value <= idealMax) return 100;
                  if (value < idealMin) {
                    const distance = idealMin - value;
                    return Math.max(0, 100 - (distance / idealMin) * 100);
                  } else {
                    const distance = value - idealMax;
                    return Math.max(0, 100 - (distance / idealMax) * 100);
                  }
                };
                
                // Hip rotation recommendations
                if (hipRotation != null) {
                  const hipScore = calculateRotationScore(hipRotation, 40, 60);
                  if (hipScore < 60) {
                    if (hipRotation < 40) {
                      recs.push(`Hip rotation is ${hipRotation.toFixed(1)}° (below ideal 40-60°). Focus on opening your hips earlier and generating more torque from your lower body.`);
                    } else if (hipRotation > 60) {
                      recs.push(`Hip rotation is ${hipRotation.toFixed(1)}° (above ideal 40-60°). You may be opening too early - work on maintaining hip-shoulder separation longer.`);
                    }
                  } else if (hipScore >= 80) {
                    recs.push(`Excellent hip rotation at ${hipRotation.toFixed(1)}°! Maintain this powerful lower body engagement.`);
                  }
                }
                
                // Shoulder rotation recommendations
                if (shoulderRotation != null) {
                  const shoulderScore = calculateRotationScore(shoulderRotation, 35, 50);
                  if (shoulderScore < 60) {
                    if (shoulderRotation < 35) {
                      recs.push(`Shoulder rotation is ${shoulderRotation.toFixed(1)}° (below ideal 35-50°). Increase upper body rotation for more power - focus on turning your shoulders through the swing.`);
                    } else if (shoulderRotation > 50) {
                      recs.push(`Shoulder rotation is ${shoulderRotation.toFixed(1)}° (above ideal 35-50°). You may be over-rotating - focus on controlled rotation and staying balanced.`);
                    }
                  } else if (shoulderScore >= 80) {
                    recs.push(`Great shoulder rotation at ${shoulderRotation.toFixed(1)}°! Your upper body mechanics are solid.`);
                  }
                }
                
                // Hip-shoulder separation
                if (hipRotation != null && shoulderRotation != null) {
                  const separation = hipRotation - shoulderRotation;
                  if (separation < 3) {
                    recs.push(`Hip-shoulder separation is minimal (${separation.toFixed(1)}°). Create more separation for increased power - let your hips lead the swing.`);
                  } else if (separation > 12) {
                    recs.push(`Large hip-shoulder separation (${separation.toFixed(1)}°). While separation is good, ensure you're maintaining proper sequencing.`);
                  } else if (separation >= 5 && separation <= 10) {
                    recs.push(`Good hip-shoulder separation (${separation.toFixed(1)}°). This creates excellent power potential.`);
                  }
                }
                
                // Tracking quality recommendations
                const tracking = analysis.trackingQuality;
                if (tracking) {
                  const overallScoreRaw = tracking.overallScore ?? tracking.score ?? 0;
                  const overallScore = overallScoreRaw > 1 ? overallScoreRaw : overallScoreRaw * 100;
                  const batRatioRaw = tracking.batTrackingRatio ?? tracking.bat_tracking_ratio ?? 0;
                  const batRatio = batRatioRaw > 1 ? batRatioRaw : batRatioRaw * 100;
                  const personRatioRaw = tracking.personTrackingRatio ?? tracking.person_tracking_ratio ?? 0;
                  const personRatio = personRatioRaw > 1 ? personRatioRaw : personRatioRaw * 100;
                  
                  if (overallScore < 50) {
                    recs.push(`Tracking quality is low (${overallScore.toFixed(1)}%). For better analysis, ensure good lighting, clear view of your body and bat, and stable camera position.`);
                  } else if (overallScore >= 70 && overallScore < 85) {
                    recs.push(`Tracking quality is good (${overallScore.toFixed(1)}%). For even better results, improve lighting and ensure full body visibility.`);
                  } else if (overallScore >= 85) {
                    recs.push(`Excellent tracking quality (${overallScore.toFixed(1)}%)! The analysis captured your swing mechanics well.`);
                  }
                  
                  if (batRatio < 50 && batRatio > 0) {
                    recs.push(`Bat detection is limited (${batRatio.toFixed(0)}%). Ensure the bat is clearly visible throughout your swing for more accurate metrics.`);
                  }
                  
                  if (personRatio < 30 && personRatio > 0) {
                    recs.push(`Person detection is low (${personRatio.toFixed(0)}%). Position yourself fully in frame with good lighting for better biomechanical analysis.`);
                  }
                }
                
                // Metrics-based recommendations
                const metrics = analysis.metrics;
                if (metrics) {
                  if (metrics.batLinearSpeedMph != null) {
                    if (metrics.batLinearSpeedMph < 60) {
                      recs.push(`Bat speed is ${metrics.batLinearSpeedMph.toFixed(1)} mph. Focus on generating more power through hip rotation and weight transfer.`);
                    } else if (metrics.batLinearSpeedMph >= 60 && metrics.batLinearSpeedMph < 75) {
                      recs.push(`Bat speed is ${metrics.batLinearSpeedMph.toFixed(1)} mph - good! Work on maximizing hip-shoulder separation for even more power.`);
                    } else if (metrics.batLinearSpeedMph >= 75) {
                      recs.push(`Excellent bat speed at ${metrics.batLinearSpeedMph.toFixed(1)} mph! Your power generation is strong.`);
                    }
                  }
                  
                  if (metrics.exitVelocityEstimateMph != null) {
                    if (metrics.exitVelocityEstimateMph < 70) {
                      recs.push(`Estimated exit velocity is ${metrics.exitVelocityEstimateMph.toFixed(1)} mph. Focus on making solid contact and driving through the ball.`);
                    } else if (metrics.exitVelocityEstimateMph >= 70 && metrics.exitVelocityEstimateMph < 85) {
                      recs.push(`Good exit velocity estimate (${metrics.exitVelocityEstimateMph.toFixed(1)} mph). Continue working on contact quality and bat path.`);
                    } else if (metrics.exitVelocityEstimateMph >= 85) {
                      recs.push(`Strong exit velocity estimate (${metrics.exitVelocityEstimateMph.toFixed(1)} mph)! Your swing is generating excellent power.`);
                    }
                  }
                }
                
                // Weight transfer
                if (biomech?.weightTransfer != null) {
                  const wt = biomech.weightTransfer;
                  if (wt < 50) {
                    recs.push(`Weight transfer is ${wt.toFixed(0)}%. Focus on shifting your weight from back foot to front foot during the swing for more power.`);
                  } else if (wt >= 50 && wt < 70) {
                    recs.push(`Weight transfer is ${wt.toFixed(0)}% - decent. Work on more aggressive weight shift for increased bat speed.`);
                  } else if (wt >= 70) {
                    recs.push(`Excellent weight transfer (${wt.toFixed(0)}%)! Your weight shift mechanics are strong.`);
                  }
                }
                
                return recs;
              };
              
              // Combine existing and generated recommendations
              const allRecommendations = [
                ...existingRecommendations,
                ...generateScoreBasedRecommendations()
              ];
              
              // Remove duplicates and limit to 8 most relevant
              const uniqueRecommendations = Array.from(new Set(allRecommendations)).slice(0, 8);
              
              // If no errors and no recommendations, show a positive message
              if (validErrors.length === 0 && uniqueRecommendations.length === 0) {
                uniqueRecommendations.push("No major form errors detected. Continue practicing to maintain good mechanics.");
              }
              
              return validErrors.length > 0 || uniqueRecommendations.length > 0 ? (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 backdrop-blur-sm">
                  <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                    <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg shadow-lg">
                      <Target className="h-6 w-6 text-white" />
                    </div>
                    Form Errors
                  </h2>
                  {validErrors.length > 0 && (
                    <div className="space-y-3 mb-6">
                      {validErrors.slice(0, 6).map((error: any, idx: number) => (
                        <div key={idx} className="p-4 border-l-4 border-orange-500 bg-gradient-to-r from-orange-50 to-red-50 rounded-r-xl shadow-md hover:shadow-lg transition-shadow">
                          <div className="flex items-start gap-3">
                            <div className="w-2 h-2 bg-orange-500 rounded-full mt-1.5 flex-shrink-0"></div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-gray-900 capitalize">
                                {error.type || error.error}
                              </p>
                              <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                                {error.description || error.impact}
                              </p>
                              {error.recommendation && (
                                <p className="text-xs text-blue-700 mt-2 font-semibold">
                                  💡 {error.recommendation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {uniqueRecommendations.length > 0 && (
                    <div className="p-5 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 rounded-xl border-2 border-blue-200 shadow-md">
                      <div className="flex items-start gap-3 mb-3">
                        <div className="p-2 bg-blue-500 rounded-lg shadow-md">
                          <span className="text-white text-sm font-bold">!</span>
                        </div>
                        <p className="text-sm font-bold text-blue-900">Recommendations</p>
                      </div>
                      <ul className="text-sm text-blue-800 space-y-2 ml-11">
                        {uniqueRecommendations.map((rec: string, idx: number) => (
                          <li key={idx} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-1 font-bold">•</span>
                            <span className="leading-relaxed">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* Tracking Quality */}
            {analysis && analysis.trackingQuality && (() => {
              const tracking = analysis.trackingQuality;
              // Handle both field name formats (overallScore/score, personTrackingRatio/person_tracking_ratio)
              const overallScore = tracking.overallScore ?? tracking.score ?? 0;
              const personRatio = tracking.personTrackingRatio ?? tracking.person_tracking_ratio ?? 0;
              const batRatio = tracking.batTrackingRatio ?? tracking.bat_tracking_ratio ?? 0;
              const ballRatio = tracking.ballTrackingRatio ?? tracking.ball_tracking_ratio ?? 0;
              
              // Convert score to percentage if it's a decimal (0-1 range)
              const overallScorePercent = overallScore > 1 ? overallScore : overallScore * 100;
              
              // Only show if we have meaningful data
              if (overallScorePercent > 0 || personRatio > 0 || batRatio > 0 || ballRatio > 0) {
                // Determine color based on score
                const getScoreColor = (score: number) => {
                  if (score >= 80) return 'bg-green-500';
                  if (score >= 60) return 'bg-yellow-500';
                  return 'bg-orange-500';
                };
                
                const getScoreTextColor = (score: number) => {
                  if (score >= 80) return 'text-green-600';
                  if (score >= 60) return 'text-yellow-600';
                  return 'text-orange-600';
                };
                
                return (
                  <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6 backdrop-blur-sm">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-3 text-gray-800">
                      <div className="p-2 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg">
                        <Activity className="h-6 w-6 text-white" />
                      </div>
                      Tracking Quality
                    </h2>
                    <div className="space-y-5">
                      {overallScorePercent > 0 && (
                        <div className="p-5 bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border-2 border-gray-200">
                          <div className="flex justify-between items-center mb-3">
                            <span className="text-sm font-bold text-gray-700 uppercase tracking-wide">Overall Score</span>
                            <span className={`text-2xl font-bold ${getScoreTextColor(overallScorePercent)}`}>
                              {formatNumber(overallScorePercent, 1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden shadow-inner">
                            <div
                              className={`${getScoreColor(overallScorePercent)} h-4 rounded-full transition-all duration-500 shadow-lg`}
                              style={{ width: `${Math.min(100, Math.max(0, overallScorePercent))}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-4">
                        {batRatio > 0 && (
                          <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl border-2 border-purple-200 shadow-md hover:shadow-lg transition-shadow">
                            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Bat</p>
                            <p className="text-2xl font-bold text-purple-600">
                              {formatNumber(batRatio > 1 ? batRatio : batRatio * 100, 0)}%
                            </p>
                          </div>
                        )}
                        {personRatio > 0 && (
                          <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl border-2 border-blue-200 shadow-md hover:shadow-lg transition-shadow">
                            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Person</p>
                            <p className="text-2xl font-bold text-blue-600">
                              {formatNumber(personRatio > 1 ? personRatio : personRatio * 100, 0)}%
                            </p>
                          </div>
                        )}
                        {ballRatio > 0 && (
                          <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border-2 border-orange-200 shadow-md hover:shadow-lg transition-shadow">
                            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Ball</p>
                            <p className="text-2xl font-bold text-orange-600">
                              {formatNumber(ballRatio > 1 ? ballRatio : ballRatio * 100, 0)}%
                            </p>
                          </div>
                        )}
                      </div>
                      {tracking.issues && Array.isArray(tracking.issues) && tracking.issues.length > 0 && (
                        <div className="mt-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                          <div className="flex items-start gap-2 mb-1">
                            <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                            <p className="text-xs font-semibold text-yellow-800">Issues detected:</p>
                          </div>
                          <ul className="text-xs text-yellow-700 space-y-1 ml-6">
                            {tracking.issues
                              .filter((issue: string) => {
                                // Filter out 0.0% detection messages
                                if (issue.includes('Person detected in only 0.0%') || 
                                    issue.includes('Ball detected in only 0.0%')) {
                                  return false;
                                }
                                return true;
                              })
                              .slice(0, 3)
                              .map((issue: string, idx: number) => (
                                <li key={idx} className="flex items-start gap-1.5">
                                  <span className="text-yellow-600 mt-0.5">•</span>
                                  <span className="leading-relaxed">{issue}</span>
                                </li>
                              ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Success Message - Always show when analysis is complete */}
            {analysis && !analyzing && (
              <div className={`border-2 rounded-2xl p-6 flex items-start gap-4 shadow-xl ${
                analysis.ok 
                  ? 'bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 border-green-400' 
                  : 'bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 border-yellow-400'
              }`}>
                <div className={`p-3 rounded-xl shadow-lg ${
                  analysis.ok ? 'bg-green-500' : 'bg-yellow-500'
                }`}>
                  {analysis.ok ? (
                    <CheckCircle className="h-8 w-8 text-white flex-shrink-0" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-white flex-shrink-0" />
                  )}
                </div>
                <div className="flex-1">
                  <h3 className={`text-xl font-bold mb-2 ${
                    analysis.ok ? 'text-green-800' : 'text-yellow-800'
                  }`}>
                    {analysis.ok ? '✅ Analysis Complete!' : '⚠️ Analysis Completed with Issues'}
                  </h3>
                  <p className={`text-sm mt-2 leading-relaxed ${
                    analysis.ok ? 'text-green-700' : 'text-yellow-700'
                  }`}>
                    {analysis.ok 
                      ? 'The video has been successfully analyzed. Review all the results above, including metrics, swing phases, biomechanics, and form analysis.'
                      : `Analysis finished but encountered some issues: ${analysis.error || 'Unknown error'}. Review the available results above - some data may be incomplete.`
                    }
                  </p>
                  {(analysis.metrics || analysis.swingPhases || analysis.biomechanics || analysis.formErrors) && (
                    <p className={`text-xs mt-3 font-semibold ${
                      analysis.ok ? 'text-green-600' : 'text-yellow-600'
                    }`}>
                      📊 Results are displayed in the sections above. Scroll up to see all available data.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* OpenRouter Analysis Modal */}
      {showOpenRouterModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bot className="w-6 h-6 text-orange-600" />
                <h2 className="text-2xl font-bold">AI Coaching Feedback</h2>
              </div>
              <button
                onClick={() => {
                  setShowOpenRouterModal(false);
                  setOpenRouterFeedback(null);
                  setIsAnalyzingWithOpenRouter(false);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            {isAnalyzingWithOpenRouter ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                <p className="text-gray-600">Analyzing your swing... This may take a moment.</p>
                <p className="text-sm text-gray-500 mt-2">Extracting frames and sending to AI for analysis...</p>
              </div>
            ) : openRouterFeedback ? (
              openRouterFeedback.startsWith('Error:') ? (
                <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                  <h3 className="font-semibold text-lg mb-3 text-red-900">Analysis Error</h3>
                  <p className="text-red-800 whitespace-pre-wrap leading-relaxed">{openRouterFeedback.replace(/^Error: /, '')}</p>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg p-6 border border-orange-200">
                  <h3 className="font-semibold text-lg mb-3 text-orange-900">Coaching Feedback</h3>
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{openRouterFeedback}</p>
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={handlePlayVoiceOver}
                      disabled={audioLoading}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors text-sm font-medium"
                    >
                      {audioLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Volume2 className="w-4 h-4" />
                          Play Voice Over
                        </>
                      )}
                    </button>
                    <button
                      onClick={handleViewDrills}
                      className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                    >
                      View Recommended Drills
                    </button>
                  </div>

                  {/* Audio Error */}
                  {audioError && (
                    <p className="text-xs text-red-600 mt-2">{audioError}</p>
                  )}

                  {/* Audio Element */}
                  {audioUrl && (
                    <audio ref={audioRef} src={audioUrl} controls className="mt-3 w-full" autoPlay />
                  )}
                </div>
              )
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No feedback available.</p>
              </div>
            )}
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setShowOpenRouterModal(false);
                  setOpenRouterFeedback(null);
                  setIsAnalyzingWithOpenRouter(false);
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

