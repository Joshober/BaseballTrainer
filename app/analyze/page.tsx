'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, Play, Pause, Loader2, AlertCircle, CheckCircle, TrendingUp, Activity, Target, Zap } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import type { VideoAnalysis } from '@/types/session';

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

      // Fetch the video from the URL
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.statusText}`);
      }

      const blob = await response.blob();
      
      // Get filename from URL or use default
      const urlParts = url.split('/');
      const filename = urlParts[urlParts.length - 1] || `video-${Date.now()}.mp4`;
      
      // Create a File object from the blob
      const file = new File([blob], filename, { type: blob.type || 'video/mp4' });
      
      setSelectedFile(file);
      setVideoUrl(URL.createObjectURL(file));
      
      // Automatically start analysis after video is loaded
      setTimeout(() => {
        analyzeVideo();
      }, 1000);
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

      // Create FormData for video upload
      const formData = new FormData();
      formData.append('video', selectedFile);
      
      // Optimize processing for faster analysis
      // Use sampled mode for videos longer than 10 seconds or if file size is large
      const videoDuration = videoRef.current?.duration || 0;
      const fileSizeMB = selectedFile.size / (1024 * 1024);
      
      // For videos longer than 10 seconds OR larger than 50MB, use optimized processing
      if (videoDuration > 10 || fileSizeMB > 50 || !videoDuration) {
        formData.append('processingMode', 'sampled');
        formData.append('sampleRate', '2'); // Process every 2nd frame for longer videos
        formData.append('maxFrames', '300'); // Limit to 300 frames max (~10 seconds at 30fps)
      } else {
        formData.append('processingMode', 'full');
        formData.append('sampleRate', '1');
      }
      
      formData.append('enableYOLO', 'true');
      formData.append('yoloConfidence', '0.5');

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
      
      const response = await fetch('/api/pose/analyze-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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
        } catch (e) {
          errorMessage = `Error HTTP ${response.status}: ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }

      const analysisData: VideoAnalysis = await response.json();
      
      // Filter out null/undefined values before setting state
      const cleanedAnalysis = removeNullValues(analysisData);
      setAnalysis(cleanedAnalysis);

      if (!analysisData.ok) {
        throw new Error(analysisData.error || 'Error in analysis');
      }
    } catch (error: any) {
      console.error('Video analysis error:', error);
      
      // Handle timeout/abort errors
      if (error.name === 'AbortError' || error.message?.includes('timeout') || error.message?.includes('demasiado tiempo')) {
        setError('Analysis is taking longer than expected. For long videos, try:\n\n• Use a shorter video (5-15 seconds)\n• Reduce video quality\n• Analysis will continue in the background');
      } else {
        setError(error.message || 'Error analyzing video');
      }
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
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Baseball Swing Analysis
          </h1>
          <p className="text-gray-600">
            Upload a video of your swing and get a complete analysis with pose, bat, ball detection and biomechanical metrics
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Video Upload and Player */}
          <div className="lg:col-span-2 space-y-6">
            {/* Video Upload Section */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Upload Video</h2>
              
              {!videoUrl ? (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-blue-500 transition-colors">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <label htmlFor="video-upload" className="cursor-pointer">
                    <span className="text-blue-600 font-medium">Click to upload</span>
                    <span className="text-gray-500"> or drag a video here</span>
                  </label>
                  <input
                    id="video-upload"
                    type="file"
                    accept="video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <p className="text-sm text-gray-500 mt-2">MP4, MOV, AVI, etc.</p>
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
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setSelectedFile(null);
                        setVideoUrl(null);
                        setAnalysis(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Change Video
                    </button>
                    {!analyzing && !analysis && (
                      <button
                        onClick={analyzeVideo}
                        className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 flex items-center justify-center gap-2"
                      >
                        <Activity className="h-4 w-4" />
                        Analyze Video
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
            {analysis && analysis.ok && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Video Information</h2>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <p className="text-sm text-gray-500">FPS</p>
                    <p className="text-lg font-semibold">{formatNumber(analysis.videoInfo?.fps)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Frames</p>
                    <p className="text-lg font-semibold">{analysis.videoInfo?.frameCount}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Duration</p>
                    <p className="text-lg font-semibold">{formatNumber(analysis.videoInfo?.duration)}s</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500">Resolution</p>
                    <p className="text-lg font-semibold">
                      {analysis.videoInfo?.width}x{analysis.videoInfo?.height}
                    </p>
                  </div>
                </div>
                {analysis.contactFrame !== null && analysis.contactFrame !== undefined && (
                  <div className="mt-4 p-3 bg-blue-50 rounded-md">
                    <p className="text-sm text-gray-600">
                      <span className="font-medium">Contact Frame:</span> {analysis.contactFrame}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column - Analysis Results */}
          <div className="space-y-6">
            {/* Metrics Card */}
            {analysis && analysis.ok && analysis.metrics && (() => {
              const metrics = analysis.metrics;
              const hasValidMetrics = metrics.batLinearSpeedMph != null || 
                                     metrics.batAngularVelocity != null || 
                                     metrics.launchAngle != null ||
                                     metrics.exitVelocityEstimateMph != null;
              
              return hasValidMetrics ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-blue-600" />
                    Swing Metrics
                  </h2>
                  <div className="space-y-4">
                    {metrics.batLinearSpeedMph != null && (
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-md">
                        <div>
                          <p className="text-sm text-gray-600">Bat Speed</p>
                          <p className="text-2xl font-bold text-blue-600">
                            {formatNumber(metrics.batLinearSpeedMph)} mph
                          </p>
                        </div>
                        <Zap className="h-8 w-8 text-blue-600" />
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-3">
                      {metrics.batAngularVelocity != null && (
                        <div className="p-3 bg-gray-50 rounded-md">
                          <p className="text-xs text-gray-500">Angular Velocity</p>
                          <p className="text-lg font-semibold">
                            {formatNumber(metrics.batAngularVelocity)}°/s
                          </p>
                        </div>
                      )}
                      {metrics.launchAngle != null && (
                        <div className="p-3 bg-gray-50 rounded-md">
                          <p className="text-xs text-gray-500">Launch Angle</p>
                          <p className="text-lg font-semibold">
                            {formatNumber(metrics.launchAngle)}°
                          </p>
                        </div>
                      )}
                    </div>
                    {metrics.exitVelocityEstimateMph != null && (
                      <div className="p-3 bg-green-50 rounded-md">
                        <p className="text-sm text-gray-600">Estimated Exit Velocity</p>
                        <p className="text-xl font-bold text-green-600">
                          {formatNumber(metrics.exitVelocityEstimateMph)} mph
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
                  </div>
                </div>
              ) : null;
            })()}

            {/* Swing Phases */}
            {analysis && analysis.ok && analysis.swingPhases && (() => {
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

            {/* Biomechanics */}
            {analysis && analysis.ok && analysis.biomechanics && (() => {
              const biomech = analysis.biomechanics;
              const hasData = biomech.maxHipRotation != null || 
                             biomech.maxShoulderRotation != null || 
                             biomech.weightTransfer != null ||
                             (biomech.rotation_angles && Object.keys(biomech.rotation_angles).length > 0) ||
                             (biomech.joint_angles && Object.keys(biomech.joint_angles).length > 0);
              
              return hasData ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4">Biomechanical Analysis</h2>
                  <div className="space-y-3">
                    {biomech.maxHipRotation != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Max Hip Rotation</span>
                        <span className="font-semibold">{formatNumber(biomech.maxHipRotation)}°</span>
                      </div>
                    )}
                    {biomech.maxShoulderRotation != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Max Shoulder Rotation</span>
                        <span className="font-semibold">{formatNumber(biomech.maxShoulderRotation)}°</span>
                      </div>
                    )}
                    {biomech.weightTransfer != null && (
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Weight Transfer</span>
                        <span className="font-semibold">{formatNumber(biomech.weightTransfer)}%</span>
                      </div>
                    )}
                    {biomech.rotation_angles && (
                      <>
                        {biomech.rotation_angles.hip_rotation != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Hip Rotation</span>
                            <span className="font-semibold">{formatNumber(biomech.rotation_angles.hip_rotation)}°</span>
                          </div>
                        )}
                        {biomech.rotation_angles.shoulder_rotation != null && (
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Shoulder Rotation</span>
                            <span className="font-semibold">{formatNumber(biomech.rotation_angles.shoulder_rotation)}°</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ) : null;
            })()}

            {/* Form Errors */}
            {analysis && analysis.ok && analysis.formErrors && (() => {
              const errors = Array.isArray(analysis.formErrors) 
                ? analysis.formErrors 
                : analysis.formErrors.errors || [];
              
              // Filter out null/undefined errors
              const validErrors = errors.filter((error: any) => 
                error && (error.type || error.error) && (error.description || error.impact)
              );
              
              const recommendations = Array.isArray(analysis.formErrors)
                ? []
                : analysis.formErrors.recommendations || [];
              
              return validErrors.length > 0 || recommendations.length > 0 ? (
                <div className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-600" />
                    Form Errors
                  </h2>
                  {validErrors.length > 0 && (
                    <div className="space-y-3">
                      {validErrors.slice(0, 5).map((error: any, idx: number) => (
                        <div key={idx} className="p-3 border-l-4 border-orange-500 bg-orange-50 rounded">
                          <p className="text-sm font-medium text-gray-900">{error.type || error.error}</p>
                          <p className="text-xs text-gray-600 mt-1">{error.description || error.impact}</p>
                          {error.recommendation && (
                            <p className="text-xs text-blue-600 mt-1">💡 {error.recommendation}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  {recommendations.length > 0 && (
                    <div className="mt-4 p-3 bg-blue-50 rounded-md">
                      <p className="text-sm font-medium text-blue-900 mb-2">Recommendations:</p>
                      <ul className="text-xs text-blue-700 space-y-1">
                        {recommendations.map((rec: string, idx: number) => (
                          <li key={idx}>• {rec}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : null;
            })()}

            {/* Tracking Quality */}
            {analysis && analysis.ok && analysis.trackingQuality && (() => {
              const tracking = analysis.trackingQuality;
              const overallScore = tracking.overallScore ?? tracking.score ?? 0;
              const personRatio = tracking.personTrackingRatio ?? 0;
              const batRatio = tracking.batTrackingRatio ?? 0;
              const ballRatio = tracking.ballTrackingRatio ?? 0;
              
              // Only show if we have meaningful data
              if (overallScore > 0 || personRatio > 0 || batRatio > 0 || ballRatio > 0) {
                return (
                  <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold mb-4">Tracking Quality</h2>
                    <div className="space-y-3">
                      {overallScore > 0 && (
                        <div>
                          <div className="flex justify-between mb-1">
                            <span className="text-sm text-gray-600">Overall Score</span>
                            <span className="text-sm font-semibold">
                              {formatNumber(overallScore * 100, 1)}%
                            </span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${Math.min(100, Math.max(0, overallScore * 100))}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {personRatio > 0 && (
                          <div>
                            <p className="text-gray-500">Person</p>
                            <p className="font-semibold">
                              {formatNumber(personRatio * 100, 0)}%
                            </p>
                          </div>
                        )}
                        {batRatio > 0 && (
                          <div>
                            <p className="text-gray-500">Bat</p>
                            <p className="font-semibold">
                              {formatNumber(batRatio * 100, 0)}%
                            </p>
                          </div>
                        )}
                        {ballRatio > 0 && (
                          <div>
                            <p className="text-gray-500">Ball</p>
                            <p className="font-semibold">
                              {formatNumber(ballRatio * 100, 0)}%
                            </p>
                          </div>
                        )}
                      </div>
                      {tracking.issues && Array.isArray(tracking.issues) && tracking.issues.length > 0 && (
                        <div className="mt-3 p-2 bg-yellow-50 rounded-md">
                          <p className="text-xs text-yellow-800 font-medium mb-1">Issues detected:</p>
                          <ul className="text-xs text-yellow-700 space-y-0.5">
                            {tracking.issues.slice(0, 3).map((issue: string, idx: number) => (
                              <li key={idx}>• {issue}</li>
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

            {/* Success Message */}
            {analysis && analysis.ok && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="text-sm font-medium text-green-800">Analysis Complete</h3>
                  <p className="text-sm text-green-600 mt-1">
                    The video has been successfully analyzed. Review the results above.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

