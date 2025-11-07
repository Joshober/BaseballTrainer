'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Video, MessageCircle, Bot, ArrowLeft } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import type { Session } from '@/types/session';
import VideoGallery from '@/components/Dashboard/VideoGallery';

export default function VideosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [showMessengerModal, setShowMessengerModal] = useState(false);
  const [showAIBotModal, setShowAIBotModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        loadSessions();
      }
    });

    return () => unsubscribe();
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
      
      // Create or get AI bot conversation
      // For now, we'll use a special "ai_bot" user ID
      const aiBotUid = 'ai_bot';
      
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverUid: aiBotUid,
          content: 'Please analyze this swing video',
          videoURL: selectedSession.videoURL,
          videoPath: selectedSession.videoPath,
          sessionId: selectedSession.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to send to AI bot');

      setShowAIBotModal(false);
      setSelectedSession(null);
      alert('Video sent to AI bot for analysis!');
      router.push('/messages');
    } catch (error) {
      console.error('Failed to send to AI bot:', error);
      alert('Failed to send to AI bot. Please try again.');
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
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <Video className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">My Videos</h1>
          </div>

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
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => onSend(conv.otherUid)}
                className="w-full text-left px-4 py-3 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <p className="font-medium">{conv.otherUserName || 'Unknown User'}</p>
                {conv.lastMessage && (
                  <p className="text-sm text-gray-600 truncate">{conv.lastMessage}</p>
                )}
              </button>
            ))}
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

