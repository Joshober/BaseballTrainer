'use client';

import { useState, useEffect, useRef } from 'react';
import { RefreshCw, Loader2 } from 'lucide-react';
import { estimateAnglesFromImage } from '@/lib/pose/client';
import type { PoseResult } from '@/types/pose';

interface PosePreviewProps {
  imageUrl: string;
  onResult: (result: PoseResult) => void;
  useServer?: boolean;
}

export default function PosePreview({ imageUrl, onResult, useServer = false }: PosePreviewProps) {
  const [result, setResult] = useState<PoseResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const getAuthToken = async (): Promise<string> => {
    const { getFirebaseAuth } = await import('@/lib/firebase/auth');
    const auth = getFirebaseAuth();
    const user = auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    return user.getIdToken();
  };

  useEffect(() => {
    if (imageUrl) {
      runDetection();
    }
  }, [imageUrl]);

  const runDetection = async () => {
    if (!imgRef.current) return;

    setLoading(true);
    setError(null);

    try {
      if (useServer) {
        // Server-side detection
        const formData = new FormData();
        const response = await fetch(imageUrl);
        const blob = await response.blob();
        formData.append('image', blob, 'image.jpg');

        const authToken = await getAuthToken();
        const res = await fetch('/api/pose', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${authToken}`,
          },
          body: formData,
        });

        const data = await res.json();
        setResult(data);
        onResult(data);
      } else {
        // Client-side detection
        const poseResult = await estimateAnglesFromImage(imgRef.current);
        setResult(poseResult);
        onResult(poseResult);
      }
    } catch (err) {
      console.error('Pose detection error:', err);
      setError('Failed to detect pose');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="relative rounded-lg overflow-hidden bg-gray-100">
        <img
          ref={imgRef}
          src={imageUrl}
          alt="Swing preview"
          className="w-full h-auto"
          onLoad={() => {
            if (!result) runDetection();
          }}
        />
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
        )}
      </div>

      {result?.ok && (
        <div className="p-4 bg-blue-50 rounded-lg space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-blue-900">Pose Detection Results</h3>
            <button
              onClick={runDetection}
              className="p-2 text-blue-600 hover:bg-blue-100 rounded transition-colors"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Launch Angle:</span>
              <span className="ml-2 font-semibold text-blue-900">
                {result.launchAngleEst?.toFixed(1)}°
              </span>
            </div>
            <div>
              <span className="text-gray-600">Attack Angle:</span>
              <span className="ml-2 font-semibold text-blue-900">
                {result.attackAngleEst?.toFixed(1) ?? 'N/A'}°
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-gray-600">Confidence:</span>
              <span className="ml-2 font-semibold text-blue-900">
                {(result.confidence! * 100).toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg">
          {error}
        </div>
      )}

      {result && !result.ok && (
        <div className="p-4 bg-yellow-50 text-yellow-700 rounded-lg">
          Could not detect pose. Please try another image.
        </div>
      )}
    </div>
  );
}

