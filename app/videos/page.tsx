'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Video, MessageCircle, Bot, ArrowLeft, Upload, Camera, RefreshCw, Activity } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import { getStorageAdapter } from '@/lib/storage';
import type { Session } from '@/types/session';
import VideoGallery from '@/components/Dashboard/VideoGallery';
import AnalysisAnimation from '@/components/Analysis/AnalysisAnimation';
// Removed complex swing detection service - using simple script instead

export default function VideosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showMessengerModal, setShowMessengerModal] = useState(false);
  const [showAIBotModal, setShowAIBotModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isAnalyzingVideo, setIsAnalyzingVideo] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [currentRecordingSessionId, setCurrentRecordingSessionId] = useState<string | null>(null);
  const [swingDetectionStatus, setSwingDetectionStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [isRetryingSwingDetection, setIsRetryingSwingDetection] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const swingDetectionPollingRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        loadSessions();
      }
    });

    return () => {
      unsubscribe();
      // Cleanup polling on unmount
      if (swingDetectionPollingRef.current) {
        clearInterval(swingDetectionPollingRef.current);
      }
    };
  }, [router]);

  const loadSessions = async () => {
    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) return;

      const response = await fetch(`/api/sessions?uid=${authUser.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: Session[] = await response.json();
        // Filter to only sessions with videos
        setSessions(data.filter((s) => s.videoURL));
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSendToMessenger = (session: Session) => {
    setSelectedSession(session);
    setShowMessengerModal(true);
  };

  const handleSendToAIBot = (session: Session) => {
    setSelectedSession(session);
    setShowAIBotModal(true);
  };

  const sendToMessenger = async (receiverUid: string) => {
    if (!selectedSession || !user) return;

    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) return;

      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverUid,
          content: `Check out my swing! Distance: ${selectedSession.game.distanceFt.toFixed(0)} ft`,
          videoURL: selectedSession.videoURL,
          videoPath: selectedSession.videoPath,
          sessionId: selectedSession.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');

      setShowMessengerModal(false);
      setSelectedSession(null);
      alert('Video sent to messenger!');
      router.push('/messages');
    } catch (error) {
      console.error('Failed to send video:', error);
      alert('Failed to send video. Please try again.');
    }
  };

  const sendToAIBot = async () => {
    if (!selectedSession || !user) return;

    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) return;
      
      // Redirect to analyze page with video URL
      setShowAIBotModal(false);
      const session = selectedSession;
      setSelectedSession(null);
      
      // Redirect to analyze page with video URL as query parameter
      router.push(`/analyze?videoUrl=${encodeURIComponent(session.videoURL || '')}&sessionId=${session.id}`);
    } catch (error) {
      console.error('Failed to send to AI bot:', error);
      alert('Failed to send to AI bot. Please try again.');
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }
    await uploadVideo(file);
  };

  const startVideoRecording = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        alert('Please log in to record video');
        return;
      }

      // Generate session ID for this recording
      const sessionId = crypto.randomUUID();
      setCurrentRecordingSessionId(sessionId);

      // Automatically start swing detection via Flask service
      setSwingDetectionStatus('connecting');
      try {
        const { startSwingDetection } = await import('@/lib/services/blast-connector');
        const swingData = await startSwingDetection(sessionId, token);
        console.log('✅ Swing detection started automatically:', swingData);
        if (swingData.session_id) {
          console.log(`   Session ID: ${swingData.session_id}`);
          console.log(`   Status: ${swingData.status}`);
          console.log(`   Check Flask service logs for swing detection output`);
          setSwingDetectionStatus('connected');
        } else {
          setSwingDetectionStatus('error');
        }
      } catch (error: any) {
        console.warn('⚠️ Error starting swing detection automatically:', error?.message || error);
        console.warn('   Recording will continue without swing detection');
        setSwingDetectionStatus('error');
        // Continue recording even if swing detection fails to start
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user' },
        audio: false,
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
        ? 'video/webm;codecs=vp9'
        : MediaRecorder.isTypeSupported('video/webm')
        ? 'video/webm'
        : 'video/mp4';

      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: mimeType });
        setRecordedBlob(blob);
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((track) => track.stop());
          streamRef.current = null;
        }
        
               // Stop swing detection when recording stops (fire and forget)
               if (currentRecordingSessionId) {
                 const sessionIdToStop = currentRecordingSessionId;
                 const token = getAuthToken();
                 if (token) {
                   import('@/lib/services/blast-connector').then(({ stopSwingDetection }) => {
                     stopSwingDetection(sessionIdToStop, token).catch((error) => {
                       console.warn('Error stopping swing detection:', error);
                     });
                   });
                 }
               }
        
        setCurrentRecordingSessionId(null);
      };

      mediaRecorder.start();
      setIsRecording(true);

      // Poll for swing data and stop signal to auto-stop recording
      startSwingDataPolling(sessionId);
    } catch (error) {
      console.error('Video recording error:', error);
      alert('Could not access camera for video recording');
    }
  };

  const startSwingDataPolling = (sessionId: string) => {
    // Poll the API to check if swing data was received or stop signal was sent
    if (swingDetectionPollingRef.current) {
      clearInterval(swingDetectionPollingRef.current);
    }

    swingDetectionPollingRef.current = setInterval(async () => {
      try {
        // Check if stop signal was sent
        const stopResponse = await fetch(`/api/videos/stop?sessionId=${sessionId}`);
        if (stopResponse.ok) {
          const stopData = await stopResponse.json();
          if (stopData.shouldStop) {
            console.log('Stop signal received, stopping recording');
            stopVideoRecording();
            return;
          }
        }

        // Also check if swing data was received (backup method)
        const swingResponse = await fetch(`/api/blast/swings?sessionId=${sessionId}`);
        if (swingResponse.ok) {
          const swingData = await swingResponse.json();
          // If swing data exists, stop recording
          if (swingData.hasSwingData) {
            console.log('Swing data received, stopping recording');
            stopVideoRecording();
          }
        }
      } catch (error) {
        console.error('Error polling for swing data/stop signal:', error);
      }
    }, 500); // Poll every 500ms
  };

  const retrySwingDetection = async () => {
    if (!currentRecordingSessionId) return;
    
    setIsRetryingSwingDetection(true);
    setSwingDetectionStatus('connecting');
    
    try {
      const token = getAuthToken();
      if (!token) {
        alert('Please log in to retry swing detection');
        setIsRetryingSwingDetection(false);
        return;
      }

      // Stop existing detection first
      try {
        const { stopSwingDetection } = await import('@/lib/services/blast-connector');
        await stopSwingDetection(currentRecordingSessionId, token);
      } catch (error) {
        // Ignore errors when stopping
      }

      // Wait a moment before restarting
      await new Promise(resolve => setTimeout(resolve, 500));

      // Start swing detection again
      const { startSwingDetection } = await import('@/lib/services/blast-connector');
      const swingData = await startSwingDetection(currentRecordingSessionId, token);
      
      if (swingData.session_id) {
        console.log('✅ Swing detection retry successful:', swingData);
        setSwingDetectionStatus('connected');
      } else {
        setSwingDetectionStatus('error');
      }
    } catch (error: any) {
      console.error('⚠️ Error retrying swing detection:', error?.message || error);
      setSwingDetectionStatus('error');
    } finally {
      setIsRetryingSwingDetection(false);
    }
  };

  const stopVideoRecording = async () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    // Stop polling
    if (swingDetectionPollingRef.current) {
      clearInterval(swingDetectionPollingRef.current);
      swingDetectionPollingRef.current = null;
    }
    
    // Stop swing detection if it's running
    if (currentRecordingSessionId) {
      try {
        const token = getAuthToken();
        if (token) {
          const { stopSwingDetection } = await import('@/lib/services/blast-connector');
          await stopSwingDetection(currentRecordingSessionId, token);
        }
      } catch (error) {
        console.warn('Error stopping swing detection:', error);
      }
    }
    
    setCurrentRecordingSessionId(null);
    setSwingDetectionStatus('idle');
  };

  const saveRecordedVideo = async () => {
    if (recordedBlob) {
      const file = new File([recordedBlob], `recording-${Date.now()}.${recordedBlob.type.includes('webm') ? 'webm' : 'mp4'}`, {
        type: recordedBlob.type,
      });
      await uploadVideo(file);
      setRecordedBlob(null);
      recordedChunksRef.current = [];
    }
  };

  const uploadVideo = async (file: File) => {
    if (!user) return;

    setIsUploading(true);
    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) {
        throw new Error('User not authenticated');
      }

      // Upload video to storage server
      const storage = getStorageAdapter();
      const sessionId = crypto.randomUUID();
      const uid = authUser.sub;
      const ext = file.type.includes('mp4') ? 'mp4' : file.type.includes('webm') ? 'webm' : 'mp4';
      const videoPath = `videos/${uid}/${sessionId}.${ext}`;
      
      const videoURL = await storage.uploadFile(videoPath, file);

      // Create session in database with video
      const sessionResponse = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: authUser.sub,
          teamId: 'default',
          photoPath: '', // No photo for video-only uploads
          photoURL: '',
          videoPath,
          videoURL,
          metrics: {
            launchAngleEst: 28, // Default values for video-only uploads
            attackAngleEst: null,
            exitVelocity: 0,
            confidence: 0,
          },
          game: {
            distanceFt: 0,
            zone: 'unknown',
            milestone: 'none',
            progressToNext: 0,
          },
          label: 'needs_work' as const,
        }),
      });

      if (!sessionResponse.ok) {
        throw new Error('Failed to create session');
      }
      const createdSession: Session = await sessionResponse.json();

      // Reload sessions
      await loadSessions();
      
      // Trigger video analysis after successful upload
      setIsUploading(false);
      setIsAnalyzingVideo(true);
      
      try {
        // Create FormData for video analysis
        const formData = new FormData();
        formData.append('video', file);
        // Attach identifiers so backend can associate and persist
        if (createdSession?.id) formData.append('sessionId', createdSession.id);
        if (createdSession?.videoURL) formData.append('videoUrl', createdSession.videoURL || '');
        formData.append('processingMode', 'full');
        formData.append('sampleRate', '1');
        formData.append('enableYOLO', 'true');
        formData.append('yoloConfidence', '0.5');

        // Call video analysis API
        const analysisResponse = await fetch('/api/pose/analyze-video', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
          body: formData,
        });

        if (!analysisResponse.ok) {
          const errorData = await analysisResponse.json().catch(() => ({ error: 'Analysis failed' }));
          console.error('Video analysis error:', errorData);
          // Don't throw - analysis failure shouldn't prevent upload success
        } else {
          const analysisResult = await analysisResponse.json();
          // Optionally update the session with analysis results
          if (analysisResult.ok && createdSession.id) {
            // Update session with analysis results if needed
            console.log('Video analysis completed:', analysisResult);
          }
        }
      } catch (analysisError) {
        console.error('Failed to analyze video:', analysisError);
        // Don't show error to user - analysis is optional
      } finally {
        setIsAnalyzingVideo(false);
        alert('Video uploaded and analyzed successfully!');
      }
    } catch (error) {
      console.error('Failed to upload video:', error);
      alert('Failed to upload video. Please try again.');
      setIsAnalyzingVideo(false);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
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
      {/* Fullscreen Analysis Animation Overlay */}
      <AnalysisAnimation isAnalyzing={isAnalyzingVideo} />
      
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-7xl mx-auto">
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
              <h1 className="text-3xl font-bold text-gray-900">My Videos</h1>
            </div>
            
            {/* Upload Buttons */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                <Upload className="w-5 h-5" />
                {isUploading ? 'Uploading...' : 'Upload Video'}
              </button>
              <input
                id="video-upload"
                ref={fileInputRef}
                type="file"
                accept="video/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isUploading}
              />
              {!isRecording && !recordedBlob && (
                <button
                  onClick={startVideoRecording}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  disabled={isUploading}
                >
                  <Camera className="w-5 h-5" />
                  Record
                </button>
              )}
            </div>
          </div>

          {/* Recording UI */}
          {isRecording && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
                  <span className="font-medium">Recording...</span>
                </div>
                <button
                  onClick={stopVideoRecording}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Stop Recording
                </button>
              </div>
              
              {/* Swing Detection Status */}
              <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Activity className={`w-4 h-4 ${
                      swingDetectionStatus === 'connected' ? 'text-green-600' :
                      swingDetectionStatus === 'connecting' ? 'text-yellow-600 animate-pulse' :
                      swingDetectionStatus === 'error' ? 'text-red-600' :
                      'text-gray-400'
                    }`} />
                    <span className="text-sm font-medium">
                      Swing Detection: {
                        swingDetectionStatus === 'connected' ? 'Connected' :
                        swingDetectionStatus === 'connecting' ? 'Connecting...' :
                        swingDetectionStatus === 'error' ? 'Connection Failed' :
                        'Idle'
                      }
                    </span>
                  </div>
                  {swingDetectionStatus === 'error' && (
                    <button
                      onClick={retrySwingDetection}
                      disabled={isRetryingSwingDetection}
                      className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                    >
                      <RefreshCw className={`w-4 h-4 ${isRetryingSwingDetection ? 'animate-spin' : ''}`} />
                      {isRetryingSwingDetection ? 'Retrying...' : 'Retry Connection'}
                    </button>
                  )}
                </div>
                {swingDetectionStatus === 'connecting' && (
                  <p className="text-xs text-gray-600 mt-2">
                    Scanning for BLAST@MOTION device... Make sure your bat is powered on.
                  </p>
                )}
                {swingDetectionStatus === 'error' && (
                  <p className="text-xs text-red-600 mt-2">
                    Failed to connect to swing detection. Click "Retry Connection" to try again.
                  </p>
                )}
                {swingDetectionStatus === 'connected' && (
                  <p className="text-xs text-green-600 mt-2">
                    ✓ Swing detection active. Video will stop automatically when a swing is detected.
                  </p>
                )}
              </div>
              
              <video
                ref={videoRef}
                autoPlay
                muted
                className="w-full max-w-md mx-auto mt-4 rounded-lg"
              />
            </div>
          )}

          {/* Recorded Video Preview */}
          {recordedBlob && !isRecording && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h3 className="font-semibold mb-4">Recorded Video Preview</h3>
              <video
                src={URL.createObjectURL(recordedBlob)}
                controls
                className="w-full max-w-md mx-auto rounded-lg mb-4"
              />
              <div className="flex gap-2 justify-center">
                <button
                  onClick={saveRecordedVideo}
                  disabled={isUploading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isUploading ? 'Uploading...' : 'Save Video'}
                </button>
                <button
                  onClick={() => {
                    setRecordedBlob(null);
                    recordedChunksRef.current = [];
                  }}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Discard
                </button>
              </div>
            </div>
          )}

          {/* Video Gallery */}
          <div className="bg-white rounded-lg shadow-lg p-6">
          <VideoGallery
            sessions={sessions}
            onSendToMessenger={handleSendToMessenger}
            onSendToAIBot={handleSendToAIBot}
          />
          </div>
        </div>
      </div>

      {/* Messenger Modal */}
      {showMessengerModal && (
        <MessengerModal
          onClose={() => {
            setShowMessengerModal(false);
            setSelectedSession(null);
          }}
          onSend={sendToMessenger}
        />
      )}

      {/* AI Bot Modal */}
      {showAIBotModal && selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <div className="flex items-center gap-3 mb-4">
              <Bot className="w-6 h-6 text-purple-600" />
              <h2 className="text-2xl font-bold">Send to AI Bot</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Send this video to the AI bot for analysis. The bot will analyze your swing and provide feedback.
            </p>
            <div className="flex gap-3">
              <button
                onClick={sendToAIBot}
                className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                Send to AI Bot
              </button>
              <button
                onClick={() => {
                  setShowAIBotModal(false);
                  setSelectedSession(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// Messenger Modal Component
function MessengerModal({ onClose, onSend }: { onClose: () => void; onSend: (uid: string) => void }) {
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = async () => {
    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) return;

      const response = await fetch('/api/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setConversations(data);
        
        // Load user names for each conversation
        const names: Record<string, string> = {};
        for (const conv of data) {
          const otherUid = conv.participant1Uid === authUser.sub ? conv.participant2Uid : conv.participant1Uid;
          if (!names[otherUid]) {
            try {
              const userResponse = await fetch(`/api/users?uid=${otherUid}`, {
                headers: { 'Authorization': `Bearer ${token}` },
              });
              if (userResponse.ok) {
                const user = await userResponse.json();
                names[otherUid] = user.name || user.email || 'Unknown User';
              } else {
                names[otherUid] = 'Unknown User';
              }
            } catch {
              names[otherUid] = 'Unknown User';
            }
          }
        }
        setUserNames(names);
      }
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 max-h-[80vh] overflow-y-auto">
        <div className="flex items-center gap-3 mb-4">
          <MessageCircle className="w-6 h-6 text-blue-600" />
          <h2 className="text-2xl font-bold">Send to Messenger</h2>
        </div>
        <p className="text-gray-600 mb-4">Select a conversation to send the video to:</p>
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>No conversations yet.</p>
            <button
              onClick={() => {
                onClose();
                window.location.href = '/messages';
              }}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Go to Messages
            </button>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv) => {
              const authUser = getAuthUser();
              const otherUid = conv.participant1Uid === authUser?.sub ? conv.participant2Uid : conv.participant1Uid;
              const otherUserName = userNames[otherUid] || 'Unknown User';
              const lastMessageContent = conv.lastMessage?.content || (conv.lastMessage?.videoURL ? '[Video]' : '');
              
              return (
                <button
                  key={conv.id}
                  onClick={() => onSend(otherUid)}
                  className="w-full text-left px-4 py-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <p className="font-medium">{otherUserName}</p>
                  {lastMessageContent && (
                    <p className="text-sm text-gray-600 truncate">{lastMessageContent}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <button
          onClick={onClose}
          className="mt-4 w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

