'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Loader2, Target, AlertCircle, Volume2, Square } from 'lucide-react';
import { getDrillRecommendations, type Drill, type RecommendationRequest } from '@/lib/services/drill-recommender';
import { getAuthToken } from '@/lib/auth0/client';
import DrillCard from './DrillCard';
import { BASEBALL_VOICE_OPTIONS, generateDrillNarration, type BaseballVoice } from '@/lib/services/elevenlabs';

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
  const [selectedVoice, setSelectedVoice] = useState<BaseballVoice>('dominican');
  const [narrationLoading, setNarrationLoading] = useState(false);
  const [narrationError, setNarrationError] = useState<string | null>(null);
  const [isNarrating, setIsNarrating] = useState(false);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (corrections.length > 0 || metrics) {
      loadRecommendations();
    }
  }, [corrections, metrics]);

  useEffect(() => {
    const audioElement = new Audio();
    audioElementRef.current = audioElement;

    const handleEnded = () => {
      setIsNarrating(false);
    };

    audioElement.addEventListener('ended', handleEnded);

    return () => {
      audioElement.removeEventListener('ended', handleEnded);
      audioElement.pause();
      audioElementRef.current = null;
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

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

  const narrationText = useMemo(() => {
    if (recommendations.length === 0) {
      return '';
    }

    const introParts: string[] = [];

    if (typeof metrics?.launchAngle === 'number') {
      introParts.push(`Launch angle clocked in at ${metrics.launchAngle.toFixed(1)} degrees.`);
    }

    if (typeof metrics?.shoulderAngle === 'number') {
      introParts.push(`Shoulder tilt measured ${metrics.shoulderAngle.toFixed(1)} degrees.`);
    }

    if (typeof metrics?.hipAngle === 'number') {
      introParts.push(`Hip rotation landed around ${metrics.hipAngle.toFixed(1)} degrees.`);
    }

    if (typeof metrics?.handAngle === 'number') {
      introParts.push(`Hand path angle registered ${metrics.handAngle.toFixed(1)} degrees.`);
    }

    if (typeof metrics?.confidence === 'number') {
      introParts.push(`Model confidence is ${(metrics.confidence * 100).toFixed(0)} percent.`);
    }

    const correctionSummary =
      corrections.length > 0
        ? `We are zeroing in on ${corrections.map((c) => c.replace(/_/g, ' ')).join(', ')}.`
        : '';

    const drillBreakdown = recommendations.map((drill, index) => {
      const instructionPreview = drill.instructions?.slice(0, 2).join('. ') ?? '';
      const correctionFocus =
        drill.corrections && drill.corrections.length > 0
          ? `Focus areas: ${drill.corrections.map((c) => c.replace(/_/g, ' ')).join(', ')}.`
          : '';

      return `Drill ${index + 1}: ${drill.name}. ${drill.description}. ${instructionPreview} ${correctionFocus}`;
    });

    const outro =
      'Finish strong and repeat each drill with intent. When you are ready for more feedback, come back and we will break it down again.';

    return [
      `Alright slugger, here is your personalized work set with ${recommendations.length} drills.`,
      correctionSummary,
      introParts.join(' '),
      ...drillBreakdown,
      outro,
    ]
      .filter(Boolean)
      .join(' ');
  }, [recommendations, corrections, metrics]);

  const stopNarration = useCallback(() => {
    if (audioElementRef.current) {
      audioElementRef.current.pause();
      audioElementRef.current.currentTime = 0;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current);
      audioUrlRef.current = null;
    }
    setIsNarrating(false);
    setNarrationLoading(false);
  }, []);

  const handleNarration = useCallback(async () => {
    if (!narrationText) {
      return;
    }

    try {
      if (isNarrating) {
        stopNarration();
        return;
      }

      setNarrationError(null);
      setNarrationLoading(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      const narrationBlob = await generateDrillNarration({
        text: narrationText,
        voice: selectedVoice,
        signal: controller.signal,
      });

      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }

      const audioUrl = URL.createObjectURL(narrationBlob);
      audioUrlRef.current = audioUrl;

      if (!audioElementRef.current) {
        audioElementRef.current = new Audio();
      }

      audioElementRef.current.src = audioUrl;
      await audioElementRef.current.play();
      setIsNarrating(true);
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return;
      }
      console.error('Narration error:', err);
      setNarrationError(err?.message || 'Failed to play narration');
      stopNarration();
    } finally {
      setNarrationLoading(false);
      abortControllerRef.current = null;
    }
  }, [narrationText, selectedVoice, isNarrating, stopNarration]);

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

      <div className="mb-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <label className="flex flex-col sm:flex-row sm:items-center gap-2 text-sm text-gray-700">
            <span className="font-medium">Select clubhouse voice:</span>
            <select
              value={selectedVoice}
              onChange={(event) =>
                setSelectedVoice(event.target.value as BaseballVoice)
              }
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {BASEBALL_VOICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <button
            onClick={handleNarration}
            disabled={narrationLoading || recommendations.length === 0}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
          >
            {narrationLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Voice Feedback...
              </>
            ) : isNarrating ? (
              <>
                <Square className="h-4 w-4" />
                Stop Playback
              </>
            ) : (
              <>
                <Volume2 className="h-4 w-4" />
                Play Voice Feedback
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          {BASEBALL_VOICE_OPTIONS.find((option) => option.value === selectedVoice)
            ?.description || ''}
        </p>
        {narrationError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{narrationError}</span>
          </div>
        )}
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

