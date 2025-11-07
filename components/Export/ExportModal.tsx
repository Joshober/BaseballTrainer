'use client';

import React, { useState } from 'react';
import { X, Download, Share2, Copy, FileText, FileJson, Link as LinkIcon, CheckCircle } from 'lucide-react';
import { exportSessionsToCSV, exportSessionsToJSON, downloadCSV, downloadJSON, generateSessionShareLink, copyToClipboard, shareSession } from '@/lib/utils/export';
import type { Session } from '@/types/session';

interface ExportModalProps {
  sessions: Session[];
  selectedSession?: Session | null;
  onClose: () => void;
}

export default function ExportModal({ sessions, selectedSession, onClose }: ExportModalProps) {
  const [exporting, setExporting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  const handleExportCSV = () => {
    setExporting(true);
    try {
      const csv = exportSessionsToCSV(selectedSession ? [selectedSession] : sessions);
      const filename = selectedSession
        ? `session-${selectedSession.id}.csv`
        : `sessions-${new Date().toISOString().split('T')[0]}.csv`;
      downloadCSV(csv, filename);
    } catch (error) {
      console.error('Failed to export CSV:', error);
      alert('Failed to export CSV. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleExportJSON = () => {
    setExporting(true);
    try {
      const json = exportSessionsToJSON(selectedSession ? [selectedSession] : sessions);
      const filename = selectedSession
        ? `session-${selectedSession.id}.json`
        : `sessions-${new Date().toISOString().split('T')[0]}.json`;
      downloadJSON(json, filename);
    } catch (error) {
      console.error('Failed to export JSON:', error);
      alert('Failed to export JSON. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!selectedSession) return;
    
    setCopied(false);
    try {
      const link = generateSessionShareLink(selectedSession.id);
      const success = await copyToClipboard(link);
      if (success) {
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } else {
        alert('Failed to copy link. Please try again.');
      }
    } catch (error) {
      console.error('Failed to copy link:', error);
      alert('Failed to copy link. Please try again.');
    }
  };

  const handleShare = async () => {
    if (!selectedSession) return;
    
    setSharing(true);
    try {
      const success = await shareSession(selectedSession);
      if (!success) {
        // Fallback to copy link
        await handleCopyLink();
      }
    } catch (error) {
      console.error('Failed to share:', error);
      alert('Failed to share. Please try again.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Export & Share</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {/* Export Options */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Export Data</h3>
            <div className="space-y-2">
              <button
                onClick={handleExportCSV}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-4 py-3 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileText className="w-5 h-5" />
                <span className="font-medium">Export as CSV</span>
                <Download className="w-4 h-4 ml-auto" />
              </button>
              <button
                onClick={handleExportJSON}
                disabled={exporting}
                className="w-full flex items-center gap-3 px-4 py-3 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FileJson className="w-5 h-5" />
                <span className="font-medium">Export as JSON</span>
                <Download className="w-4 h-4 ml-auto" />
              </button>
            </div>
            <p className="mt-2 text-sm text-gray-500">
              {selectedSession ? 'Exporting 1 session' : `Exporting ${sessions.length} sessions`}
            </p>
          </div>

          {/* Share Options */}
          {selectedSession && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Share Session</h3>
              <div className="space-y-2">
                <button
                  onClick={handleShare}
                  disabled={sharing}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Share2 className="w-5 h-5" />
                  <span className="font-medium">Share via...</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  disabled={copied}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {copied ? (
                    <>
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium text-green-600">Link Copied!</span>
                    </>
                  ) : (
                    <>
                      <LinkIcon className="w-5 h-5" />
                      <span className="font-medium">Copy Share Link</span>
                      <Copy className="w-4 h-4 ml-auto" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

