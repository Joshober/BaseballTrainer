'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Video, Send, Bot, Play, Calendar, TrendingUp, Sparkles, X } from 'lucide-react';
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
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<'all' | 'good' | 'needs_work'>('all');
  const [sessionsWithAnalysis, setSessionsWithAnalysis] = useState<SessionWithAnalysis[]>([]);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const previouslyFocusedElementRef = useRef<Element | null>(null);

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
          const data = (await resp.json()) as { map?: Record<string, { analysis?: VideoAnalysis | null } | null> };
          const map = data.map ?? {};
          setSessionsWithAnalysis((prev) =>
            prev.map((item) => {
              const record = map[item.id];
              if (record?.analysis?.ok) {
                return { ...item, videoAnalysisData: record.analysis, pendingAnalysis: false };
              }
              return item;
            })
          );
        }
      } catch {
        // ignore
      }
    };

    if (sessions.length > 0) {
      void init();
    } else {
      Promise.resolve().then(() => {
        setSessionsWithAnalysis([]);
      });
    }
  }, [sessions]);

  // Gentle polling: refresh analysis status for pending sessions
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    const token = getAuthToken();
    if (!token) return;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(async () => {
        try {
          const pending = sessionsWithAnalysis.filter(
            (s) => s.videoURL && (!s.videoAnalysisData || !s.videoAnalysisData.ok)
          );
          if (pending.length === 0) {
            if (interval) {
              clearInterval(interval);
              interval = null;
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
              const data = (await resp.json()) as { map?: Record<string, { analysis?: VideoAnalysis | null } | null> };
              const map = data.map ?? {};
              setSessionsWithAnalysis((prev) =>
                prev.map((item) => {
                  const record = map[item.id];
                  if (record?.analysis?.ok) {
                    return { ...item, videoAnalysisData: record.analysis, pendingAnalysis: false };
                  }
                  return item;
                })
              );
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
      // Calculate distance from exit velocity (rough estimate: 1 mph ~ 0.15 ft)
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

  useEffect(() => {
    if (!selectedSession) {
      return;
    }

    previouslyFocusedElementRef.current = document.activeElement;
    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 0);

    const focusableSelectors =
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setSelectedSession(null);
        return;
      }

      if (event.key !== 'Tab' || !modalRef.current) {
        return;
      }

      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(focusableSelectors)
      ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

      if (focusable.length === 0) {
        event.preventDefault();
        modalRef.current.focus();
        return;
      }

      const firstElement = focusable[0];
      const lastElement = focusable[focusable.length - 1];
      const activeElement = document.activeElement as HTMLElement | null;

      if (!activeElement) {
        return;
      }

      if (!event.shiftKey && activeElement === lastElement) {
        event.preventDefault();
        firstElement.focus();
        return;
      }

      if (event.shiftKey && activeElement === firstElement) {
        event.preventDefault();
        lastElement.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', handleKeyDown);
      const previouslyFocused = previouslyFocusedElementRef.current as HTMLElement | null;
      previouslyFocused?.focus();
      previouslyFocusedElementRef.current = null;
    };
  }, [selectedSession]);

  const filteredSessions = sessionsWithAnalysis.length > 0 ? sessionsWithAnalysis : sessions;
  const filteredByLabel = filteredSessions.filter((session) => {
    if (filter === 'all') return true;
    return session.label === filter;
  });

  const videosWithURLs = filteredByLabel.filter((s) => s.videoURL);
  
  // Debug logging
  console.log('[VideoGallery] Sessions received:', sessions.length);
  console.log('[VideoGallery] Sessions with analysis:', sessionsWithAnalysis.length);
  console.log('[VideoGallery] Filtered sessions:', filteredByLabel.length);
  console.log('[VideoGallery] Videos with URLs:', videosWithURLs.length);
  if (videosWithURLs.length > 0) {
    console.log('[VideoGallery] Video URLs:', videosWithURLs.map(s => s.videoURL));
  }

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'all' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-slate-700 hover:text-slate-900'
          } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600`}
        >
          All Videos ({videosWithURLs.length})
        </button>
        <button
          onClick={() => setFilter('good')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'good' ? 'border-b-2 border-green-600 text-green-600' : 'text-slate-700 hover:text-slate-900'
          } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600`}
        >
          Good Swings ({sessions.filter((s) => s.label === 'good' && s.videoURL).length})
        </button>
        <button
          onClick={() => setFilter('needs_work')}
          className={`px-4 py-2 font-medium transition-colors ${
            filter === 'needs_work' ? 'border-b-2 border-yellow-600 text-yellow-600' : 'text-slate-700 hover:text-slate-900'
          } focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600`}
        >
          Needs Work ({sessions.filter((s) => s.label === 'needs_work' && s.videoURL).length})
        </button>
      </div>

      {videosWithURLs.length === 0 ? (
        <div className="py-12 text-center text-slate-600">
          <Video className="mx-auto mb-4 h-16 w-16 opacity-50" />
          <p>No videos found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {videosWithURLs.map((session) => {
            const sessionWithAnalysis = session as SessionWithAnalysis;
            const analysisReady = !!sessionWithAnalysis.videoAnalysisData?.ok || !!session.videoAnalysis?.ok;

            return (
              <div
                key={session.id}
                className="overflow-hidden rounded-lg bg-white shadow-md transition-shadow hover:shadow-lg"
              >
                <div className="relative aspect-video bg-black">
                  {session.videoURL ? (
                    <video
                      src={session.videoURL}
                      className="h-full w-full object-cover"
                      controls
                      preload="metadata"
                      aria-describedby={`video-transcript-${session.id}`}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Video className="h-12 w-12 text-slate-500" aria-hidden="true" focusable="false" />
                    </div>
                  )}
                  {/* Removed 'Pending analysis' overlay per request */}
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

                <div className="p-4 space-y-4">
                  <div className="flex items-center gap-2 text-sm text-slate-700">
                    <Calendar className="h-4 w-4" aria-hidden="true" focusable="false" />
                    <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                  </div>

                  <p
                    id={`video-transcript-${session.id}`}
                    className="text-xs text-slate-600"
                  >
                    Caption and transcript resources for team videos are tracked in <a
                      href="https://github.com/Joshober/BaseballTrainer/blob/main/docs/media-accessibility.md"
                      className="underline"
                      target="_blank"
                      rel="noopener noreferrer"
                    >media-accessibility.md</a>.
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => onSendToMessenger(session)}
                      className="flex-1 min-w-[120px] rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                    >
                      <Send className="h-4 w-4" aria-hidden="true" focusable="false" />
                      Send
                    </button>
                    <button
                      type="button"
                      onClick={() => onSendToAIBot(session)}
                      className="flex-1 min-w-[120px] rounded-lg bg-purple-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                    >
                      <Bot className="h-4 w-4" aria-hidden="true" focusable="false" />
                      AI Bot
                    </button>
                    <Link
                      href={`/drills?sessionId=${encodeURIComponent(session.id)}`}
                      prefetch
                      className="flex-1 min-w-[120px] rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                      title="View recommended drills for this session"
                    >
                      <TrendingUp className="h-4 w-4" aria-hidden="true" focusable="false" />
                      Drills
                    </Link>
                    {onSendToOpenRouter && (
                      <button
                        type="button"
                        onClick={() => onSendToOpenRouter(session)}
                        className="flex-1 min-w-[120px] rounded-lg bg-orange-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-700 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                      >
                        <Sparkles className="h-4 w-4" aria-hidden="true" focusable="false" />
                        Analyze
                      </button>
                    )}
                    {analysisReady ? (
                      <Link
                        href={`/analyze?sessionId=${encodeURIComponent(session.id)}`}
                        prefetch
                        className="flex-1 min-w-[120px] rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-slate-300 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" focusable="false" />
                        View
                      </Link>
                    ) : (
                      <button
                        type="button"
                        disabled
                        className="flex-1 min-w-[120px] cursor-not-allowed rounded-lg bg-slate-200 px-3 py-2 text-sm font-medium text-slate-500 flex items-center justify-center gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                        title="Analysis pending"
                      >
                        <Play className="h-4 w-4" aria-hidden="true" focusable="false" />
                        Pending
                      </button>
                    )}
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
            ref={modalRef}
            className="mx-4 max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-white p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="video-details-title"
            tabIndex={-1}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-bold" id="video-details-title">Video Details</h2>
              <button
                type="button"
                onClick={() => setSelectedSession(null)}
                ref={closeButtonRef}
                className="text-slate-600 transition-colors hover:text-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" aria-hidden="true" focusable="false" />
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

