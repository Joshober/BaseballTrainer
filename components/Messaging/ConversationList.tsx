'use client';

import React from 'react';
import type { Conversation } from '@/types/message';
import { MessageCircle } from 'lucide-react';

interface ConversationListProps {
  conversations: Conversation[];
  currentUserId: string;
  selectedConversationId: string | null;
  onSelectConversation: (conversationId: string, otherUid: string) => void;
  getUserName: (uid: string) => Promise<string>;
}

export default function ConversationList({
  conversations,
  currentUserId,
  selectedConversationId,
  onSelectConversation,
  getUserName,
}: ConversationListProps) {
  const [userNames, setUserNames] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    const loadUserNames = async () => {
      const names: Record<string, string> = {};
      for (const conv of conversations) {
        const otherUid = conv.participant1Uid === currentUserId 
          ? conv.participant2Uid 
          : conv.participant1Uid;
        if (!names[otherUid]) {
          names[otherUid] = await getUserName(otherUid);
        }
      }
      setUserNames(names);
    };
    loadUserNames();
  }, [conversations, currentUserId, getUserName]);

  if (conversations.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <div className="text-center">
          <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>No conversations yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-y-auto">
      {conversations.map((conv) => {
        const otherUid = conv.participant1Uid === currentUserId 
          ? conv.participant2Uid 
          : conv.participant1Uid;
        const otherName = otherUid === 'ai_bot' 
          ? '🤖 AI Coach Bot' 
          : (userNames[otherUid] || 'Unknown User');
        const isSelected = conv.id === selectedConversationId;
        const lastMessage = conv.lastMessage;
        const preview = lastMessage?.content?.substring(0, 50) || 'No messages yet';

        return (
          <button
            key={conv.id}
            onClick={() => onSelectConversation(conv.id, otherUid)}
            className={`w-full text-left p-4 border-b hover:bg-gray-50 transition-colors ${
              isSelected ? 'bg-blue-50 border-blue-200' : ''
            }`}
          >
            <div className="flex items-start justify-between mb-1">
              <h3 className="font-semibold text-gray-900">{otherName}</h3>
              {conv.unreadCount > 0 && (
                <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-0.5">
                  {conv.unreadCount}
                </span>
              )}
            </div>
            {lastMessage && (
              <p className="text-sm text-gray-600 truncate">{preview}</p>
            )}
            {lastMessage && (
              <p className="text-xs text-gray-400 mt-1">
                {new Date(lastMessage.createdAt).toLocaleDateString()}
              </p>
            )}
          </button>
        );
      })}
    </div>
  );
}

