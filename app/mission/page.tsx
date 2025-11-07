'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, Video, Play } from 'lucide-react';
import Link from 'next/link';
import { onAuthChange, getFirebaseAuth } from '@/lib/firebase/auth';
import { useTeam } from '@/lib/hooks/useTeam';
import { getStorageAdapter } from '@/lib/storage';
import { calculateDistance } from '@/lib/game/physics';
import { getZone, getMilestone, getProgressToNext } from '@/lib/game/zones';
import { classifySwing } from '@/lib/game/label';
import CaptureUpload from '@/components/Mission/CaptureUpload';
import PosePreview from '@/components/Mission/PosePreview';
import VelocityInput from '@/components/Mission/VelocityInput';
import LaunchAnimation from '@/components/Mission/LaunchAnimation';
import DrillRecommendations from '@/components/Drills/DrillRecommendations';
import type { PoseResult } from '@/types/pose';
import type { User as FirebaseUser } from 'firebase/auth';
import type { VideoAnalysis } from '@/types/session';

type Mode = 'photo' | 'video' | 'manual';

export default function MissionPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);
  const { teamId, loading: teamLoading } = useTeam();
  const [mode, setMode] = useState<Mode>('photo');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [poseResult, setPoseResult] = useState<PoseResult | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
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
    setVideoAnalysis(null);
    setAnalyzingVideo(true);
    
    // For video, extract a frame for pose detection preview
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.src = objectUrl;
    video.muted = true; // Mute to allow autoplay in some browsers
    
    try {
      // Wait for video metadata to load before accessing duration
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('Video metadata loading timeout'));
        }, 10000); // 10 second timeout
        
        video.addEventListener('loadedmetadata', () => {
          clearTimeout(timeout);
          resolve();
        }, { once: true });
        
        video.addEventListener('error', () => {
          clearTimeout(timeout);
          reject(new Error('Video loading error'));
        }, { once: true });
      });
      
      // Now duration is available, seek to middle of video
      if (video.duration && isFinite(video.duration) && video.duration > 0) {
        video.currentTime = video.duration / 2;
        
        // Wait for seek to complete
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video seek timeout'));
          }, 5000); // 5 second timeout
          
          video.addEventListener('seeked', () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
          
          video.addEventListener('error', () => {
            clearTimeout(timeout);
            reject(new Error('Video seek error'));
          }, { once: true });
        });
        
        // Extract frame for preview
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const imageUrl = canvas.toDataURL('image/jpeg');
          setImageUrl(imageUrl);
        }
        
        // Run full video analysis
        await analyzeVideo(file);
      } else {
        // If duration is not available, use first frame (currentTime = 0)
        video.currentTime = 0;
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Video seek timeout'));
          }, 5000);
          
          video.addEventListener('seeked', () => {
            clearTimeout(timeout);
            resolve();
          }, { once: true });
          
          video.addEventListener('error', () => {
            clearTimeout(timeout);
            reject(new Error('Video seek error'));
          }, { once: true });
        });
      }
      
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(video, 0, 0);
        canvas.toBlob((blob) => {
          if (blob) {
            const imageFile = new File([blob], 'frame.jpg', { type: 'image/jpeg' });
            handleImageSelect(imageFile);
          }
        }, 'image/jpeg');
      } else {
        throw new Error('Invalid video dimensions');
      }
    } catch (error) {
      console.error('Error extracting frame from video:', error);
      alert('Failed to extract frame from video. Please try again or use a different video file.');
    } finally {
      // Clean up the object URL
      URL.revokeObjectURL(objectUrl);
      setAnalyzingVideo(false);
    }
  };

  const analyzeVideo = async (file: File) => {
    try {
      setAnalyzingVideo(true);
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) {
        throw new Error('User not authenticated');
      }
      const token = await auth.currentUser.getIdToken();

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

      // If analysis is successful, use the metrics for pose result
      if (analysis.ok && analysis.metrics) {
        setPoseResult({
          ok: true,
          launchAngleEst: analysis.metrics.launchAngle,
          attackAngleEst: null,
          confidence: 0.8,
        });
      }
    } catch (error) {
      console.error('Video analysis error:', error);
      alert('Failed to analyze video. You can still proceed with manual entry.');
      setVideoAnalysis({ ok: false, error: String(error) });
    } finally {
      setAnalyzingVideo(false);
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
          teamId: teamId || 'default',
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
          videoAnalysis: videoAnalysis || undefined,
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
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Rocket className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Mission Control</h1>
            </div>
            <Link
              href="/streaming"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-blue-600 text-white rounded-lg hover:from-purple-600 hover:to-blue-700 transition-colors font-medium"
            >
              <Play className="w-5 h-5" />
              Real-Time Mode
            </Link>
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
              {analyzingVideo && (
                <div className="mt-4 flex items-center gap-2 text-blue-600">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Analyzing video... This may take a moment.</span>
                </div>
              )}
              {videoAnalysis && videoAnalysis.ok && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-green-800 font-semibold">Video analysis complete!</p>
                  {videoAnalysis.metrics && (
                    <div className="mt-2 text-sm text-green-700">
                      <p>Bat Speed: {videoAnalysis.metrics.batLinearSpeedMph.toFixed(1)} mph</p>
                      <p>Exit Velocity: {videoAnalysis.metrics.exitVelocityEstimateMph.toFixed(1)} mph</p>
                      {videoAnalysis.contactFrame !== null && (
                        <p>Contact detected at frame {videoAnalysis.contactFrame}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
              {videoAnalysis && !videoAnalysis.ok && (
                <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-yellow-800">Video analysis unavailable. You can still proceed with manual entry.</p>
                </div>
              )}
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

            {/* Drill Recommendations */}
            {(poseResult?.ok || videoAnalysis?.ok) && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <DrillRecommendations
                  corrections={extractCorrections(poseResult, videoAnalysis)}
                  metrics={extractMetrics(poseResult, videoAnalysis, exitVelocity)}
                  limit={5}
                />
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


