'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Video, ArrowLeft, Save, TrendingUp } from 'lucide-react';
import { onAuthChange, getFirebaseAuth } from '@/lib/firebase/auth';
import { useTeam } from '@/lib/hooks/useTeam';
import RealTimeStream from '@/components/Streaming/RealTimeStream';
import type { VideoAnalysis } from '@/types/session';

export default function StreamingPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const { teamId } = useTeam();
  const [currentAnalysis, setCurrentAnalysis] = useState<VideoAnalysis | null>(null);
  const [saved, setSaved] = useState(false);

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

  const handleAnalysisUpdate = (analysis: VideoAnalysis) => {
    setCurrentAnalysis(analysis);
    setSaved(false);
  };

  const handleStop = async (finalAnalysis: VideoAnalysis | null) => {
    setCurrentAnalysis(finalAnalysis);
    if (finalAnalysis) {
      // Optionally auto-save the session
      // await saveSession(finalAnalysis);
    }
  };

  const saveSession = async () => {
    if (!currentAnalysis || !user || saved) return;

    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return;

      const token = await auth.currentUser.getIdToken();

      // Create session with real-time analysis
      const sessionData = {
        uid: auth.currentUser.uid,
        teamId: teamId || 'default',
        photoPath: '',
        photoURL: '',
        videoPath: '',
        videoURL: '',
        metrics: {
          launchAngleEst: currentAnalysis.metrics?.launchAngle || 0,
          attackAngleEst: null,
          exitVelocity: currentAnalysis.metrics?.exitVelocityEstimateMph || 0,
          confidence: 0.8,
        },
        game: {
          distanceFt: 0, // Calculate from metrics if needed
          zone: 'atmosphere',
          milestone: 'Getting Started',
          progressToNext: 0,
        },
        label: 'good' as const,
        videoAnalysis: currentAnalysis,
      };

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(sessionData),
      });

      if (response.ok) {
        setSaved(true);
        alert('Session saved successfully!');
      } else {
        throw new Error('Failed to save session');
      }
    } catch (error) {
      console.error('Failed to save session:', error);
      alert('Failed to save session. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Video className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Real-Time Analysis</h1>
            </div>
            {currentAnalysis && !saved && (
              <button
                onClick={saveSession}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Save className="w-5 h-5" />
                Save Session
              </button>
            )}
            {saved && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-100 text-green-700 rounded-lg">
                <Save className="w-5 h-5" />
                Saved
              </div>
            )}
          </div>

          {/* Info Card */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <div className="flex items-start gap-3">
              <TrendingUp className="w-5 h-5 text-blue-600 mt-0.5" />
              <div>
                <h3 className="font-semibold text-blue-900 mb-1">Real-Time Analysis Mode</h3>
                <p className="text-sm text-blue-800">
                  Start your camera to begin real-time swing analysis. The system will analyze your swing
                  as you perform it, providing instant feedback on your form, bat speed, and exit velocity.
                </p>
              </div>
            </div>
          </div>

          {/* Real-Time Stream Component */}
          <div className="bg-white rounded-lg shadow-lg p-6">
            <RealTimeStream
              onAnalysisUpdate={handleAnalysisUpdate}
              onStop={handleStop}
            />
          </div>

          {/* Analysis Summary */}
          {currentAnalysis && currentAnalysis.ok && (
            <div className="mt-6 bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Analysis Summary</h2>
              {currentAnalysis.metrics && (
                <div className="grid md:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Bat Speed</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {currentAnalysis.metrics.batLinearSpeedMph.toFixed(1)} mph
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Exit Velocity</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {currentAnalysis.metrics.exitVelocityEstimateMph.toFixed(1)} mph
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <div className="text-sm text-gray-600 mb-1">Launch Angle</div>
                    <div className="text-2xl font-bold text-gray-900">
                      {currentAnalysis.metrics.launchAngle.toFixed(1)}°
                    </div>
                  </div>
                </div>
              )}

              {currentAnalysis.formAnalysis && currentAnalysis.formAnalysis.feedback && (
                <div className="mt-4">
                  <h3 className="font-semibold mb-2">Form Analysis</h3>
                  <ul className="space-y-2">
                    {currentAnalysis.formAnalysis.feedback.map((fb, idx) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <span className="text-blue-600">•</span>
                        <span>{fb}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

