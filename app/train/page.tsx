'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, ArrowLeft, AlertCircle, Volume2 } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import { getStorageAdapter } from '@/lib/storage';
import CaptureUpload from '@/components/Mission/CaptureUpload';
import { generateDrillNarration } from '@/lib/services/elevenlabs';
import type { VideoAnalysis } from '@/types/session';

const RECOMMENDATIONS_LIMIT = 2;

function formatBlurb(analysis: VideoAnalysis): string {
  const metrics = (analysis as any).metrics || {};
  const launchAngle = typeof metrics.launchAngle === 'number' ? metrics.launchAngle : undefined;
  const exitVelocity = typeof metrics.exitVelocityEstimateMph === 'number'
    ? metrics.exitVelocityEstimateMph
    : typeof metrics.batLinearSpeedMph === 'number'
      ? metrics.batLinearSpeedMph
      : undefined;
  const contactFrame = (analysis as any).contact?.frame ?? (analysis as any).contactFrame ?? null;
  const hasOpenRouterFeedback = !!(analysis as any)?.openRouterFeedback;

  const parts: string[] = [];
  if (typeof launchAngle === 'number') parts.push(`Launch angle ${launchAngle.toFixed(1)}°`);
  if (typeof exitVelocity === 'number') parts.push(`Exit velocity ${exitVelocity.toFixed(0)} mph`);
  if (contactFrame !== null && contactFrame !== undefined) parts.push(`Contact detected at frame ${contactFrame}`);

  // If we only have OpenRouter feedback (fast coaching), show a different message
  if (parts.length === 0 && hasOpenRouterFeedback) {
    return 'AI coaching feedback ready! Full analysis is running in the background and will be available shortly.';
  }
  
  if (parts.length === 0) {
    return 'Analysis completed. Review the recommendations below to keep refining your swing.';
  }
  return `${parts.join(', ')}.`;
}

function extractAllRecommendations(analysis: VideoAnalysis): string[] {
  const recommendations: string[] = [];
  const openRouterFeedback: string | null = (analysis as any)?.openRouterFeedback || null;
  
  const formAnalysis: any = (analysis as any).formAnalysis;
  if (formAnalysis && Array.isArray(formAnalysis.feedback)) {
    recommendations.push(
      ...formAnalysis.feedback
        .filter((item: unknown): item is string => typeof item === 'string')
        .map((item: string) => item.trim())
        // Exclude OpenRouter feedback to avoid duplication
        .filter((item: string) => !openRouterFeedback || item !== openRouterFeedback.trim()),
    );
  }

  const formErrors: any = (analysis as any).formErrors;
  if (formErrors) {
    if (Array.isArray(formErrors.recommendations)) {
      recommendations.push(
        ...formErrors.recommendations
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim())
          // Exclude OpenRouter feedback to avoid duplication
          .filter((item: string) => !openRouterFeedback || item !== openRouterFeedback.trim()),
      );
    }
    const errorEntries = Array.isArray(formErrors.errors) ? formErrors.errors : undefined;
    if (errorEntries) {
      recommendations.push(
        ...errorEntries
          .map((entry: any) => entry?.recommendation || entry?.description)
          .filter((item: unknown): item is string => typeof item === 'string')
          .map((item: string) => item.trim())
          // Exclude OpenRouter feedback to avoid duplication
          .filter((item: string) => !openRouterFeedback || item !== openRouterFeedback.trim()),
      );
    }
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const rec of recommendations) {
    if (!rec) continue;
    if (!seen.has(rec)) {
      seen.add(rec);
      unique.push(rec);
    }
  }
  return unique;
}

function extractTopRecommendations(analysis: VideoAnalysis, limit: number = RECOMMENDATIONS_LIMIT): string[] {
  return extractAllRecommendations(analysis).slice(0, limit);
}

export default function TrainPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
  };

  const handleVideoSelect = async (file: File) => {
    setSelectedFile(file);
    setError(null);
    setVideoAnalysis(null);
    setIsAnalyzing(true);

    try {
      const authUser = getAuthUser();
      const token = getAuthToken();

      if (!authUser || !token) {
        console.error('Train: Missing auth user or token', {
          hasUser: !!authUser,
          hasToken: !!token,
          tokenLength: token?.length,
        });
        throw new Error('User not authenticated. Please sign in again.');
      }

      // Validate token format
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3 && tokenParts.length !== 5) {
        console.error('Train: Invalid token format', {
          parts: tokenParts.length,
          tokenPreview: token.substring(0, 20) + '...',
        });
        throw new Error('Invalid authentication token. Please sign in again.');
      }

      // 1) Upload to storage
      const storage = getStorageAdapter();
      const sessionId = crypto.randomUUID();
      const uid = authUser.sub;
      const ext = file.type.includes('mp4')
        ? 'mp4'
        : file.type.includes('webm')
        ? 'webm'
        : 'mp4';
      const videoPath = `videos/${uid}/${sessionId}.${ext}`;
      const videoURL = await storage.uploadFile(videoPath, file);

      // 2) Create session
      const createResp = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: authUser.sub,
          teamId: 'default',
          photoPath: '',
          photoURL: '',
          videoPath,
          videoURL,
          metrics: {
            launchAngleEst: 28,
            attackAngleEst: null,
            exitVelocity: 0,
            confidence: 0,
          },
          game: { distanceFt: 0, zone: 'unknown', milestone: 'none', progressToNext: 0 },
          label: 'needs_work' as const,
        }),
      });

      if (!createResp.ok) {
        const errorData = await createResp.json().catch(() => ({ error: 'Failed to create session' }));
        throw new Error(errorData.error || errorData.message || 'Failed to create session');
      }
      const createdSession = await createResp.json();

      // 3) Get fast OpenRouter coaching feedback (uses video from storage)
      // This is much faster - only extracts 3 frames and sends to OpenRouter
      let feedbackReceived = false;
      try {
        console.log('[Train] Requesting OpenRouter feedback for session:', createdSession.id);
        
        const openRouterResp = await fetch('/api/openrouter/analyze-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            sessionId: createdSession.id,
          }),
        });

        if (openRouterResp.ok) {
          const openRouterResult = await openRouterResp.json();
          
          if (openRouterResult.ok && openRouterResult.feedback) {
            // Create a minimal analysis result with just OpenRouter feedback
            // This allows the UI to show coaching feedback immediately
            setVideoAnalysis({
              ok: true,
              openRouterFeedback: openRouterResult.feedback,
              framesAnalyzed: openRouterResult.framesAnalyzed || 0,
              totalFrames: openRouterResult.totalFrames || 0,
            } as VideoAnalysis);
            feedbackReceived = true;
            console.log('[Train] OpenRouter feedback received:', openRouterResult.feedback.substring(0, 100));
            // Don't redirect - stay on page and show buttons
          } else {
            console.warn('[Train] OpenRouter returned no feedback:', openRouterResult);
          }
        } else {
          const errorData = await openRouterResp.json().catch(() => ({}));
          console.warn('[Train] OpenRouter request failed:', errorData);
          // Don't throw - we'll run full analysis in background
        }
      } catch (err: any) {
        console.warn('[Train] OpenRouter feedback failed (non-fatal):', err.message);
        // Don't throw - continue with background analysis
      }

      // Only stop analyzing spinner after feedback is set and rendered
      // This ensures the spinner continues until the message is ready to display
      if (feedbackReceived) {
        // Wait for React to process the state update and render the feedback
        // Give enough time for the state update, re-render, and DOM update to complete
        // This ensures the spinner continues until the message is actually visible
        await new Promise(resolve => setTimeout(resolve, 400));
      }
      setIsAnalyzing(false);

      // 4) Kick off full analysis in background (non-blocking)
      // This will update the session with full analysis results later
      fetch('/api/pose/analyze-video', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: (() => {
          const fd = new FormData();
          fd.append('video', file);
          fd.append('sessionId', createdSession.id);
          if (videoURL) fd.append('videoUrl', videoURL);
          fd.append('processingMode', 'full');
          fd.append('sampleRate', '1');
          fd.append('enableYOLO', 'true');
          fd.append('yoloConfidence', '0.5');
          return fd;
        })(),
      }).catch((err) => {
        console.warn('[Train] Background analysis failed (non-fatal):', err.message);
      });
    } catch (err: any) {
      console.error('Video upload/analysis error:', err);
      setError(err?.message || 'Failed to process video. Please try again.');
      setIsAnalyzing(false);
    }
  };

  const handlePlayVoiceOver = async () => {
    const openRouterFeedback = (videoAnalysis as any)?.openRouterFeedback;
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
      
      // Audio will be available for playback via the audio element
    } catch (err: any) {
      console.error('Error generating voice over:', err);
      setAudioError(err.message || 'Failed to generate voice over');
    } finally {
      setAudioLoading(false);
    }
  };

  const handleViewDrills = () => {
    const openRouterFeedback = (videoAnalysis as any)?.openRouterFeedback;
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const openRouterFeedback = (videoAnalysis as any)?.openRouterFeedback || null;
  const recommendations = videoAnalysis ? extractTopRecommendations(videoAnalysis) : [];

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 via-white to-purple-50">
      {isAnalyzing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="rounded-xl bg-white px-6 py-4 shadow-lg flex items-center gap-3">
            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Getting coaching feedback…</span>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Rocket className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Train</h1>
            </div>
          </div>

          <div className="space-y-8">
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Record Your Swing</h2>
              <CaptureUpload
                onImageSelect={handleImageSelect}
                onVideoSelect={handleVideoSelect}
                onModeChange={() => {}}
                mode="video"
              />
            </section>

            {error && (
              <section className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-red-900 mb-1">Error</h3>
                    <p className="text-sm text-red-800">{error}</p>
                  </div>
                </div>
              </section>
            )}

            {selectedFile && isAnalyzing && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center text-sm text-gray-600">
                  Getting AI coaching feedback from your swing footage… This should only take a few seconds.
                </div>
              </section>
            )}

            {videoAnalysis && videoAnalysis.ok && (
              <div className="space-y-6">
                <section className="bg-white rounded-lg shadow-md p-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-4">Analysis Results</h2>
                  <p className="text-gray-700 mb-4">{formatBlurb(videoAnalysis)}</p>

                  {openRouterFeedback ? (
                    <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                      <h3 className="font-semibold text-blue-900 mb-2">AI Coaching Feedback</h3>
                      <p className="text-sm text-blue-800 whitespace-pre-wrap mb-4">{openRouterFeedback}</p>
                      
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
                  ) : recommendations.length > 0 ? (
                    <div className="mt-4">
                      <h3 className="font-semibold text-gray-900 mb-2">Recommendations</h3>
                      <ul className="list-disc list-inside space-y-2">
                        {recommendations.map((rec, idx) => (
                          <li key={idx} className="text-sm text-gray-700">
                            {rec}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </section>
              </div>
            )}

            {selectedFile && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Selected video</h3>
                <div className="aspect-video bg-black rounded-lg overflow-hidden">
                  <video src={URL.createObjectURL(selectedFile)} controls className="w-full h-full object-cover" />
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

