'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Video, Send, Bot, Play, Calendar, TrendingUp, Sparkles } from 'lucide-react';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import type { Session } from '@/types/session';
import type { VideoAnalysis } from '@/types/session';

interface VideoGalleryProps {
  sessions: Session[];
  onSendToMessenger: (session: Session) => void;
  onSendToAIBot: (session: Session) => void;
  onSendToOpenRouter?: (session: Session) => void;
}

interface SessionWithAnalysis extends Session {
  videoAnalysisData?: VideoAnalysis | null;
  pendingAnalysis?: boolean;
}

export default function VideoGallery({ sessions, onSendToMessenger, onSendToAIBot, onSendToOpenRouter }: VideoGalleryProps) {
  const router = useRouter();
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<'all' | 'good' | 'needs_work'>('all');
  const [sessionsWithAnalysis, setSessionsWithAnalysis] = useState<SessionWithAnalysis[]>([]);
  const [polling, setPolling] = useState(false);

  // Initialize list and batch check analysis statuses
  useEffect(() => {
    const init = async () => {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) {
        setSessionsWithAnalysis(sessions);
        return;
      }

      // Start with optimistic pending state (unless embedded analysis exists)
      const base = sessions.map((s) => ({
        ...s,
        videoAnalysisData: s.videoAnalysis || null,
        pendingAnalysis: !s.videoAnalysis,
      }));
      setSessionsWithAnalysis(base);

      // Batch query analysis by sessionIds
      const ids = sessions.map((s) => s.id);
      if (ids.length === 0) return;
      try {
        const resp = await fetch('/api/video-analyses/status', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ sessionIds: ids }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const map: Record<string, { analysis?: VideoAnalysis } | null> = data.map || {};
          setSessionsWithAnalysis((prev) => prev.map((item) => {
            const rec = map[item.id];
            if (rec && (rec as any).analysis?.ok) {
              return { ...item, videoAnalysisData: (rec as any).analysis, pendingAnalysis: false };
            }
            return item;
          }));
        }
      } catch (e) {
        // ignore
      }
    };

    if (sessions.length > 0) {
      init();
    } else {
      setSessionsWithAnalysis([]);
    }
  }, [sessions]);

  // Gentle polling: refresh analysis status for pending sessions
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const token = getAuthToken();
    if (!token) return;

    const startPolling = () => {
      if (interval) return;
      setPolling(true);
      interval = setInterval(async () => {
        try {
          const pending = sessionsWithAnalysis.filter(
            (s) => s.videoURL && (!s.videoAnalysisData || !s.videoAnalysisData.ok)
          );
          if (pending.length === 0) {
            if (interval) {
              clearInterval(interval);
              interval = null;
              setPolling(false);
            }
            return;
          }

          // Batch status check
          const ids = pending.map((s) => s.id);
          try {
            const resp = await fetch('/api/video-analyses/status', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({ sessionIds: ids }),
            });
            if (resp.ok) {
              const data = await resp.json();
              const map: Record<string, { analysis?: VideoAnalysis } | null> = data.map || {};
              setSessionsWithAnalysis((prev) => prev.map((item) => {
                const rec = map[item.id];
                if (rec && (rec as any).analysis?.ok) {
                  return { ...item, videoAnalysisData: (rec as any).analysis, pendingAnalysis: false };
                }
                return item;
              }));
            }
          } catch {
            // ignore
          }
        } catch {
          // ignore
        }
      }, 5000);
    };

    const hasPending = sessionsWithAnalysis.some(
      (s) => s.videoURL && (!s.videoAnalysisData || !s.videoAnalysisData.ok)
    );
    if (hasPending) startPolling();

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [sessionsWithAnalysis]);

  // Helper function to get display metrics for a session
  const getDisplayMetrics = (session: SessionWithAnalysis) => {
    const analysis = session.videoAnalysisData || session.videoAnalysis;
    
    if (analysis && analysis.ok && analysis.metrics) {
      // Use analysis metrics if available
      // Calculate distance from exit velocity (rough estimate: 1 mph â‰ˆ 0.15 ft)
      const distance = analysis.metrics.exitVelocityEstimateMph 
        ? Math.max(0, Math.round(analysis.metrics.exitVelocityEstimateMph * 0.15))
        : session.game.distanceFt;
      
      const launchAngle = analysis.metrics.launchAngle ?? session.metrics.launchAngleEst;
      const velocity = analysis.metrics.exitVelocityEstimateMph ?? analysis.metrics.batLinearSpeedMph ?? session.metrics.exitVelocity;
      
      return {
        distance: typeof distance === 'number' ? distance : parseFloat(String(distance)) || 0,
        launchAngle: typeof launchAngle === 'number' ? launchAngle : parseFloat(String(launchAngle)) || 0,
        velocity: typeof velocity === 'number' ? velocity : parseFloat(String(velocity)) || 0,
      };
    }
    
    // Fallback to session defaults
    return {
      distance: session.game.distanceFt,
      launchAngle: session.metrics.launchAngleEst,
      velocity: session.metrics.exitVelocity,
    };
  };

  const filteredSessions = sessionsWithAnalysis.length > 0 ? sessionsWithAnalysis : sessions;
  const filteredByLabel = filteredSessions.filter((session) => {
    if (filter === 'all') return true;
    return session.label === filter;
  });

  const videosWithURLs = filteredByLabel.filter((s) => s.videoURL);

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'all'
              ? 'border-b-2 border-blue-600 text-blue-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All Videos ({videosWithURLs.length})
        </button>
        <button
          onClick={() => setFilter('good')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'good'
              ? 'border-b-2 border-green-600 text-green-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Good Swings ({sessions.filter((s) => s.label === 'good' && s.videoURL).length})
        </button>
        <button
          onClick={() => setFilter('needs_work')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'needs_work'
              ? 'border-b-2 border-yellow-600 text-yellow-600'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Needs Work ({sessions.filter((s) => s.label === 'needs_work' && s.videoURL).length})
        </button>
      </div>

      {/* Video Grid */}
      {videosWithURLs.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <Video className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>No videos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videosWithURLs.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow"
            >
              {/* Video Thumbnail/Player */}
              <div className="relative aspect-video bg-black">
                {session.videoURL ? (
                  <video
                    src={session.videoURL}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                )}
                {/* Removed 'Pending analysis' overlay per request */}
                <div className="absolute top-2 right-2">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      session.label === 'good'
                        ? 'bg-green-500 text-white'
                        : 'bg-yellow-500 text-white'
                    }`}
                  >
                    {session.label === 'good' ? 'Good' : 'Needs Work'}
                  </span>
                </div>
              </div>

              {/* Session Info */}
              <div className="p-4">
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={() => onSendToMessenger(session)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                  >
                    <Send className="w-4 h-4" />
                    Send
                  </button>
                  <button
                    onClick={() => onSendToAIBot(session)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium"
                  >
                    <Bot className="w-4 h-4" />
                    AI Bot
                  </button>
                  <Link
                    href={`/drills?sessionId=${encodeURIComponent(session.id)}`}
                    prefetch
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium bg-emerald-600 text-white hover:bg-emerald-700"
                    title="View recommended drills for this session"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Drills
                  </Link>
                  {onSendToOpenRouter && (
                    <button
                      onClick={() => onSendToOpenRouter(session)}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                    >
                      <Sparkles className="w-4 h-4" />
                      Analyze
                    </button>
                  )}
                  {(session as SessionWithAnalysis).videoAnalysisData?.ok ? (
                    <Link
                      href={`/analyze?sessionId=${encodeURIComponent(session.id)}`}
                      prefetch
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium bg-gray-100 text-gray-900 hover:bg-gray-200"
                    >
                      <Play className="w-4 h-4" />
                      View
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-gray-100 text-gray-400 cursor-not-allowed"
                      title="Analysis pending"
                    >
                      <Play className="w-4 h-4" />
                      Pending
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Video Detail Modal */}
      {selectedSession && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Video Details</h2>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                âœ•
              </button>
            </div>
            {selectedSession.videoURL && (
              <video
                src={selectedSession.videoURL}
                controls
                className="w-full rounded-lg mb-4"
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Metrics</h3>
                <div className="space-y-1 text-sm">
                  {(() => {
                    const metrics = getDisplayMetrics(selectedSession as SessionWithAnalysis);
                    return (
                      <>
                        <p>Launch Angle: {metrics.launchAngle.toFixed(1)}°</p>
                        <p>Exit Velocity: {metrics.velocity.toFixed(0)} mph</p>
                        <p>Distance: {metrics.distance.toFixed(0)} ft</p>
                        <p>Zone: {selectedSession.game.zone}</p>
                      </>
                    );
                  })()}
                </div>
              </div>
              <div>
                <h3 className="font-semibold mb-2">Session Info</h3>
                <div className="space-y-1 text-sm">
                  <p>Date: {new Date(selectedSession.createdAt).toLocaleString()}</p>
                  <p>Label: {selectedSession.label}</p>
                  <p>Milestone: {selectedSession.game.milestone}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

