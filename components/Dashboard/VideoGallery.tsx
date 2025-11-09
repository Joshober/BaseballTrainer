'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Video, Send, Bot, Play, Calendar } from 'lucide-react';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import type { Session, VideoAnalysis } from '@/types/session';

interface SessionWithAnalysis extends Session {
  videoAnalysisData?: VideoAnalysis | null;
  pendingAnalysis?: boolean;
}

interface VideoGalleryProps {
  sessions: Session[];
  onSendToMessenger: (session: Session) => void;
  onSendToAIBot: (session: Session) => void;
}

export default function VideoGallery({ sessions, onSendToMessenger, onSendToAIBot }: VideoGalleryProps) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<'all' | 'good' | 'needs_work'>('all');
  const [sessionsWithAnalysis, setSessionsWithAnalysis] = useState<SessionWithAnalysis[]>([]);

  useEffect(() => {
    const loadVideoAnalyses = async () => {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) return;

      const sessionsToUpdate: SessionWithAnalysis[] = await Promise.all(
        sessions.map(async (session) => {
          if (session.videoAnalysis) {
            return { ...session, videoAnalysisData: session.videoAnalysis };
          }

          if (session.videoURL) {
            try {
              const response = await fetch(`/api/video-analyses?videoUrl=${encodeURIComponent(session.videoURL)}`, {
                headers: {
                  Authorization: `Bearer ${token}`,
                },
              });

              if (response.ok) {
                const analysis = await response.json();
                if (analysis && analysis.ok) {
                  return { ...session, videoAnalysisData: analysis };
                }
              }
            } catch (error) {
              console.error(`Failed to load analysis for session ${session.id}:`, error);
            }
          }

          return { ...session, videoAnalysisData: null };
        })
      );

      setSessionsWithAnalysis(sessionsToUpdate);
    };

    if (sessions.length > 0) {
      loadVideoAnalyses();
    } else {
      setSessionsWithAnalysis([]);
    }
  }, [sessions]);

  const getDisplayMetrics = (session: SessionWithAnalysis) => {
    const analysis = session.videoAnalysisData || session.videoAnalysis;

    if (analysis && analysis.ok && analysis.metrics) {
      const distance = analysis.metrics.exitVelocityEstimateMph
        ? Math.max(0, Math.round(analysis.metrics.exitVelocityEstimateMph * 0.15))
        : session.game.distanceFt;

      const launchAngle = analysis.metrics.launchAngle ?? session.metrics.launchAngleEst;
      const velocity =
        analysis.metrics.exitVelocityEstimateMph ?? analysis.metrics.batLinearSpeedMph ?? session.metrics.exitVelocity;

      return {
        distance: typeof distance === 'number' ? distance : parseFloat(String(distance)) || 0,
        launchAngle: typeof launchAngle === 'number' ? launchAngle : parseFloat(String(launchAngle)) || 0,
        velocity: typeof velocity === 'number' ? velocity : parseFloat(String(velocity)) || 0,
      };
    }

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
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          All Videos ({videosWithURLs.length})
        </button>
        <button
          onClick={() => setFilter('good')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'good' ? 'border-b-2 border-green-600 text-green-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Good Swings ({sessions.filter((s) => s.label === 'good' && s.videoURL).length})
        </button>
        <button
          onClick={() => setFilter('needs_work')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'needs_work' ? 'border-b-2 border-yellow-600 text-yellow-600' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Needs Work ({sessions.filter((s) => s.label === 'needs_work' && s.videoURL).length})
        </button>
      </div>

      {videosWithURLs.length === 0 ? (
        <div className="py-12 text-center text-gray-500">
          <Video className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <p>No videos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {videosWithURLs.map((session) => {
            const sessionWithAnalysis = session as SessionWithAnalysis;
            const hasAnalysis = !!sessionWithAnalysis.videoAnalysisData?.ok || !!session.videoAnalysis?.ok;

            return (
              <div
                key={session.id}
                className="overflow-hidden rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-video bg-black">
                  {session.videoURL ? (
                    <video src={session.videoURL} className="h-full w-full object-cover" controls preload="metadata" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-12 w-12 text-gray-400" />
                    </div>
                  )}
                  <div className="absolute top-2 right-2">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        session.label === 'good' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'
                      }`}
                    >
                      {session.label === 'good' ? 'Good' : 'Needs Work'}
                    </span>
                  </div>
                </div>

                <div className="p-4">
                  <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => onSendToMessenger(session)}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                    >
                      <Send className="h-4 w-4" />
                      Send
                    </button>
                    <button
                      onClick={() => onSendToAIBot(session)}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
                    >
                      <Bot className="h-4 w-4" />
                      AI Bot
                    </button>
                    {hasAnalysis ? (
                      <Link
                        href={`/analyze?sessionId=${encodeURIComponent(session.id)}`}
                        prefetch
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-900 transition-colors hover:bg-gray-200"
                      >
                        <Play className="h-4 w-4" />
                        View
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-400"
                        title="Analysis pending"
                      >
                        <Play className="h-4 w-4" />
                        Pending
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setSelectedSession(session)}
                      className="flex-1 min-w-[120px] flex items-center justify-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-gray-700 ring-1 ring-gray-200 transition-colors hover:bg-gray-50"
                    >
                      <Video className="h-4 w-4" />
                      Details
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedSession && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          onClick={() => setSelectedSession(null)}
        >
          <div
            className="mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Video Details</h2>
              <button
                onClick={() => setSelectedSession(null)}
                className="text-gray-500 transition-colors hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            {selectedSession.videoURL && (
              <video src={selectedSession.videoURL} controls className="mb-4 w-full rounded-lg" />
            )}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <h3 className="mb-2 font-semibold">Metrics</h3>
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
                <h3 className="mb-2 font-semibold">Session Info</h3>
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

