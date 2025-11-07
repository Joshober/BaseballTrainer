'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2 } from 'lucide-react';
import { onAuthChange, getFirebaseAuth } from '@/lib/firebase/auth';
import { getStorageAdapter } from '@/lib/storage';
import { calculateDistance } from '@/lib/game/physics';
import { getZone, getMilestone, getProgressToNext } from '@/lib/game/zones';
import { classifySwing } from '@/lib/game/label';
import CaptureUpload from '@/components/Mission/CaptureUpload';
import PosePreview from '@/components/Mission/PosePreview';
import VelocityInput from '@/components/Mission/VelocityInput';
import LaunchAnimation from '@/components/Mission/LaunchAnimation';
import type { PoseResult } from '@/types/pose';
import type { User as FirebaseUser } from 'firebase/auth';

type Mode = 'photo' | 'video' | 'manual';

export default function MissionPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>('photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [poseResult, setPoseResult] = useState<PoseResult | null>(null);
  const [exitVelocity, setExitVelocity] = useState<number>(0);
  const [gameResult, setGameResult] = useState<{
    distanceFt: number;
    zone: string;
    milestone: string;
    progress: number;
  } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (!user) {
        router.push('/login');
      } else {
        setUser(user);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  const handleVideoSelect = async (file: File) => {
    setSelectedFile(file);
    // For video, extract a frame (simplified - you could add frame selection UI)
    const video = document.createElement('video');
    video.src = URL.createObjectURL(file);
    video.currentTime = video.duration / 2;
    await new Promise((resolve) => {
      video.addEventListener('seeked', resolve, { once: true });
    });
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0);
      canvas.toBlob((blob) => {
        if (blob) {
          const imageFile = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
          handleImageSelect(imageFile);
        }
      }, 'image/jpeg');
    }
  };

  const handlePoseResult = (result: PoseResult) => {
    setPoseResult(result);
  };

  const handleLaunch = async () => {
    if (!user || !poseResult?.ok || exitVelocity <= 0) {
      alert('Please complete all steps: capture image, detect pose, and enter exit velocity');
      return;
    }

    setSaving(true);

    try {
      // Calculate game results
      const launchAngle = poseResult.launchAngleEst || 28;
      const distanceFt = calculateDistance(exitVelocity, launchAngle);
      const zone = getZone(distanceFt);
      const milestone = getMilestone(distanceFt);
      const progress = getProgressToNext(distanceFt);
      const label = classifySwing(launchAngle, exitVelocity);

      setGameResult({
        distanceFt,
        zone: zone.name,
        milestone,
        progress,
      });

      // Upload file to storage
      let photoPath = '';
      let photoURL = '';
      let videoPath = '';
      let videoURL = '';

      if (selectedFile) {
        const sessionId = crypto.randomUUID();
        const uid = user.uid;
        const ext = selectedFile.type.startsWith('video/') ? 'mp4' : 'jpg';
        const path = `swings/${uid}/${sessionId}.${ext}`;

        // Get storage adapter (respects STORAGE_TYPE config)
        const storage = getStorageAdapter();
        
        if (selectedFile.type.startsWith('video/')) {
          videoPath = path;
          videoURL = await storage.uploadFile(path, selectedFile);
        } else {
          photoPath = path;
          photoURL = await storage.uploadFile(path, selectedFile);
        }
      }

      // Get Firebase Auth token for API calls
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) {
        throw new Error('User not authenticated');
      }
      const token = await auth.currentUser.getIdToken();

      // Create session in database via API
      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: user.uid,
          teamId: 'default', // TODO: Get from user profile
          photoPath,
          photoURL,
          videoPath,
          videoURL,
          metrics: {
            launchAngleEst: poseResult.launchAngleEst || 28,
            attackAngleEst: poseResult.attackAngleEst,
            exitVelocity,
            confidence: poseResult.confidence || 0,
          },
          game: {
            distanceFt,
            zone: zone.name,
            milestone,
            progressToNext: progress,
          },
          label,
        }),
      });

      if (!sessionResponse.ok) {
        const error = await sessionResponse.json();
        throw new Error(error.error || 'Failed to create session');
      }

      const session = await sessionResponse.json();

      // Update leaderboard via API
      const leaderboardResponse = await fetch('/api/leaderboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          teamId: 'default',
          uid: user.uid,
          distanceFt,
          sessionId: session.id,
        }),
      });

      if (!leaderboardResponse.ok) {
        console.warn('Failed to update leaderboard');
      }

      // Show success message
      alert('Mission saved successfully!');
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save mission. Please try again.');
    } finally {
      setSaving(false);
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Rocket className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Mission Control</h1>
          </div>

          {/* Steps */}
          <div className="space-y-8">
            {/* Step 1: Capture/Upload */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Step 1: Capture Your Swing</h2>
              <CaptureUpload
                onImageSelect={handleImageSelect}
                onVideoSelect={handleVideoSelect}
                mode={mode}
                onModeChange={setMode}
              />
            </section>

            {/* Step 2: Pose Detection */}
            {imageUrl && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Step 2: Pose Analysis</h2>
                <PosePreview imageUrl={imageUrl} onResult={handlePoseResult} />
              </section>
            )}

            {/* Step 3: Exit Velocity */}
            {poseResult?.ok && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Step 3: Enter Exit Velocity</h2>
                <VelocityInput value={exitVelocity} onChange={setExitVelocity} />
              </section>
            )}

            {/* Step 4: Launch */}
            {poseResult?.ok && exitVelocity > 0 && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Step 4: Launch!</h2>
                <button
                  onClick={handleLaunch}
                  disabled={saving}
                  className="w-full px-6 py-4 bg-blue-600 text-white rounded-lg font-semibold text-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Rocket className="w-5 h-5" />
                      Launch Mission
                    </>
                  )}
                </button>
              </section>
            )}

            {/* Results */}
            {gameResult && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Mission Results</h2>
                <LaunchAnimation
                  distanceFt={gameResult.distanceFt}
                  exitVelocity={exitVelocity}
                  zone={gameResult.zone}
                  milestone={gameResult.milestone}
                  progress={gameResult.progress}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


