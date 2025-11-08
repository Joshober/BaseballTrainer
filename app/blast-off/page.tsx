'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, ArrowLeft, Play } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import { getStorageAdapter } from '@/lib/storage';
import CaptureUpload from '@/components/Mission/CaptureUpload';
import AnalysisAnimation from '@/components/Analysis/AnalysisAnimation';
import type { VideoAnalysis } from '@/types/session';

export default function BlastOffPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'photo' | 'video' | 'manual'>('video');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);

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
    setAnalyzingVideo(true);
    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) throw new Error('User not authenticated');

      // 1) Upload to storage
      const storage = getStorageAdapter();
      const sessionId = crypto.randomUUID();
      const uid = authUser.sub;
      const ext = file.type.includes('mp4') ? 'mp4' : file.type.includes('webm') ? 'webm' : 'mp4';
      const videoPath = `videos/${uid}/${sessionId}.${ext}`;
      const videoURL = await storage.uploadFile(videoPath, file);

      // 2) Create session (server triggers background analysis)
      const createResp = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: authUser.sub,
          teamId: 'default',
          photoPath: '',
          photoURL: '',
          videoPath,
          videoURL,
          metrics: { launchAngleEst: 28, attackAngleEst: null, exitVelocity: 0, confidence: 0 },
          game: { distanceFt: 0, zone: 'unknown', milestone: 'none', progressToNext: 0 },
          label: 'needs_work' as const,
        }),
      });
      if (!createResp.ok) throw new Error('Failed to create session');
      const createdSession = await createResp.json();

      // 3) Trigger direct analysis with identifiers
      try {
        const fd = new FormData();
        fd.append('video', file);
        fd.append('sessionId', createdSession.id);
        if (videoURL) fd.append('videoUrl', videoURL);
        fd.append('processingMode', 'full');
        fd.append('sampleRate', '1');
        fd.append('enableYOLO', 'true');
        fd.append('yoloConfidence', '0.5');
        await fetch('/api/pose/analyze-video', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
        });
      } catch (e) {
        // Non-fatal: polling below may still find results if analysis completes later
        console.warn('Failed to trigger direct analysis', e);
      }

      // 4) Poll for analysis completion while showing space animation
      const sid = createdSession.id as string;
      const start = Date.now();
      const timeoutMs = 5 * 60 * 1000; // 5 minutes
      const pollInterval = 3000;
      while (Date.now() - start < timeoutMs) {
        try {
          const resp = await fetch(`/api/video-analyses?sessionId=${encodeURIComponent(sid)}`, {
            headers: { 'Authorization': `Bearer ${token}` },
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data?.ok) {
              setVideoAnalysis(data as VideoAnalysis);
              break;
            }
          }
        } catch {}
        await new Promise((r) => setTimeout(r, pollInterval));
      }
    } catch (error) {
      console.error('Video pipeline error:', error);
      setVideoAnalysis({ ok: false, error: String(error) } as VideoAnalysis);
    } finally {
      setAnalyzingVideo(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Fullscreen Analysis Animation Overlay */}
      <AnalysisAnimation isAnalyzing={analyzingVideo} />

      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push('/')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Rocket className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Blast Off</h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            {/* Video Recording Section */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Record Your Swing</h2>
              <p className="text-gray-600 mb-4">Record or upload a swing. We’ll analyze it and save to your videos.</p>
              <CaptureUpload onImageSelect={handleImageSelect} onVideoSelect={handleVideoSelect} mode={mode} onModeChange={setMode} />
            </section>

            {/* Analysis Results */}
            {videoAnalysis && videoAnalysis.ok && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>
                {videoAnalysis.metrics && (
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">Bat Speed</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {videoAnalysis.metrics.batLinearSpeedMph.toFixed(1)} mph
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">Exit Velocity</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {videoAnalysis.metrics.exitVelocityEstimateMph.toFixed(1)} mph
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">Launch Angle</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {videoAnalysis.metrics.launchAngle.toFixed(1)}°
                      </div>
                    </div>
                  </div>
                )}

                {videoAnalysis.formAnalysis && (videoAnalysis.formAnalysis as any).feedback && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Form Analysis</h3>
                    <ul className="space-y-2">
                      {(videoAnalysis.formAnalysis as any).feedback.map((fb: string, idx: number) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-600">•</span>
                          <span>{fb}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            )}

            {videoAnalysis && !videoAnalysis.ok && (
              <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">Video analysis encountered an error. Please try recording again.</p>
                {videoAnalysis.error && <p className="text-sm text-yellow-700 mt-2">{videoAnalysis.error}</p>}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
