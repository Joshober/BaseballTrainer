'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { getAuthToken } from '@/lib/auth0/client';

export default function NotificationBell() {
  const router = useRouter();
  const [unreadCount, setUnreadCount] = useState(0);

  const loadUnreadCount = useCallback(async () => {
    try {
      const token = getAuthToken();
      if (!token) return;

      const response = await fetch('/api/conversations', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const conversations = await response.json();
        const totalUnread = conversations.reduce((sum: number, conv: any) => sum + (conv.unreadCount || 0), 0);
        setUnreadCount(totalUnread);
      }
    } catch (error) {
      console.error('Failed to load unread count:', error);
    }
  }, []);

  useEffect(() => {
    void loadUnreadCount();
    const interval = setInterval(() => {
      void loadUnreadCount();
    }, 30000);
    return () => clearInterval(interval);
  }, [loadUnreadCount]);

  return (
    <button
      onClick={() => router.push('/messages')}
      className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
      title="Messages"
      aria-label="Open messages"
    >
      <Bell className="w-5 h-5 text-gray-700" aria-hidden="true" focusable="false" />
      {unreadCount > 0 && (
        <span
          className="absolute top-0 right-0 w-5 h-5 bg-red-600 text-white text-xs rounded-full flex items-center justify-center font-bold"
          role="status"
          aria-live="polite"
        >
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}

