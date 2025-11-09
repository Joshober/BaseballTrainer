'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket, Loader2, ArrowLeft, Bot, AlertCircle } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import { getStorageAdapter } from '@/lib/storage';
import CaptureUpload from '@/components/Mission/CaptureUpload';

type VideoAnalysis = {
  ok: boolean;
  error?: string;
  metrics?: {
    batLinearSpeedMph?: number;
    exitVelocityEstimateMph?: number;
    launchAngle?: number;
  };
  formAnalysis?: { feedback?: string[] };
  formErrors?: {
    recommendations?: string[];
    errors?: Array<{ recommendation?: string; description?: string }>;
  };
  contact?: { frame?: number };
  contactFrame?: number;
  [k: string]: any;
};

export default function BlastOffPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [mode, setMode] = useState<'photo' | 'video' | 'manual'>('video');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openRouterFeedback, setOpenRouterFeedback] = useState<string | null>(null);
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);

  const [isAnimationDone, setIsAnimationDone] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Mark animation done once analysis finishes
  useEffect(() => {
    if (!isAnalyzing && videoAnalysis) setIsAnimationDone(true);
  }, [isAnalyzing, videoAnalysis]);

  useEffect(() => {
    const unsubscribe = onAuthChange((authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        setUser(authUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  const handleImageSelect = (file: File) => {
    setSelectedFile(file);
  };

  function formatBlurb(analysis: VideoAnalysis): string {
    const m = (analysis as any).metrics || {};
    const launchAngle = typeof m.launchAngle === 'number' ? m.launchAngle : undefined;
    const exitV =
      typeof m.exitVelocityEstimateMph === 'number'
        ? m.exitVelocityEstimateMph
        : typeof m.batLinearSpeedMph === 'number'
        ? m.batLinearSpeedMph
        : undefined;
    const contactFrame =
      (analysis as any).contact?.frame ?? (analysis as any).contactFrame ?? null;

    const pieces: string[] = [];
    if (typeof launchAngle === 'number') pieces.push(`Launch angle ${launchAngle.toFixed(1)}°`);
    if (typeof exitV === 'number') pieces.push(`exit velocity ${exitV.toFixed(0)} mph`);
    if (contactFrame !== null && contactFrame !== undefined)
      pieces.push(`contact at frame ${contactFrame}`);
    if (pieces.length === 0)
      return 'Analysis completed. Review recommendations below to improve your swing.';
    return `${pieces.join(', ')}.`;
  }

  function extractAllRecommendations(analysis: VideoAnalysis): string[] {
    const recs: string[] = [];
    const formAnalysis: any = (analysis as any).formAnalysis;
    if (formAnalysis && Array.isArray(formAnalysis.feedback)) {
      for (const f of formAnalysis.feedback) {
        if (typeof f === 'string') recs.push(f);
      }
    }
    const formErrors: any = (analysis as any).formErrors;
    if (formErrors) {
      if (Array.isArray(formErrors.recommendations)) {
        for (const r of formErrors.recommendations) {
          if (typeof r === 'string') recs.push(r);
        }
      }
      const errorsArray = Array.isArray(formErrors.errors) ? formErrors.errors : undefined;
      if (errorsArray) {
        for (const e of errorsArray) {
          if (e?.recommendation) recs.push(String(e.recommendation));
          else if (e?.description) recs.push(String(e.description));
        }
      }
    }
    const seen = new Set<string>();
    return recs.filter((r) => {
      const key = r.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function extractTopRecommendations(analysis: VideoAnalysis, limit: number = 2): string[] {
    const all = extractAllRecommendations(analysis);
    return all.slice(0, limit);
  }

  const handleVideoSelect = async (file: File) => {
    setSelectedFile(file);
    setOpenRouterFeedback(null);
    setError(null);
    setVideoAnalysis(null);
    setIsAnalyzing(true);

    try {
      const authUser = getAuthUser();
      const token = getAuthToken();

      if (!authUser || !token) {
        console.error('Blast-off: Missing auth user or token', {
          hasUser: !!authUser,
          hasToken: !!token,
          tokenLength: token?.length,
        });
        throw new Error('User not authenticated. Please sign in again.');
      }

      // Validate token format
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3 && tokenParts.length !== 5) {
        console.error('Blast-off: Invalid token format', {
          parts: tokenParts.length,
          tokenPreview: token.substring(0, 20) + '...',
        });
        throw new Error('Invalid authentication token. Please sign in again.');
      }

      // 1) Upload to storage
      const storage = getStorageAdapter();
      const sessionId = crypto.randomUUID();
      const uid = authUser.sub;
      const ext = file.type.includes('mp4')
        ? 'mp4'
        : file.type.includes('webm')
        ? 'webm'
        : 'mp4';
      const videoPath = `videos/${uid}/${sessionId}.${ext}`;
      const videoURL = await storage.uploadFile(videoPath, file);

      // 2) Create session
      const createResp = await fetch('/api/sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: authUser.sub,
          teamId: 'default',
          photoPath: '',
          photoURL: '',
          videoPath,
          videoURL,
          metrics: {
            launchAngleEst: 28,
            attackAngleEst: null,
            exitVelocity: 0,
            confidence: 0,
          },
          game: { distanceFt: 0, zone: 'unknown', milestone: 'none', progressToNext: 0 },
          label: 'needs_work' as const,
        }),
      });

      if (!createResp.ok) {
        const errorData = await createResp.json().catch(() => ({ error: 'Failed to create session' }));
        throw new Error(errorData.error || errorData.message || 'Failed to create session');
      }
      const createdSession = await createResp.json();

      // 3a) Kick off analysis directly (best-effort) with timeout
      let analysisFound = false;
      try {
        const fd = new FormData();
        fd.append('video', file);
        fd.append('sessionId', createdSession.id);
        if (videoURL) fd.append('videoUrl', videoURL);
        fd.append('processingMode', 'full');
        fd.append('sampleRate', '1');
        fd.append('enableYOLO', 'true');
        fd.append('yoloConfidence', '0.5');

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 min

        const analysisResp = await fetch('/api/pose/analyze-video', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        let analysisResult: any;
        const contentType = analysisResp.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          analysisResult = await analysisResp.json();
        } else {
          const text = await analysisResp.text();
          try {
            analysisResult = JSON.parse(text);
          } catch {
            analysisResult = {
              ok: false,
              error:
                text || analysisResp.statusText || `Analysis failed with status ${analysisResp.status}`,
            };
          }
        }

        if (!analysisResp.ok) {
          const errorMsg =
            analysisResult?.error ||
            analysisResult?.message ||
            analysisResp.statusText ||
            `Analysis failed with status ${analysisResp.status}`;
          throw new Error(errorMsg);
        }

        if (analysisResult?.ok) {
          setVideoAnalysis(analysisResult as VideoAnalysis);
          analysisFound = true;
        } else {
          const errorMsg = analysisResult?.error || analysisResult?.message || 'Analysis error';
          throw new Error(errorMsg);
        }
      } catch (err: any) {
        // Fall back to polling
        let errorMessage =
          err?.name === 'AbortError'
            ? 'Analysis timed out.'
            : err?.message || 'Unknown analysis error';
        console.warn('Direct analysis failed, falling back to polling:', errorMessage);

        const sid = createdSession.id as string;
        const start = Date.now
