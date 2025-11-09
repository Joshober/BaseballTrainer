'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, ArrowLeft, Bot, AlertCircle } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import { getStorageAdapter } from '@/lib/storage';
import CaptureUpload from '@/components/Mission/CaptureUpload';

type VideoAnalysis = {
  ok: boolean;
  error?: string;
  metrics?: {
    batLinearSpeedMph?: number;
    exitVelocityEstimateMph?: number;
    launchAngle?: number;
  };
  formAnalysis?: { feedback?: string[] };
  formErrors?: {
    recommendations?: string[];
    errors?: Array<{ recommendation?: string; description?: string }>;
  };
  contact?: { frame?: number };
  contactFrame?: number;
  [k: string]: any;
};

export default function BlastOffPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'photo' | 'video' | 'manual'>('video');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRouterFeedback, setOpenRouterFeedback] = useState<string | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);

  const [isAnimationDone, setIsAnimationDone] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Mark animation done once analysis finishes
  useEffect(() => {
    if (!isAnalyzing && videoAnalysis) {
      setIsAnimationDone(true);
    }
  }, [isAnalyzing, videoAnalysis]);

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

  function formatBlurb(analysis: VideoAnalysis): string {
    const metrics = (analysis as any).metrics || {};
    const launchAngle = typeof metrics.launchAngle === 'number' ? metrics.launchAngle : undefined;
    const exitV =
      typeof metrics.exitVelocityEstimateMph === 'number'
        ? metrics.exitVelocityEstimateMph
        : typeof metrics.batLinearSpeedMph === 'number'
        ? metrics.batLinearSpeedMph
        : undefined;
    const contactFrame =
      (analysis as any).contact?.frame ?? (analysis as any).contactFrame ?? null;

    const pieces: string[] = [];
    if (typeof launchAngle === 'number') pieces.push(`Launch angle ${launchAngle.toFixed(1)}°`);
    if (typeof exitV === 'number') pieces.push(`exit velocity ${exitV.toFixed(0)} mph`);
    if (contactFrame !== null && contactFrame !== undefined)
      pieces.push(`contact at frame ${contactFrame}`);
    if (pieces.length === 0)
      return 'Analysis completed. Review recommendations below to improve your swing.';
    return `${pieces.join(', ')}.`;
  }

  function extractAllRecommendations(analysis: VideoAnalysis): string[] {
    const recs: string[] = [];
    const formAnalysis: any = (analysis as any).formAnalysis;
    if (formAnalysis && Array.isArray(formAnalysis.feedback)) {
      for (const feedback of formAnalysis.feedback) {
        if (typeof feedback === 'string') recs.push(feedback);
      }
    }
    const formErrors: any = (analysis as any).formErrors;
    if (formErrors) {
      if (Array.isArray(formErrors.recommendations)) {
        for (const recommendation of formErrors.recommendations) {
          if (typeof recommendation === 'string') recs.push(recommendation);
        }
      }
      const errorsArray = Array.isArray(formErrors.errors) ? formErrors.errors : undefined;
      if (errorsArray) {
        for (const entry of errorsArray) {
          if (entry?.recommendation) recs.push(String(entry.recommendation));
          else if (entry?.description) recs.push(String(entry.description));
        }
      }
    }
    const seen = new Set<string>();
    return recs.filter((recommendation) => {
      const key = recommendation.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function extractTopRecommendations(analysis: VideoAnalysis, limit: number = 2): string[] {
    const all = extractAllRecommendations(analysis);
    return all.slice(0, limit);
  }

  const handleVideoSelect = async (file: File) => {
    setSelectedFile(file);
    setOpenRouterFeedback(null);
    setError(null);
    setVideoAnalysis(null);
    setIsAnalyzing(true);
    setIsAnimationDone(false);

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
          tokenPreview: `${token.substring(0, 20)}...`,
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
        const errorData = await createResp.json().catch(() => ({
          error: 'Failed to create session',
        }));
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
                text ||
                analysisResp.statusText ||
                `Analysis failed with status ${analysisResp.status}`,
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
        // Fall back to polling
        const errorMessage =
          err?.name === 'AbortError'
            ? 'Analysis timed out.'
            : err?.message || 'Unknown analysis error';
        console.warn('Direct analysis failed, falling back to polling:', errorMessage);

        const sid = createdSession.id as string;
        const start = Date.now();
        const maxWait = 5 * 60 * 1000; // 5 minutes
        const pollInterval = 5000; // 5 seconds
        let foundAnalysis = false;

        while (!foundAnalysis && Date.now() - start < maxWait) {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));

          try {
            const pollResp = await fetch(`/api/video-analyses/${sid}`, {
              method: 'GET',
              headers: { Authorization: `Bearer ${token}` },
            });

            if (pollResp.ok) {
              const pollData = await pollResp.json();
              if (pollData?.ok) {
                setVideoAnalysis(pollData as VideoAnalysis);
                foundAnalysis = true;
                analysisFound = true;
                break;
              }
            } else if (pollResp.status === 404) {
              continue;
            } else {
              const pollError = await pollResp.json().catch(() => ({}));
              console.warn('Polling error:', pollResp.status, pollError);
            }
          } catch (pollError) {
            console.warn('Polling attempt failed:', pollError);
          }
        }

        if (!foundAnalysis) {
          console.warn('Analysis polling timed out');
        }
      }

      if (!analysisFound) {
        setOpenRouterFeedback(
          "We're still analyzing your swing. You can check back later for detailed results."
        );
      }
    } catch (err: any) {
      const message =
        err?.message ||
        err?.error ||
        err?.toString() ||
        'An unexpected error occurred during analysis.';
      console.error('Blast off analysis error:', err);
      setError(message);
    } finally {
      setIsAnalyzing(false);
      if (resultsRef.current) {
        resultsRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-100">
        <div role="status" aria-live="polite" className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" aria-hidden="true" focusable="false" />
          <span className="sr-only">Loading blast analysis workspace…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 py-12 md:px-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded-full border border-slate-800 bg-slate-900/60 p-3 text-slate-300 transition hover:bg-slate-900"
            aria-label="Back to dashboard"
          >
            <ArrowLeft className="h-5 w-5" aria-hidden="true" focusable="false" />
          </button>
          <div>
            <p className="text-sm font-medium uppercase tracking-wide text-slate-400">Blast Motion</p>
            <h1 className="mt-1 text-3xl font-bold text-white md:text-4xl">Upload Your Swing</h1>
            <p className="mt-2 text-base text-slate-400 md:text-lg">
              We'll analyze your video to find insights and recommend drills for improvement.
            </p>
            {user?.name && (
              <p className="mt-1 text-sm text-slate-500">Ready for launch, {user.name.split(' ')[0]}!</p>
            )}
          </div>
        </div>

        <CaptureUpload
          mode={mode}
          onModeChange={setMode}
          onImageSelect={handleImageSelect}
          onVideoSelect={handleVideoSelect}
          processing={isAnalyzing}
        />

        {(error || openRouterFeedback || videoAnalysis || selectedFile) && (
          <section
            ref={resultsRef}
            className="relative overflow-hidden rounded-3xl border border-slate-900/50 bg-gradient-to-br from-slate-900 to-slate-950 p-6 shadow-xl md:p-8"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-300">
                <Rocket className="h-6 w-6" aria-hidden="true" focusable="false" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-wide text-blue-300">Mission Update</p>
                <h2 className="text-2xl font-semibold text-white md:text-3xl">Swing Analysis Report</h2>
              </div>
            </div>

            {selectedFile && (
              <div className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/80 p-4 text-sm text-slate-300">
                <p className="font-medium text-slate-200">Selected file</p>
                <p className="mt-1 break-all">{selectedFile.name}</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="mt-6 flex items-center gap-3 rounded-2xl border border-blue-900/40 bg-blue-500/5 p-4 text-blue-200" role="status" aria-live="polite">
                <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" focusable="false" />
                <p>Running full baseball AI analysis. This may take a minute…</p>
              </div>
            )}

            {error && (
              <div className="mt-6 flex items-start gap-3 rounded-2xl border border-red-900/40 bg-red-500/10 p-4 text-red-200">
                <AlertCircle className="mt-1 h-5 w-5" aria-hidden="true" focusable="false" />
                <div>
                  <p className="text-sm font-semibold text-red-200">Analysis Error</p>
                  <p className="mt-1 text-sm text-red-100/80">{error}</p>
                  <p className="mt-2 text-xs text-red-100/60">
                    Try again with a well-lit video (around 5 seconds, show full body) and ensure your swing is clearly
                    visible.
                  </p>
                </div>
              </div>
            )}

            {openRouterFeedback && (
              <div className="mt-6 rounded-2xl border border-slate-800/60 bg-slate-900/80 p-5">
                <div className="flex items-baseline gap-3">
                  <Bot className="mt-1 h-5 w-5 text-purple-300" aria-hidden="true" focusable="false" />
                  <p className="text-sm font-medium text-purple-200">Baseball AI Assistant</p>
                </div>
                <p className="mt-3 whitespace-pre-line text-sm text-slate-200/90">{openRouterFeedback}</p>
              </div>
            )}

            {videoAnalysis && (
              <div className="mt-8 space-y-6">
                {videoAnalysis.ok ? (
                  <>
                    <div className="rounded-2xl border border-slate-800/50 bg-slate-900/90 p-6">
                      <p className="text-sm font-medium uppercase tracking-wide text-blue-300">Overview</p>
                      <h3 className="mt-2 text-lg font-semibold text-white md:text-xl">
                        {isAnimationDone ? 'Analysis complete' : 'Processing in progress'}
                      </h3>
                      <p className="mt-2 text-sm text-slate-300 md:text-base">{formatBlurb(videoAnalysis)}</p>
                    </div>

                    {videoAnalysis.metrics && (
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Bat Speed</p>
                          <p className="mt-2 text-2xl font-bold text-white">
                            {videoAnalysis.metrics.batLinearSpeedMph?.toFixed(1) ?? '—'} mph
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Exit Velocity</p>
                          <p className="mt-2 text-2xl font-bold text-white">
                            {videoAnalysis.metrics.exitVelocityEstimateMph?.toFixed(1) ?? '—'} mph
                          </p>
                        </div>
                        <div className="rounded-2xl border border-slate-800/60 bg-slate-900/80 p-4">
                          <p className="text-xs uppercase tracking-wide text-slate-400">Launch Angle</p>
                          <p className="mt-2 text-2xl font-bold text-white">
                            {`${videoAnalysis.metrics.launchAngle?.toFixed(1) ?? '—'}\u00B0`}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4 rounded-2xl border border-slate-800/60 bg-slate-900/80 p-6">
                      <div className="flex items-center justify-between gap-4">
                        <h4 className="text-lg font-semibold text-white">Top Recommendations</h4>
                        <button
                          type="button"
                          onClick={() => setShowMoreInfo((prev) => !prev)}
                          className="text-sm font-medium text-blue-300 transition hover:text-blue-200"
                          aria-expanded={showMoreInfo}
                        >
                          {showMoreInfo ? 'Show less' : 'Show more'}
                        </button>
                      </div>

                      <ul className="space-y-3 text-sm text-slate-200">
                        {extractTopRecommendations(videoAnalysis, showMoreInfo ? 6 : 2).map((recommendation) => (
                          <li key={recommendation} className="flex gap-2">
                            <span className="text-blue-300">•</span>
                            <span>{recommendation}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </>
                ) : (
                  <div className="rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-6 text-yellow-100">
                    <p className="text-sm font-semibold text-yellow-200">Analysis pending</p>
                    <p className="mt-2 text-sm">
                      We could not complete the full analysis right now. Please check back later or try uploading a new
                      swing.
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}