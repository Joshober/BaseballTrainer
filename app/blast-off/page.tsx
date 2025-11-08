'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, Video, ArrowLeft, Camera } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
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
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

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
    // Not used in blast off mode, but required by CaptureUpload
    setSelectedFile(file);
  };

  const handleVideoSelect = async (file: File) => {
    setSelectedFile(file);
    setVideoAnalysis(null);
    setAnalyzingVideo(true);
    
    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) {
        throw new Error('User not authenticated');
      }

      // Create FormData for video upload
      const formData = new FormData();
      formData.append('video', file);
      formData.append('processingMode', 'full');
      formData.append('sampleRate', '1');
      formData.append('enableYOLO', 'true');
      formData.append('yoloConfidence', '0.5');

      // Call video analysis API
      const response = await fetch('/api/pose/analyze-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to analyze video');
      }

      const analysis: VideoAnalysis = await response.json();
      setVideoAnalysis(analysis);
    } catch (error) {
      console.error('Video analysis error:', error);
      setVideoAnalysis({ ok: false, error: String(error) });
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

          {/* Main Content */}
          <div className="space-y-8">
            {/* Video Recording Section */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Record Your Swing</h2>
              <p className="text-gray-600 mb-4">
                Record a video of your baseball swing. Once recording is complete, the video will be automatically analyzed.
              </p>
              <CaptureUpload
                onImageSelect={handleImageSelect}
                onVideoSelect={handleVideoSelect}
                mode={mode}
                onModeChange={setMode}
              />
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

                {videoAnalysis.formAnalysis && videoAnalysis.formAnalysis.feedback && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Form Analysis</h3>
                    <ul className="space-y-2">
                      {videoAnalysis.formAnalysis.feedback.map((fb, idx) => (
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
                <p className="text-yellow-800">
                  Video analysis encountered an error. Please try recording again.
                </p>
                {videoAnalysis.error && (
                  <p className="text-sm text-yellow-700 mt-2">{videoAnalysis.error}</p>
                )}
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

