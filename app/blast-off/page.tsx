'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, ArrowLeft, AlertCircle } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
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
    setVideoAnalysis(null);
    setError(null);
    setIsAnalyzing(true);

    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) {
        throw new Error('User not authenticated');
      }

      const formData = new FormData();
      formData.append('video', file);
      formData.append('processingMode', 'full');
      formData.append('sampleRate', '1');
      formData.append('enableYOLO', 'true');
      formData.append('yoloConfidence', '0.5');
      formData.append('maxFrames', '10');

      const response = await fetch('/api/pose/analyze-video', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to analyze video' }));
        throw new Error(errorData.error || errorData.message || 'Failed to analyze video');
      }

      const analysis: VideoAnalysis = await response.json();
      setVideoAnalysis(analysis);

      if (!analysis.ok) {
        throw new Error(analysis.error || 'Video analysis encountered an error');
      }
    } catch (err: any) {
      console.error('Video analysis error:', err);
      setError(err?.message || 'Failed to analyze video. Please try again.');
    } finally {
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
