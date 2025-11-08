'use client';

import { useState } from 'react';
import { Video, Send, Bot, Play, Calendar, TrendingUp, ExternalLink } from 'lucide-react';
import type { Session } from '@/types/session';

// Helper function to get video URL through Next.js proxy
function getVideoProxyUrl(videoURL: string | undefined, videoPath: string | undefined): string {
  if (!videoURL && !videoPath) {
    return '';
  }
  
  // If we have a videoPath, use it to construct proxy URL
  // The storage server stores files with the exact path provided, so keep the full path
  if (videoPath) {
    return `/api/storage?path=${encodeURIComponent(videoPath)}`;
  }
  
  // If we have videoURL, try to extract path from it
  if (videoURL) {
    try {
      const url = new URL(videoURL);
      // Extract path after /api/storage/
      const urlPath = url.pathname;
      if (urlPath.startsWith('/api/storage/')) {
        const path = urlPath.substring('/api/storage/'.length);
        return `/api/storage?path=${encodeURIComponent(path)}`;
      }
    } catch {
      // If URL parsing fails, return original URL
      return videoURL;
    }
  }
  
  return videoURL || '';
}

interface VideoGalleryProps {
  sessions: Session[];
  onSendToMessenger: (session: Session) => void;
  onSendToAIBot: (session: Session) => void;
  onSendToOpenRouter?: (session: Session) => void;
  isSendingToOpenRouter?: string | null;
}

export default function VideoGallery({ sessions, onSendToMessenger, onSendToAIBot, onSendToOpenRouter, isSendingToOpenRouter }: VideoGalleryProps) {
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [filter, setFilter] = useState<'all' | 'good' | 'needs_work'>('all');

  const filteredSessions = sessions.filter((session) => {
    if (filter === 'all') return true;
    return session.label === filter;
  });

  const videosWithURLs = filteredSessions.filter((s) => s.videoURL);

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
                    src={getVideoProxyUrl(session.videoURL, session.videoPath)}
                    className="w-full h-full object-cover"
                    controls
                    preload="metadata"
                    onError={(e) => {
                      console.error('Video load error:', e);
                      console.error('Video URL:', session.videoURL);
                      console.error('Video Path:', session.videoPath);
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Video className="w-12 h-12 text-gray-400" />
                  </div>
                )}
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
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <Calendar className="w-4 h-4" />
                  <span>{new Date(session.createdAt).toLocaleDateString()}</span>
                </div>
                <div className="space-y-1 mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <TrendingUp className="w-4 h-4 text-blue-600" />
                    <span className="text-gray-700">
                      Distance: <strong>{session.game.distanceFt.toFixed(0)} ft</strong>
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    Launch: {session.metrics.launchAngleEst.toFixed(1)}° | 
                    Velocity: {session.metrics.exitVelocity} mph
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 flex-wrap">
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
                  {onSendToOpenRouter && (
                    <button
                      onClick={() => onSendToOpenRouter(session)}
                      disabled={isSendingToOpenRouter === session.id}
                      className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSendingToOpenRouter === session.id ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Sending...
                        </>
                      ) : (
                        <>
                          <ExternalLink className="w-4 h-4" />
                          OpenRouter
                        </>
                      )}
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
                ✕
              </button>
            </div>
            {selectedSession.videoURL && (
              <video
                src={getVideoProxyUrl(selectedSession.videoURL, selectedSession.videoPath)}
                controls
                className="w-full rounded-lg mb-4"
                onError={(e) => {
                  console.error('Video load error in modal:', e);
                  console.error('Video URL:', selectedSession.videoURL);
                  console.error('Video Path:', selectedSession.videoPath);
                }}
              />
            )}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <h3 className="font-semibold mb-2">Metrics</h3>
                <div className="space-y-1 text-sm">
                  <p>Launch Angle: {selectedSession.metrics.launchAngleEst.toFixed(1)}°</p>
                  <p>Exit Velocity: {selectedSession.metrics.exitVelocity} mph</p>
                  <p>Distance: {selectedSession.game.distanceFt.toFixed(0)} ft</p>
                  <p>Zone: {selectedSession.game.zone}</p>
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

