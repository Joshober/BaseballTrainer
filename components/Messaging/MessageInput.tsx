'use client';

import { useState, useRef } from 'react';
import { Send, Video, Upload } from 'lucide-react';

interface MessageInputProps {
  onSend: (content: string, videoURL?: string, videoPath?: string, sessionId?: string) => Promise<void>;
  onAttachVideo?: () => void;
  sessions?: Array<{ id: string; videoURL?: string; createdAt: Date | string }>;
}

export default function MessageInput({ onSend, onAttachVideo, sessions }: MessageInputProps) {
  const [content, setContent] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = async () => {
    if (!content.trim() && !showSessionPicker) return;
    
    setIsSending(true);
    try {
      await onSend(content.trim());
      setContent('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachSession = async (sessionId: string, videoURL?: string) => {
    setIsSending(true);
    try {
      await onSend(`Check out my swing!`, videoURL, undefined, sessionId);
      setShowSessionPicker(false);
    } catch (error) {
      console.error('Failed to attach session:', error);
      alert('Failed to attach session. Please try again.');
    } finally {
      setIsSending(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('video/')) {
      alert('Please select a video file');
      return;
    }

    setIsSending(true);
    try {
      // Use storage adapter to upload file (uses ngrok URL)
      const { getStorageAdapter } = await import('@/lib/storage');
      const storage = getStorageAdapter();
      
      // Generate path for the file
      const sessionId = crypto.randomUUID();
      const ext = file.type.includes('mp4') ? 'mp4' : 'webm';
      const path = `messages/${sessionId}.${ext}`;
      
      // Upload file using storage adapter (will use ngrok URL)
      const videoURL = await storage.uploadFile(path, file);
      
      // Extract path from URL if needed, or use the path we created
      await onSend('', videoURL, path);
    } catch (error) {
      console.error('Failed to upload video:', error);
      alert('Failed to upload video. Please try again.');
    } finally {
      setIsSending(false);
      if (e.target) {
        e.target.value = '';
      }
    }
  };

  return (
    <div className="border-t bg-white p-4">
      {showSessionPicker && sessions && sessions.length > 0 && (
        <div className="mb-2 p-2 bg-gray-50 rounded-lg max-h-32 overflow-y-auto">
          <p className="text-xs text-gray-600 mb-2">Attach a session:</p>
          <div className="space-y-1">
            {sessions.map((session) => (
              <button
                key={session.id}
                onClick={() => handleAttachSession(session.id, session.videoURL)}
                className="w-full text-left px-2 py-1 text-sm hover:bg-gray-200 rounded flex items-center gap-2"
              >
                <Video className="w-4 h-4" />
                <span>Session from {new Date(session.createdAt).toLocaleDateString()}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-end gap-2">
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
            }}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            className="w-full px-4 py-2 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
            rows={1}
            disabled={isSending}
          />
        </div>
        {sessions && sessions.length > 0 && (
          <button
            onClick={() => setShowSessionPicker(!showSessionPicker)}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Attach session"
          >
            <Video className="w-5 h-5" />
          </button>
        )}
        <label className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer">
          <Upload className="w-5 h-5" />
          <input
            type="file"
            accept="video/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={isSending}
          />
        </label>
        <button
          onClick={handleSend}
          disabled={isSending || (!content.trim() && !showSessionPicker)}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Send className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

