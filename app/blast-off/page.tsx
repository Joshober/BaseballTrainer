'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import { getStorageAdapter } from '@/lib/storage';
import CaptureUpload from '@/components/Mission/CaptureUpload';
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

  const parts: string[] = [];
  if (typeof launchAngle === 'number') parts.push(`Launch angle ${launchAngle.toFixed(1)}°`);
  if (typeof exitVelocity === 'number') parts.push(`Exit velocity ${exitVelocity.toFixed(0)} mph`);
  if (contactFrame !== null && contactFrame !== undefined) parts.push(`Contact detected at frame ${contactFrame}`);

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

export default function BlastOffPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        console.error('Blast-off: Missing auth user or token', {
          hasUser: !!authUser,
          hasToken: !!token,
          tokenLength: token?.length,
        });
        throw new Error('User not authenticated. Please sign in again.');
      }

      // Validate token format
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3 && tokenParts.length !== 5) {
        console.error('Blast-off: Invalid token format', {
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

      // 3a) Kick off analysis directly (best-effort) with timeout
      let analysisFound = false;
      try {
        const fd = new FormData();
        fd.append('video', file);
        fd.append('sessionId', createdSession.id);
        if (videoURL) fd.append('videoUrl', videoURL);
        fd.append('processingMode', 'full');
        fd.append('sampleRate', '1');
        fd.append('enableYOLO', 'true');
        fd.append('yoloConfidence', '0.5');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 min

        const analysisResp = await fetch('/api/pose/analyze-video', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let analysisResult: any;
        const contentType = analysisResp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          analysisResult = await analysisResp.json();
        } else {
          const text = await analysisResp.text();
          try {
            analysisResult = JSON.parse(text);
          } catch {
            analysisResult = {
              ok: false,
              error:
                text || analysisResp.statusText || `Analysis failed with status ${analysisResp.status}`,
            };
          }
        }

        if (!analysisResp.ok) {
          const errorMsg =
            analysisResult?.error ||
            analysisResult?.message ||
            analysisResp.statusText ||
            `Analysis failed with status ${analysisResp.status}`;
          throw new Error(errorMsg);
        }

        if (analysisResult?.ok) {
          setVideoAnalysis(analysisResult as VideoAnalysis);
          analysisFound = true;
        } else {
          const errorMsg = analysisResult?.error || analysisResult?.message || 'Analysis error';
          throw new Error(errorMsg);
        }
      } catch (err: any) {
        // Fall back to polling if direct analysis fails or times out
        let errorMessage =
          err?.name === 'AbortError'
            ? 'Analysis timed out. Please check back later.'
            : err?.message || 'Unknown analysis error';
        console.warn('Direct analysis failed, session created but analysis will continue in background:', errorMessage);
        // Don't show error to user - analysis will continue in background
        // The session was created successfully, so the user can check back later
      } finally {
        setIsAnalyzing(false);
      }
    } catch (err: any) {
      console.error('Video upload/analysis error:', err);
      setError(err?.message || 'Failed to process video. Please try again.');
      setIsAnalyzing(false);
    }
  };

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
            <span className="text-sm font-medium text-gray-700">Analyzing your swing…</span>
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
              <h1 className="text-3xl font-bold text-gray-900">Blast Off</h1>
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
                  Analyzing your swing footage… This may take up to a minute for longer videos.
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
                      <p className="text-sm text-blue-800 whitespace-pre-wrap">{openRouterFeedback}</p>
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
