'use client';

import React from 'react';
import type { GeminiDrill } from '@/types/session';

interface GeminiDrillCardProps {
  drill: GeminiDrill;
}

const getYouTubeVideoId = (url: string): string | null => {
  const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
  const match = url.match(regex);
  return match ? match[1] : null;
};

export default function GeminiDrillCard({ drill }: GeminiDrillCardProps) {
  const videoId = getYouTubeVideoId(drill.youtubeUrl);
  const embedUrl = videoId ? `https://www.youtube.com/embed/${videoId}` : null;

  return (
    <div className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow overflow-hidden">
      {embedUrl ? (
        <div className="aspect-video bg-black">
          <iframe
            className="w-full h-full"
            src={embedUrl}
            title={drill.name}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
          ></iframe>
        </div>
      ) : (
        <div className="aspect-video bg-gray-200 flex items-center justify-center text-gray-500">
          No video available
        </div>
      )}
      <div className="p-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{drill.name}</h3>
        <p className="text-sm text-gray-600 mb-3">{drill.description}</p>
        {drill.rationale && (
          <div className="mt-3 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
            <strong className="block mb-1">Why this drill helps:</strong>
            {drill.rationale}
          </div>
        )}
      </div>
    </div>
  );
}

