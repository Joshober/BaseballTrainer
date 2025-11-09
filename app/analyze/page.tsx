'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload,
  Play,
  Pause,
  Loader2,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Activity,
  Target,
  Zap,
  Sparkles,
  Bot,
  Calendar,
  Video,
} from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import type { VideoAnalysis } from '@/types/session';
import AnalysisAnimation from '@/components/Analysis/AnalysisAnimation';

interface SwingPhase {
  phase?: string;
  startFrame?: number;
  endFrame?: number;
  [key: string]: unknown;
}

interface TrackingQuality {
  overallScore?: number;
  score?: number;
  personTrackingRatio?: number;
  person_tracking_ratio?: number;
  batTrackingRatio?: number;
  bat_tracking_ratio?: number;
  ballTrackingRatio?: number;
  ball_tracking_ratio?: number;
  issues?: string[];
  [key: string]: unknown;
}

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

  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const openRouterModalRef = useRef<HTMLDivElement | null>(null);
  const openRouterCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<Element | null>(null);

  // Mark animation done once analysis finishes
  useEffect(() => {
    let mounted = true;
    let authChecked = false;

    const checkAuth = () => {
      if (!mounted || authChecked) return;

      const authUser = getAuthUser();
      const token = getAuthToken();

      if (!authUser || !token) {
        authChecked = true;
        setLoading(false);
        setTimeout(() => {
          if (mounted) router.push('/login');
        }, 100);
        return;
      }

      authChecked = true;
      setUser(authUser);
      setLoading(false);
    };

    checkAuth();

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

  useEffect(() => {
    const sessionIdParam = searchParams?.get('sessionId');
    if (!sessionIdParam || !user) return;

    const run = async () => {
      setGuarding(true);
      try {
        const token = getAuthToken();
        if (!token) {
          router.push('/login');
          return;
        }
        const resp = await fetch(
          `/api/video-analyses?sessionId=${encodeURIComponent(sessionIdParam)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data?.ok) {
            setAnalysis(data);
          } else {
            router.replace(`/videos?analysis=pending&sessionId=${encodeURIComponent(sessionIdParam)}`);
            return;
          }
        } else {
          router.replace('/videos');
          return;
        }
      } catch {
        router.replace('/videos');
        return;
      } finally {
        setGuarding(false);
      }
    };

    run();
  }, [searchParams, user, router]);

  useEffect(() => {
    const videoUrlParam = searchParams?.get('videoUrl');
    const sessionIdParam = searchParams?.get('sessionId');

    const loadFromSession = async (sessionId: string) => {
      try {
        const token = getAuthToken();
        if (!token) return;
        const [sessionRes, analysisRes] = await Promise.all([
          fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/video-analyses?sessionId=${encodeURIComponent(sessionId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (sessionRes.ok) {
          const session = await sessionRes.json();
          if (session?.videoURL && !videoUrl) {
            setVideoUrl(session.videoURL);
          }
          if (session?.videoAnalysis?.ok && !analysis) {
            setAnalysis(session.videoAnalysis);
          }
        }

        if (analysisRes.ok) {
          const stored = await analysisRes.json();
          if (stored?.ok) {
            setAnalysis(stored);
          }
        }
      } catch {
        // ignore
      }
    };

    if (sessionIdParam && user) {
      void loadFromSession(sessionIdParam);
    }

    if (videoUrlParam && user && !selectedFile && !loadingVideoFromUrl) {
      void loadVideoFromUrl(videoUrlParam);
    }
  }, [searchParams, user, selectedFile, loadingVideoFromUrl, videoUrl, analysis]);

  useEffect(() => {
    const sessionIdParam = searchParams?.get('sessionId');
    if (!user || !sessionIdParam) return;
    if (analysis?.ok) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const token = getAuthToken();
    if (!token) return;

    setPolling(true);
    interval = setInterval(async () => {
      try {
        const resp = await fetch(
          `/api/video-analyses?sessionId=${encodeURIComponent(sessionIdParam)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setLastCheckedAt(new Date());
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.ok) {
            setAnalysis(data);
            if (interval) {
              clearInterval(interval as unknown as number);
              interval = null;
              setPolling(false);
            }
          }
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      if (interval) clearInterval(interval as unknown as number);
    };
  }, [searchParams, user, analysis]);

  useEffect(() => {
    if (!showOpenRouterModal) {
      return;
    }

    previouslyFocusedElementRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      openRouterCloseButtonRef.current?.focus();
    }, 0);

    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setShowOpenRouterModal(false);
        setOpenRouterFeedback(null);
        setIsAnalyzingWithOpenRouter(false);
        return;
      }

      if (event.key !== 'Tab' || !openRouterModalRef.current) {
        return;
      }

      const focusable = Array.from(
        openRouterModalRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
      ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

      if (focusable.length === 0) {
        event.preventDefault();
        openRouterModalRef.current.focus();
        return;
      }

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (!activeElement) {
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const previouslyFocused = previouslyFocusedElementRef.current as HTMLElement | null;
      previouslyFocused?.focus();
      previouslyFocusedElementRef.current = null;
    };
  }, [showOpenRouterModal]);

  const loadVideoFromUrl = async (url: string) => {
    setLoadingVideoFromUrl(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      let videoPath = url;
      try {
        const urlObj = new URL(url);
        const pathMatch = urlObj.pathname.match(/\/api\/storage\/(.+)/);
        if (pathMatch) {
          videoPath = pathMatch[1];
        } else {
          videoPath = urlObj.pathname.substring(1);
        }
      } catch {
        const pathMatch = url.match(/\/api\/storage\/(.+)/);
        if (pathMatch) {
          videoPath = pathMatch[1];
        }
      }

      const response = await fetch(`/api/storage?path=${encodeURIComponent(videoPath)}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const blob = await response.blob();
      const pathParts = videoPath.split('/');
      const filename = pathParts[pathParts.length - 1] || `video-${Date.now()}.mp4`;
      const file = new File([blob], filename, { type: blob.type || 'video/mp4' });

      setSelectedFile(file);
      setVideoUrl(URL.createObjectURL(file));

      setTimeout(() => {
        void analyzeVideo();
      }, 1000);
    } catch (err: any) {
      console.error('Failed to load video from URL:', err);
      setError(`Error loading video: ${err.message || 'Unknown error'}`);
    } finally {
      setLoadingVideoFromUrl(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
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
      setError('Session ID is required for AI coaching analysis.');
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
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ sessionId: sessionIdParam }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Analysis failed' }));
        throw new Error(errorData.error || 'Failed to analyze video');
      }

      const data = await response.json();
      if (data.ok && data.feedback) {
        setOpenRouterFeedback(data.feedback);
      } else {
        throw new Error('No feedback received');
      }
    } catch (err: any) {
      console.error('OpenRouter analysis error:', err);
      setOpenRouterFeedback(`Error: ${err.message || 'Failed to analyze video. Please try again.'}`);
    } finally {
      setIsAnalyzingWithOpenRouter(false);
    }
  };

  const analyzeVideo = async () => {
    if (!selectedFile) return;

    setAnalyzing(true);
    setError(null);
    setProgress(0);

    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) {
        throw new Error('User not authenticated');
      }

      const formData = new FormData();
      formData.append('video', selectedFile);

      const videoUrlParam = searchParams?.get('videoUrl');
      if (videoUrlParam) {
        formData.append('videoUrl', videoUrlParam);
      }

      const videoDuration = videoRef.current?.duration || 0;
      const fileSizeMB = selectedFile.size / (1024 * 1024);

      if (videoDuration > 10 || fileSizeMB > 50 || !videoDuration) {
        formData.append('processingMode', 'sampled');
        formData.append('sampleRate', '2');
        formData.append('maxFrames', '300');
      } else {
        formData.append('processingMode', 'full');
        formData.append('sampleRate', '1');
      }

      formData.append('enableYOLO', 'true');
      formData.append('yoloConfidence', '0.5');

      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 600000);

      const response = await fetch('/api/pose/analyze-video', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      clearInterval(progressInterval);
      setProgress(100);

      if (!response.ok) {
        let errorMessage = 'Error analyzing video';
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (err) {
          errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const analysisData: VideoAnalysis = await response.json();
      const cleanedAnalysis = removeNullValues(analysisData);
      setAnalysis(cleanedAnalysis as VideoAnalysis);

      if (!analysisData.ok) {
        throw new Error(analysisData.error || 'Error in analysis');
      }
    } catch (err: any) {
      console.error('Video analysis error:', err);
      if (
        err.name === 'AbortError' ||
        err.message?.includes('timeout') ||
        err.message?.includes('demasiado tiempo')
      ) {
        setError(
          'Analysis is taking longer than expected. For long videos, try:\n\n• Use a shorter video (5-15 seconds)\n• Reduce video quality\n• Analysis will continue in the background'
        );
      } else {
        setError(err.message || 'Error analyzing video');
      }
    } finally {
      setAnalyzing(false);
      setProgress(0);
    }
  };

  const formatNumber = (num: number | null | undefined, decimals = 2) => {
    if (num === null || num === undefined) {
      return 'N/A';
    }

    if (Number.isNaN(Number(num)) || !Number.isFinite(Number(num))) {
      return 'N/A';
    }

    return Number(num).toFixed(decimals);
  };

  const removeNullValues = (obj: any): any => {
    if (obj === null || obj === undefined) {
      return undefined;
    }

    if (Array.isArray(obj)) {
      const filtered = obj
        .map((item) => removeNullValues(item))
        .filter((item) => item !== undefined);
      return filtered.length > 0 ? filtered : undefined;
    }

    if (typeof obj === 'object') {
      const cleaned: Record<string, unknown> = {};
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

  const extractTopRecommendations = (analysis: VideoAnalysis, count: number) => {
    const recommendations: string[] = [];
    if (analysis.metrics) {
      if (analysis.metrics.batLinearSpeedMph != null) {
        recommendations.push(`Increase bat speed to ${formatNumber(analysis.metrics.batLinearSpeedMph)} mph.`);
      }
      if (analysis.metrics.launchAngle != null) {
        recommendations.push(`Adjust launch angle to ${formatNumber(analysis.metrics.launchAngle)}°.`);
      }
      if (analysis.metrics.exitVelocityEstimateMph != null) {
        recommendations.push(`Increase exit velocity to ${formatNumber(analysis.metrics.exitVelocityEstimateMph)} mph.`);
      }
    }
    if (analysis.swingPhases) {
      const phases = Array.isArray(analysis.swingPhases)
        ? analysis.swingPhases
        : (analysis.swingPhases as { phases?: SwingPhase[] }).phases || [];
      const validPhases = phases.filter(
        (phase: SwingPhase) =>
          phase &&
          phase.phase &&
          phase.phase !== 'unknown' &&
          phase.startFrame != null &&
          phase.endFrame != null &&
          phase.startFrame !== phase.endFrame
      );
      if (validPhases.length > 0) {
        recommendations.push('Improve your swing mechanics.');
      }
    }
    if (analysis.trackingQuality) {
      const tracking = analysis.trackingQuality as TrackingQuality;
      if (tracking.overallScore != null && tracking.overallScore < 80) {
        recommendations.push('Improve your tracking quality.');
      }
    }
    if (analysis.formErrors) {
      const formErrors = analysis.formErrors as any;
      const errorsArray = Array.isArray(formErrors)
        ? formErrors
        : formErrors.errors || [];
      const recommendations = Array.isArray(formErrors)
        ? []
        : formErrors.recommendations || [];

      const validErrors = errorsArray.filter(
        (item: any) =>
          item && (item.type || item.error) && (item.description || item.impact || item.recommendation)
      );

      if (validErrors.length > 0) {
        recommendations.push('Address form errors.');
      }
    }
    return recommendations.slice(0, count);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-hidden="true" focusable="false" />
          <span className="sr-only">Loading swing analysis interface…</span>
        </div>
      </div>
    );
  }

  if (loadingVideoFromUrl || guarding) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-slate-700">
            {guarding
              ? 'Validating session...'
              : loadingVideoFromUrl
              ? 'Loading video...'
              : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <AnalysisAnimation isAnalyzing={analyzing} progress={progress} />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Baseball Swing Analysis</h1>
          <p className="text-slate-700">
            Upload a video of your swing and get a complete analysis with pose, bat, ball detection and
            biomechanical metrics.
          </p>
          {polling && (
            <p className="text-sm text-blue-600 mt-2">
              Checking for updated analysis...{' '}
              {lastCheckedAt && `Last checked: ${lastCheckedAt.toLocaleTimeString()}`}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Upload Video</h2>

              {!videoUrl ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
                  <Upload className="mx-auto h-12 w-12 text-slate-500 mb-4" aria-hidden="true" focusable="false" />
                  <label htmlFor="video-upload" className="cursor-pointer">
                    <span className="text-blue-600 font-medium">Click to upload</span>
                    <span className="text-slate-600"> or drag a video here</span>
                  </label>
                  <input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <p className="text-sm text-slate-600 mt-2">MP4, MOV, AVI, etc.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      className="w-full rounded-lg"
                      onTimeUpdate={(event) => {
                        const video = event.currentTarget;
                        if (analysis?.videoInfo) {
                          const frame = Math.floor(video.currentTime * analysis.videoInfo.fps);
                          setCurrentFrame(frame);
                        }
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setVideoUrl(null);
                        setAnalysis(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-slate-800 bg-slate-200 rounded-md hover:bg-slate-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                    >
                      Change Video
                    </button>
                    {!analyzing && !analysis && (
                      <button
                        onClick={() => void analyzeVideo()}
                        className="flex-1 min-w-[160px] px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                      >
                        <Activity className="h-4 w-4" aria-hidden="true" focusable="false" />
                        Analyze Video
                      </button>
                    )}
                    {videoRef.current && (
                      <button
                        onClick={() => {
                          const video = videoRef.current;
                          if (!video) return;
                          if (video.paused) {
                            video.play();
                          } else {
                            video.pause();
                          }
                        }}
                        className="px-4 py-2 text-sm font-medium text-slate-800 bg-slate-200 rounded-md hover:bg-slate-300 flex items-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                      >
                        {videoRef.current?.paused ? (
                          <Play className="h-4 w-4" aria-hidden="true" focusable="false" />
                        ) : (
                          <Pause className="h-4 w-4" aria-hidden="true" focusable="false" />
                        )}
                        {videoRef.current?.paused ? 'Play' : 'Pause'}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {analyzing && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-slate-800">Analyzing...</span>
                    <span className="text-sm text-slate-600">{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              )}

              {error && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-md flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" aria-hidden="true" focusable="false" />
                  <div>
                    <h3 className="text-sm font-medium text-red-800">Error</h3>
                    <p className="text-sm text-red-600 mt-1 whitespace-pre-line">{error}</p>
                  </div>
                </div>
              )}
            </div>

            {analysis && analysis.ok && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Play className="h-5 w-5 text-blue-600" />
                  Video Information
                </h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="p-4 bg-gradient-to-br from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                    <p className="text-xs font-medium text-blue-700 mb-1">FPS</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatNumber(analysis.videoInfo?.fps)}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-100">
                    <p className="text-xs font-medium text-purple-700 mb-1">Frames</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {analysis.videoInfo?.frameCount ?? 'N/A'}
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-100">
                    <p className="text-xs font-medium text-green-700 mb-1">Duration</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatNumber(analysis.videoInfo?.duration)}s
                    </p>
                  </div>
                  <div className="p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-100">
                    <p className="text-xs font-medium text-orange-700 mb-1">Resolution</p>
                    <p className="text-xl font-bold text-orange-600">
                      {analysis.videoInfo?.width}x{analysis.videoInfo?.height}
                    </p>
                  </div>
                </div>
                {analysis.contactFrame !== null && analysis.contactFrame !== undefined && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                    <p className="text-sm font-medium text-blue-900">
                      <span className="font-semibold">Contact Frame:</span>{' '}
                      <span className="text-lg font-bold text-blue-600">{analysis.contactFrame}</span>
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-6">
            {analysis && analysis.ok && analysis.metrics && (() => {
              const metrics = analysis.metrics;
              const hasValidMetrics =
                metrics.batLinearSpeedMph != null ||
                metrics.batAngularVelocity != null ||
                metrics.launchAngle != null ||
                metrics.exitVelocityEstimateMph != null;

              return hasValidMetrics ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" aria-hidden="true" focusable="false" />
                    Swing Metrics
                  </h2>
                  <div className="space-y-4">
                    {metrics.batLinearSpeedMph != null && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
                        <div>
                          <p className="text-sm text-slate-700">Bat Speed</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatNumber(metrics.batLinearSpeedMph)} mph
                          </p>
                        </div>
                        <Zap className="h-8 w-8 text-blue-600" aria-hidden="true" focusable="false" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {metrics.batAngularVelocity != null && (
                        <div className="p-3 bg-gray-50 rounded-md">
                          <p className="text-xs text-slate-600">Angular Velocity</p>
                          <p className="text-lg font-semibold">
                            {`${formatNumber(metrics.batAngularVelocity)}\u00B0/s`}
                          </p>
                        </div>
                      )}
                      {metrics.launchAngle != null && (
                        <div className="p-3 bg-gray-50 rounded-md">
                          <p className="text-xs text-slate-600">Launch Angle</p>
                          <p className="text-lg font-semibold">
                            {`${formatNumber(metrics.launchAngle)}\u00B0`}
                          </p>
                        </div>
                      )}
                    </div>
                    {metrics.exitVelocityEstimateMph != null && (
                      <div className="p-3 bg-green-50 rounded-md">
                        <p className="text-sm text-slate-700">Estimated Exit Velocity</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatNumber(metrics.exitVelocityEstimateMph)} mph
                        </p>
                      </div>
                    )}
                    {metrics.batLinearSpeedMph == null &&
                     metrics.batAngularVelocity == null &&
                     metrics.launchAngle == null && (
                      <div className="p-3 bg-yellow-50 rounded-md border border-yellow-200">
                        <p className="text-sm text-yellow-800">
                          ⚠️ Velocity metrics are not available because the bat was not detected in the video.
                        </p>
                      </div>
                    )}
                    <div className="space-y-4 rounded-2xl border border-slate-800/60 bg-slate-900/80 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-lg font-semibold text-white">Top Recommendations</h4>
                        <button
                          type="button"
                          onClick={() => setShowMoreInfo((prev) => !prev)}
                          className="text-sm font-medium text-blue-300 transition hover:text-blue-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                          aria-expanded={showMoreInfo}
                        >
                          {showMoreInfo ? 'Show less' : 'Show more'}
                        </button>
                      </div>

                      <ul className="space-y-3 text-sm text-slate-200">
                        {extractTopRecommendations(analysis, showMoreInfo ? 6 : 2).map((recommendation) => (
                          <li key={recommendation} className="flex gap-2">
                            <span className="text-blue-300">•</span>
                            <span>{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    {searchParams?.get('sessionId') && (
                      <button
                        type="button"
                        onClick={() => void handleOpenRouterAnalysis()}
                        className="w-full mt-4 flex items-center justify-center gap-2 px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                      >
                        <Sparkles className="w-5 h-5" aria-hidden="true" focusable="false" />
                        Get AI Coaching Feedback
                      </button>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {analysis && analysis.ok && analysis.swingPhases && (() => {
              const phasesSource = Array.isArray(analysis.swingPhases)
                ? analysis.swingPhases
                : (analysis.swingPhases as { phases?: SwingPhase[] }).phases || [];
              const validPhases = phasesSource.filter(
                (phase: SwingPhase) =>
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
                    {validPhases.slice(0, 5).map((phase, index) => (
                      <div key={index} className="p-2 bg-gray-50 rounded-md">
                        <p className="text-sm font-medium capitalize">{phase.phase}</p>
                        <p className="text-xs text-slate-600">
                          Frames {phase.startFrame}-{phase.endFrame}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null;
            })()}

            {analysis && analysis.ok && analysis.biomechanics && (() => {
              const biomech = analysis.biomechanics as any;
              const hasData =
                biomech.maxHipRotation != null ||
                biomech.maxShoulderRotation != null ||
                biomech.weightTransfer != null ||
                (biomech.rotation_angles && Object.keys(biomech.rotation_angles).length > 0) ||
                (biomech.joint_angles && Object.keys(biomech.joint_angles).length > 0);

              return hasData ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-purple-600" />
                    Biomechanical Analysis
                  </h2>
                  <div className="space-y-4">
                    {biomech.rotation_angles && (
                      <>
                        {biomech.rotation_angles.hip_rotation != null && (
                          <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-100">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-purple-500 rounded-full" />
                                <span className="text-sm font-medium text-slate-800">Hip Rotation</span>
                              </div>
                              <span className="text-lg font-bold text-purple-600">
                                {formatNumber(biomech.rotation_angles.hip_rotation)}°
                              </span>
                            </div>
                          </div>
                        )}
                        {biomech.rotation_angles.shoulder_rotation != null && (
                          <div className="p-3 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-100">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full" />
                                <span className="text-sm font-medium text-slate-800">Shoulder Rotation</span>
                              </div>
                              <span className="text-lg font-bold text-blue-600">
                                {formatNumber(biomech.rotation_angles.shoulder_rotation)}°
                              </span>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {biomech.maxHipRotation != null && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-700">Max Hip Rotation</span>
                          <span className="font-semibold text-gray-900">
                            {formatNumber(biomech.maxHipRotation)}°
                          </span>
                        </div>
                      </div>
                    )}
                    {biomech.maxShoulderRotation != null && (
                      <div className="p-3 bg-gray-50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-slate-700">Max Shoulder Rotation</span>
                          <span className="font-semibold text-gray-900">
                            {formatNumber(biomech.maxShoulderRotation)}°
                          </span>
                        </div>
                      </div>
                    )}
                    {biomech.weightTransfer != null && (
                      <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-slate-800">Weight Transfer</span>
                          <span className="text-lg font-bold text-green-600">
                            {formatNumber(biomech.weightTransfer)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {analysis && analysis.ok && analysis.formErrors && (() => {
              const formErrors = analysis.formErrors as any;
              const errorsArray = Array.isArray(formErrors)
                ? formErrors
                : formErrors.errors || [];
              const recommendations = Array.isArray(formErrors)
                ? []
                : formErrors.recommendations || [];

              const validErrors = errorsArray.filter(
                (item: any) =>
                  item && (item.type || item.error) && (item.description || item.impact || item.recommendation)
              );

              if (validErrors.length === 0 && recommendations.length === 0) {
                return null;
              }

              return (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-600" />
                    Form Errors
                  </h2>
                  {validErrors.length > 0 && (
                    <div className="space-y-3 mb-4">
                      {validErrors.slice(0, 6).map((item: any, index: number) => (
                        <div
                          key={index}
                          className="p-3 border-l-4 border-orange-500 bg-gradient-to-r from-orange-50 to-red-50 rounded-r-lg shadow-sm"
                        >
                          <div className="flex items-start gap-2">
                            <div className="w-1.5 h-1.5 bg-orange-500 rounded-full mt-1.5 flex-shrink-0" />
                            <div className="flex-1">
                              <p className="text-sm font-semibold text-gray-900 capitalize">
                                {item.type || item.error}
                              </p>
                              <p className="text-xs text-slate-700 mt-1 leading-relaxed">
                                {item.description || item.impact}
                              </p>
                              {item.recommendation && (
                                <p className="text-xs text-blue-700 mt-1.5 font-medium">
                                  💡 {item.recommendation}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {recommendations.length > 0 && (
                    <div className="mt-4 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                      <div className="flex items-start gap-2 mb-2">
                        <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-xs font-bold">!</span>
                        </div>
                        <p className="text-sm font-semibold text-blue-900">Recommendations</p>
                      </div>
                      <ul className="text-xs text-blue-800 space-y-1.5 ml-7">
                        {recommendations.map((rec: string, index: number) => (
                          <li key={index} className="flex items-start gap-2">
                            <span className="text-blue-500 mt-0.5">•</span>
                            <span className="leading-relaxed">{rec}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            {analysis && analysis.ok && analysis.trackingQuality && (() => {
              const tracking = analysis.trackingQuality as TrackingQuality;
              const overallScore = tracking.overallScore ?? tracking.score ?? 0;
              const personRatio = tracking.personTrackingRatio ?? tracking.person_tracking_ratio ?? 0;
              const batRatio = tracking.batTrackingRatio ?? tracking.bat_tracking_ratio ?? 0;
              const ballRatio = tracking.ballTrackingRatio ?? tracking.ball_tracking_ratio ?? 0;

              const overallPercent = overallScore > 1 ? overallScore : overallScore * 100;

              if (overallPercent <= 0 && personRatio <= 0 && batRatio <= 0 && ballRatio <= 0) {
                return null;
              }

              const getScoreColor = (score: number) => {
                if (score >= 80) return 'bg-green-500';
                if (score >= 60) return 'bg-yellow-500';
                return 'bg-orange-500';
              };

              const getScoreText = (score: number) => {
                if (score >= 80) return 'text-green-600';
                if (score >= 60) return 'text-yellow-600';
                return 'text-orange-600';
              };

              const formatRatio = (ratio: number) => formatNumber(ratio > 1 ? ratio : ratio * 100, 0);

              return (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Activity className="h-5 w-5 text-indigo-600" />
                    Tracking Quality
                  </h2>
                  <div className="space-y-4">
                    {overallPercent > 0 && (
                      <div>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium text-slate-800">Overall Score</span>
                          <span className={`text-lg font-bold ${getScoreText(overallPercent)}`}>
                            {formatNumber(overallPercent, 1)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                          <div
                            className={`${getScoreColor(overallPercent)} h-3 rounded-full transition-all duration-500 shadow-sm`}
                            style={{ width: `${Math.min(100, Math.max(0, overallPercent))}%` }}
                          />
                        </div>
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-3">
                      {personRatio > 0 && (
                        <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                          <p className="text-xs text-slate-600 mb-1">Person</p>
                          <p className="text-lg font-bold text-blue-600">{formatRatio(personRatio)}%</p>
                        </div>
                      )}
                      {batRatio > 0 && (
                        <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                          <p className="text-xs text-slate-600 mb-1">Bat</p>
                          <p className="text-lg font-bold text-purple-600">{formatRatio(batRatio)}%</p>
                        </div>
                      )}
                      {ballRatio > 0 && (
                        <div className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                          <p className="text-xs text-slate-600 mb-1">Ball</p>
                          <p className="text-lg font-bold text-orange-600">{formatRatio(ballRatio)}%</p>
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
                          {tracking.issues.slice(0, 3).map((issue, index) => (
                            <li key={index} className="flex items-start gap-1.5">
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
            })()}

            {analysis && analysis.ok && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" aria-hidden="true" focusable="false" />
                <div>
                  <h3 className="text-sm font-medium text-green-800">Analysis Complete</h3>
                  <p className="text-sm text-green-600 mt-1">
                    The video has been successfully analyzed. Review the results above.
                  </p>
                  {analysis.contactFrame != null && (
                    <p className="text-xs text-green-700 mt-2">
                      Current frame: {currentFrame} (contact at {analysis.contactFrame})
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showOpenRouterModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            ref={openRouterModalRef}
            className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="open-router-modal-title"
            tabIndex={-1}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Bot className="w-6 h-6 text-orange-600" aria-hidden="true" focusable="false" />
                <h2 className="text-2xl font-bold" id="open-router-modal-title">AI Coaching Feedback</h2>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowOpenRouterModal(false);
                  setOpenRouterFeedback(null);
                  setIsAnalyzingWithOpenRouter(false);
                }}
                ref={openRouterCloseButtonRef}
                className="text-slate-600 hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
              >
                ✕
              </button>
            </div>

            {isAnalyzingWithOpenRouter ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4" />
                <p className="text-slate-700">Analyzing your swing... This may take a moment.</p>
                <p className="text-sm text-slate-600 mt-2">Extracting frames and sending to AI for analysis...</p>
              </div>
            ) : openRouterFeedback ? (
              openRouterFeedback.startsWith('Error:') ? (
                <div className="bg-red-50 rounded-lg p-6 border border-red-200">
                  <h3 className="font-semibold text-lg mb-3 text-red-900">Analysis Error</h3>
                  <p className="text-red-800 whitespace-pre-wrap leading-relaxed">
                    {openRouterFeedback.replace(/^Error: /, '')}
                  </p>
                </div>
              ) : (
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg p-6 border border-orange-200">
                  <h3 className="font-semibold text-lg mb-3 text-orange-900">Coaching Feedback</h3>
                  <p className="text-slate-900 whitespace-pre-wrap leading-relaxed">{openRouterFeedback}</p>
                </div>
              )
            ) : (
              <div className="text-center py-8 text-slate-600">
                <p>No feedback available.</p>
              </div>
            )}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowOpenRouterModal(false);
                  setOpenRouterFeedback(null);
                  setIsAnalyzingWithOpenRouter(false);
                }}
                className="px-4 py-2 bg-slate-200 text-slate-800 rounded-lg hover:bg-slate-300 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
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
