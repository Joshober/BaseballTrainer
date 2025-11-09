'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Upload,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  Activity,
  Target,
  Zap,
  Sparkles,
  Bot,
} from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import type { VideoAnalysis } from '@/types/session';
import AnalysisAnimation from '@/components/Analysis/AnalysisAnimation';

export default function AnalyzePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);

  const [analyzing, setAnalyzing] = useState(false);
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentFrame, setCurrentFrame] = useState(0);

  const [loadingVideoFromUrl, setLoadingVideoFromUrl] = useState(false);
  const [polling, setPolling] = useState(false);
  const [lastCheckedAt, setLastCheckedAt] = useState<Date | null>(null);
  const [guarding, setGuarding] = useState(false);

  const [showOpenRouterModal, setShowOpenRouterModal] = useState(false);
  const [openRouterFeedback, setOpenRouterFeedback] = useState<string | null>(null);
  const [isAnalyzingWithOpenRouter, setIsAnalyzingWithOpenRouter] = useState(false);

  useEffect(() => {
    let mounted = true;
    let authChecked = false;

    const checkAuth = () => {
      if (!mounted || authChecked) return;

      const authUser = getAuthUser();
      const token = getAuthToken();

      if (!authUser || !token) {
        authChecked = true;
        setLoading(false);
        setTimeout(() => {
          if (mounted) router.push('/login');
        }, 100);
        return;
      }

      authChecked = true;
      setUser(authUser);
      setLoading(false);
    };

    checkAuth();

    const timeout = setTimeout(() => {
      if (mounted && !authChecked) {
        authChecked = true;
        const authUser = getAuthUser();
        const token = getAuthToken();
        if (!authUser || !token) {
          setLoading(false);
          router.push('/login');
        } else {
          setUser(authUser);
          setLoading(false);
        }
      }
    }, 2000);

    const unsubscribe = onAuthChange((authUser) => {
      if (!mounted) return;
      if (!authUser) {
        setLoading(false);
        router.push('/login');
      } else {
        setUser(authUser);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeout);
      unsubscribe();
    };
  }, [router]);

  // Guard: if sessionId is provided, only allow access when analysis exists
  useEffect(() => {
    const sessionIdParam = searchParams?.get('sessionId');
    if (!sessionIdParam || !user) return;

    const run = async () => {
      setGuarding(true);
      try {
        const token = getAuthToken();
        if (!token) {
          router.push('/login');
          return;
        }
        const resp = await fetch(
          `/api/video-analyses?sessionId=${encodeURIComponent(sessionIdParam)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (resp.ok) {
          const data = await resp.json();
          if (data?.ok) {
            setAnalysis(data);
            // fall through; next effect will load session for video URL
          } else {
            router.replace(
              `/videos?analysis=pending&sessionId=${encodeURIComponent(sessionIdParam)}`
            );
            return;
          }
        } else {
          router.replace('/videos');
          return;
        }
      } catch {
        router.replace('/videos');
        return;
      } finally {
        setGuarding(false);
      }
    };
    run();
  }, [searchParams, user, router]);

  // Check for videoUrl or sessionId query parameter and load video/analysis
  useEffect(() => {
    const videoUrlParam = searchParams?.get('videoUrl');
    const sessionIdParam = searchParams?.get('sessionId');

    const loadFromSession = async (sessionId: string) => {
      try {
        const token = getAuthToken();
        if (!token) return;
        const [sessionRes, analysisRes] = await Promise.all([
          fetch(`/api/sessions/${encodeURIComponent(sessionId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`/api/video-analyses?sessionId=${encodeURIComponent(sessionId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (sessionRes.ok) {
          const session = await sessionRes.json();
          if (session?.videoURL && !videoUrl) {
            setVideoUrl(session.videoURL);
          }
          if (session?.videoAnalysis?.ok && !analysis) {
            setAnalysis(session.videoAnalysis);
          }
        }

        if (analysisRes.ok) {
          const stored = await analysisRes.json();
          if (stored?.ok) {
            setAnalysis(stored);
          }
        }
      } catch {
        // Ignore; page can still analyze manually
      }
    };

    if (sessionIdParam && user) {
      loadFromSession(sessionIdParam);
    }

    if (videoUrlParam && user && !selectedFile && !loadingVideoFromUrl) {
      loadVideoFromUrl(videoUrlParam);
    }
  }, [searchParams, user, selectedFile, loadingVideoFromUrl, videoUrl, analysis]);

  // Gentle polling for stored analysis when a sessionId is provided
  useEffect(() => {
    const sessionIdParam = searchParams?.get('sessionId');
    if (!user || !sessionIdParam) return;
    if (analysis?.ok) return;

    let interval: ReturnType<typeof setInterval> | null = null;
    const token = getAuthToken();
    if (!token) return;

    setPolling(true);
    interval = setInterval(async () => {
      try {
        const resp = await fetch(
          `/api/video-analyses?sessionId=${encodeURIComponent(sessionIdParam)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setLastCheckedAt(new Date());
        if (resp.ok) {
          const data = await resp.json();
          if (data && data.ok) {
            setAnalysis(data);
            if (interval) {
              clearInterval(interval as unknown as number);
              interval = null;
              setPolling(false);
            }
          }
        }
      } catch {
        // ignore
      }
    }, 5000);

    return () => {
      if (interval) clearInterval(interval as unknown as number);
    };
