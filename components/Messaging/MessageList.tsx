'use client';

import { useEffect, useRef, useState } from 'react';
import type { Message } from '@/types/message';
import type { Session } from '@/types/session';
import { Video, Play, TrendingUp, Target } from 'lucide-react';
import { getFirebaseAuth } from '@/lib/firebase/auth';

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
}

export default function MessageList({ messages, currentUserId }: MessageListProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [sessions, setSessions] = useState<Record<string, Session>>({});

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    // Load sessions for messages that have sessionId
    const loadSessions = async () => {
      const sessionIds = messages
        .filter(m => m.sessionId)
        .map(m => m.sessionId!)
        .filter((id, index, self) => self.indexOf(id) === index); // unique

      if (sessionIds.length === 0) return;

      try {
        const auth = getFirebaseAuth();
        if (!auth?.currentUser) return;
        
        const token = await auth.currentUser.getIdToken();
        const sessionPromises = sessionIds.map(async (sessionId) => {
          const response = await fetch(`/api/sessions/${sessionId}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          if (response.ok) {
            const session: Session = await response.json();
            return { sessionId, session };
          }
          return null;
        });

        const results = await Promise.all(sessionPromises);
        const sessionMap: Record<string, Session> = {};
        results.forEach(result => {
          if (result) {
            sessionMap[result.sessionId] = result.session;
          }
        });
        setSessions(sessionMap);
      } catch (error) {
        console.error('Failed to load sessions:', error);
      }
    };

    loadSessions();
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <p>No messages yet. Start the conversation!</p>
        </div>
      ) : (
        messages.map((message) => {
          const isOwn = message.senderUid === currentUserId;
          return (
            <div
              key={message.id}
              className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[70%] rounded-lg p-3 ${
                  isOwn
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 text-gray-900'
                }`}
              >
                {message.videoURL && (
                  <div className="mb-2 rounded overflow-hidden">
                    <a
                      href={message.videoURL}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="relative block group"
                    >
                      <video
                        src={message.videoURL}
                        className="w-full max-w-md rounded"
                        controls
                        preload="metadata"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-opacity flex items-center justify-center">
                        <Play className="w-12 h-12 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </a>
                  </div>
                )}
                {message.content && (
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                )}
                {message.sessionId && sessions[message.sessionId] && (
                  <div className="mt-2 space-y-2">
                    <div className="flex items-center gap-2 text-xs opacity-75">
                      <Video className="w-3 h-3" />
                      <span>Linked to session</span>
                    </div>
                    {sessions[message.sessionId].videoAnalysis && sessions[message.sessionId].videoAnalysis?.ok && (
                      <div className={`p-3 rounded-lg text-sm ${
                        isOwn 
                          ? 'bg-blue-500 bg-opacity-20 text-blue-100' 
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        <div className="flex items-center gap-2 mb-2 font-semibold">
                          <TrendingUp className="w-4 h-4" />
                          <span>Video Analysis</span>
                        </div>
                        {sessions[message.sessionId].videoAnalysis?.metrics && (
                          <div className="space-y-1 text-xs">
                            <p>Bat Speed: {sessions[message.sessionId].videoAnalysis!.metrics!.batLinearSpeedMph.toFixed(1)} mph</p>
                            <p>Exit Velocity: {sessions[message.sessionId].videoAnalysis!.metrics!.exitVelocityEstimateMph.toFixed(1)} mph</p>
                            {sessions[message.sessionId].videoAnalysis!.contactFrame !== null && (
                              <p>Contact: Frame {sessions[message.sessionId].videoAnalysis!.contactFrame}</p>
                            )}
                          </div>
                        )}
                        {sessions[message.sessionId].videoAnalysis?.formAnalysis?.feedback && 
                         sessions[message.sessionId].videoAnalysis!.formAnalysis!.feedback.length > 0 && (
                          <div className="mt-2 pt-2 border-t border-opacity-20">
                            <div className="flex items-center gap-2 mb-1">
                              <Target className="w-3 h-3" />
                              <span className="font-semibold">Form Feedback:</span>
                            </div>
                            <ul className="list-disc list-inside space-y-1 text-xs">
                              {sessions[message.sessionId].videoAnalysis!.formAnalysis!.feedback.map((fb, idx) => (
                                <li key={idx}>{fb}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <p className="text-xs mt-1 opacity-75">
                  {new Date(message.createdAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          );
        })
      )}
      <div ref={messagesEndRef} />
    </div>
  );
}

