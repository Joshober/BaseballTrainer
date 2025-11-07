'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, ArrowLeft } from 'lucide-react';
import { onAuthChange, getFirebaseAuth } from '@/lib/firebase/auth';
import type { Message, Conversation } from '@/types/message';
import type { Session } from '@/types/session';
import MessageList from '@/components/Messaging/MessageList';
import MessageInput from '@/components/Messaging/MessageInput';
import ConversationList from '@/components/Messaging/ConversationList';

export default function MessagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [selectedOtherUid, setSelectedOtherUid] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        loadConversations();
      }
    });

    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (selectedOtherUid && user) {
      loadMessages(user.uid, selectedOtherUid);
      markMessagesAsRead(user.uid, selectedOtherUid);
    }
  }, [selectedOtherUid, user]);

  useEffect(() => {
    if (user) {
      loadSessions();
    }
  }, [user]);

  const loadConversations = async () => {
    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return;
      
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/conversations', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load conversations');
      
      const data: Conversation[] = await response.json();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMessages = async (uid1: string, uid2: string) => {
    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return;
      
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/messages?uid1=${uid1}&uid2=${uid2}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) throw new Error('Failed to load messages');
      
      const data: Message[] = await response.json();
      setMessages(data);
    } catch (error) {
      console.error('Failed to load messages:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return;
      
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/sessions?uid=${auth.currentUser.uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data: Session[] = await response.json();
        setSessions(data.filter(s => s.videoURL));
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const markMessagesAsRead = async (uid1: string, uid2: string) => {
    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return;
      
      const token = await auth.currentUser.getIdToken();
      await fetch('/api/messages/read', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ uid1, uid2 }),
      });
    } catch (error) {
      console.error('Failed to mark messages as read:', error);
    }
  };

  const handleSendMessage = async (content: string, videoURL?: string, videoPath?: string, sessionId?: string) => {
    if (!user || !selectedOtherUid) return;

    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return;
      
      const token = await auth.currentUser.getIdToken();
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          receiverUid: selectedOtherUid,
          content,
          videoURL,
          videoPath,
          sessionId,
        }),
      });

      if (!response.ok) throw new Error('Failed to send message');
      
      const newMessage: Message = await response.json();
      setMessages([...messages, newMessage]);
      loadConversations(); // Refresh conversations to update last message
    } catch (error) {
      console.error('Failed to send message:', error);
      throw error;
    }
  };

  const handleSelectConversation = (conversationId: string, otherUid: string) => {
    setSelectedConversationId(conversationId);
    setSelectedOtherUid(otherUid);
  };

  const getUserName = async (uid: string): Promise<string> => {
    if (userNames[uid]) {
      return userNames[uid];
    }

    try {
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) return 'Unknown User';
      
      const token = await auth.currentUser.getIdToken();
      const response = await fetch(`/api/users?uid=${uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        const name = userData.displayName || userData.email || 'Unknown User';
        setUserNames({ ...userNames, [uid]: name });
        return name;
      }
    } catch (error) {
      console.error('Failed to get user name:', error);
    }

    return 'Unknown User';
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
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.push('/')}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <MessageCircle className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Messages</h1>
          </div>

          <div className="bg-white rounded-lg shadow-lg overflow-hidden" style={{ height: 'calc(100vh - 200px)' }}>
            <div className="flex h-full">
              {/* Conversation List Sidebar */}
              <div className="w-1/3 border-r flex flex-col">
                <div className="p-4 border-b bg-gray-50">
                  <h2 className="font-semibold text-gray-900">Conversations</h2>
                </div>
                <div className="flex-1 overflow-hidden">
                  <ConversationList
                    conversations={conversations}
                    currentUserId={user?.uid || ''}
                    selectedConversationId={selectedConversationId}
                    onSelectConversation={handleSelectConversation}
                    getUserName={getUserName}
                  />
                </div>
              </div>

              {/* Messages Area */}
              <div className="flex-1 flex flex-col">
                {selectedOtherUid ? (
                  <>
                    <div className="p-4 border-b bg-gray-50">
                      <h2 className="font-semibold text-gray-900">
                        {userNames[selectedOtherUid] || 'Loading...'}
                      </h2>
                    </div>
                    <MessageList
                      messages={messages}
                      currentUserId={user?.uid || ''}
                    />
                    <MessageInput
                      onSend={handleSendMessage}
                      sessions={sessions}
                    />
                  </>
                ) : (
                  <div className="flex-1 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <MessageCircle className="w-16 h-16 mx-auto mb-4 opacity-50" />
                      <p>Select a conversation to start messaging</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

