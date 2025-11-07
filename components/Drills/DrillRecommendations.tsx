'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Target, AlertCircle } from 'lucide-react';
import { getDrillRecommendations, type Drill, type RecommendationRequest } from '@/lib/services/drill-recommender';
import { getAuthToken } from '@/lib/auth0/client';
import DrillCard from './DrillCard';

interface DrillRecommendationsProps {
  corrections?: string[];
  metrics?: {
    launchAngle?: number;
    shoulderAngle?: number;
    hipAngle?: number;
    handAngle?: number;
    confidence?: number;
  };
  limit?: number;
  onDrillSelect?: (drill: Drill) => void;
}

export default function DrillRecommendations({
  corrections = [],
  metrics,
  limit = 5,
  onDrillSelect,
}: DrillRecommendationsProps) {
  const [recommendations, setRecommendations] = useState<Drill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (corrections.length > 0 || metrics) {
      loadRecommendations();
    }
  }, [corrections, metrics]);

  const loadRecommendations = async () => {
    setLoading(true);
    setError(null);

    try {
      const token = getAuthToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const request: RecommendationRequest = {
        corrections,
        metrics,
        limit,
      };

      const response = await getDrillRecommendations(request, token);
      
      if (response.success) {
        setRecommendations(response.recommendations);
      } else {
        throw new Error('Failed to get recommendations');
      }
    } catch (err: any) {
      console.error('Failed to load drill recommendations:', err);
      setError(err.message || 'Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center justify-center gap-2 text-gray-600">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span>Loading drill recommendations...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 text-red-600">
          <AlertCircle className="w-5 h-5" />
          <span>{error}</span>
        </div>
      </div>
    );
  }

  if (recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center gap-2 text-gray-500">
          <Target className="w-5 h-5" />
          <span>No drill recommendations available. Complete a swing analysis to get personalized drills!</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-6">
        <Target className="w-6 h-6 text-blue-600" />
        <h2 className="text-xl font-bold text-gray-900">Recommended Drills</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {recommendations.map((drill) => (
          <DrillCard
            key={drill._id}
            drill={drill}
            onSelect={onDrillSelect}
          />
        ))}
      </div>
    </div>
  );
}

