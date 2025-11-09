'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
<<<<<<< Updated upstream
<<<<<<< Updated upstream
import { Rocket, Loader2, Video, ArrowLeft, Camera } from 'lucide-react';
=======
import { Rocket, Loader2, ArrowLeft, Bot, AlertCircle } from 'lucide-react';
>>>>>>> Stashed changes
=======
import { Rocket, Loader2, ArrowLeft, Bot, AlertCircle } from 'lucide-react';
>>>>>>> Stashed changes
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import CaptureUpload from '@/components/Mission/CaptureUpload';

export default function BlastOffPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<'photo' | 'video' | 'manual'>('video');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
<<<<<<< Updated upstream
<<<<<<< Updated upstream
  const [videoAnalysis, setVideoAnalysis] = useState<VideoAnalysis | null>(null);
  const [analyzingVideo, setAnalyzingVideo] = useState(false);
<<<<<<< Updated upstream
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
=======
  const [isAnimationDone, setIsAnimationDone] = useState(false);
  const [showMoreInfo, setShowMoreInfo] = useState(false);
  const resultsRef = useRef<HTMLDivElement | null>(null);

  // Mark animation done once analysis finishes (fallback if no separate animation completion hook)
  useEffect(() => {
    if (!analyzingVideo && videoAnalysis) {
      setIsAnimationDone(true);
    }
  }, [analyzingVideo, videoAnalysis]);

  function formatBlurb(analysis: VideoAnalysis): string {
    const m = (analysis as any).metrics || {};
    const launchAngle = typeof m.launchAngle === 'number' ? m.launchAngle : undefined;
    const exitV = typeof m.exitVelocityEstimateMph === 'number'
      ? m.exitVelocityEstimateMph
      : typeof m.batLinearSpeedMph === 'number'
        ? m.batLinearSpeedMph
        : undefined;
    const contactFrame = (analysis as any).contact?.frame ?? (analysis as any).contactFrame ?? null;
    const pieces: string[] = [];
    if (typeof launchAngle === 'number') pieces.push(`Launch angle ${launchAngle.toFixed(1)}°`);
    if (typeof exitV === 'number') pieces.push(`exit velocity ${exitV.toFixed(0)} mph`);
    if (contactFrame !== null && contactFrame !== undefined) pieces.push(`contact at frame ${contactFrame}`);
    if (pieces.length === 0) return 'Analysis completed. Review recommendations below to improve your swing.';
    return `${pieces.join(', ')}.`;
  }

  function extractAllRecommendations(analysis: VideoAnalysis): string[] {
    const recs: string[] = [];
    // Prefer explicit feedback list
    const formAnalysis: any = (analysis as any).formAnalysis;
    if (formAnalysis && Array.isArray(formAnalysis.feedback)) {
      for (const f of formAnalysis.feedback) {
        if (typeof f === 'string') recs.push(f);
      }
    }
    // Also check aggregated recommendations in formErrors union shape
    const formErrors: any = (analysis as any).formErrors;
    if (formErrors) {
      if (Array.isArray(formErrors.recommendations)) {
        for (const r of formErrors.recommendations) {
          if (typeof r === 'string') recs.push(r);
        }
      }
      // Or derive short messages from individual errors if present
      const errorsArray = Array.isArray(formErrors.errors) ? formErrors.errors : undefined;
      if (errorsArray) {
        for (const e of errorsArray) {
          if (e?.recommendation) {
            recs.push(String(e.recommendation));
          } else if (e?.description) {
            recs.push(String(e.description));
          }
        }
      }
    }
    // Deduplicate and trim
    const seen = new Set<string>();
    const unique = recs.filter((r) => {
      const key = r.trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return unique;
  }

  function extractTopRecommendations(analysis: VideoAnalysis, limit: number = 2): string[] {
    const all = extractAllRecommendations(analysis);
    return all.slice(0, limit);
  }
>>>>>>> Stashed changes
=======
  const [openRouterFeedback, setOpenRouterFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
>>>>>>> Stashed changes
=======
  const [openRouterFeedback, setOpenRouterFeedback] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
>>>>>>> Stashed changes

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
    // Not used in blast off mode, but required by CaptureUpload
    setSelectedFile(file);
  };

  const handleVideoSelect = async (file: File) => {
    setSelectedFile(file);
<<<<<<< Updated upstream
<<<<<<< Updated upstream
    setVideoAnalysis(null);
    setAnalyzingVideo(true);
    
=======
=======
>>>>>>> Stashed changes
    setOpenRouterFeedback(null);
    setError(null);
    setIsAnalyzing(true);

<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
    try {
      let analysisFound = false;
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) {
<<<<<<< Updated upstream
<<<<<<< Updated upstream
        throw new Error('User not authenticated');
=======
=======
>>>>>>> Stashed changes
        console.error('Blast-off: Missing auth user or token', { 
          hasUser: !!authUser, 
          hasToken: !!token,
          tokenLength: token?.length 
        });
        throw new Error('User not authenticated. Please sign in again.');
      }
      
      // Validate token format before sending
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3 && tokenParts.length !== 5) {
        console.error('Blast-off: Invalid token format', { 
          parts: tokenParts.length,
          tokenPreview: token.substring(0, 20) + '...' 
        });
        throw new Error('Invalid authentication token. Please sign in again.');
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
      }

      // Create FormData for video upload
      const formData = new FormData();
      formData.append('video', file);
      formData.append('processingMode', 'full');
      formData.append('sampleRate', '1');
      formData.append('enableYOLO', 'true');
      formData.append('yoloConfidence', '0.5');

<<<<<<< Updated upstream
<<<<<<< Updated upstream
      // Call video analysis API
      const response = await fetch('/api/pose/analyze-video', {
=======
=======
>>>>>>> Stashed changes
      // 2) Create session
      const createResp = await fetch('/api/sessions', {
>>>>>>> Stashed changes
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        body: formData,
      });
<<<<<<< Updated upstream
<<<<<<< Updated upstream

<<<<<<< Updated upstream
      if (!response.ok) {
        let errorMessage = `Failed to analyze video (HTTP ${response.status})`;
        let errorDetails: any = null;
        
        try {
          // Try to get error response as text first
          const responseText = await response.text();
          console.error('Error response text:', responseText);
          
          // Try to parse as JSON
          try {
            errorDetails = JSON.parse(responseText);
            errorMessage = errorDetails.error || errorDetails.message || errorMessage;
          } catch (parseError) {
            // Not JSON, use the text as error message
            errorMessage = responseText || errorMessage;
          }
          
          console.error('Video analysis error details:', {
            status: response.status,
            statusText: response.statusText,
            error: errorDetails || responseText,
            url: response.url
          });
        } catch (e) {
          errorMessage = `HTTP ${response.status}: ${response.statusText || 'Unknown error'}`;
          console.error('Failed to parse error response:', e);
        }
        
        throw new Error(errorMessage);
=======
      // 3) Trigger analysis and wait for result
      const fd = new FormData();
      fd.append('video', file);
      fd.append('sessionId', createdSession.id);
      if (videoURL) fd.append('videoUrl', videoURL);
      fd.append('processingMode', 'full');
      fd.append('sampleRate', '1');
      fd.append('enableYOLO', 'true');
      fd.append('yoloConfidence', '0.5');
      
      console.log('Starting video analysis...');
      try {
        // Create AbortController for timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10 * 60 * 1000); // 10 minute timeout
        
        // Wait for analysis to complete
        const analysisResp = await fetch('/api/pose/analyze-video', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: fd,
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        // Read response once
        let analysisResult: any;
        const contentType = analysisResp.headers.get('content-type') || '';
        
        if (contentType.includes('application/json')) {
          analysisResult = await analysisResp.json();
        } else {
          const text = await analysisResp.text();
          try {
            analysisResult = JSON.parse(text);
          } catch {
            // Not JSON, treat as error message
            analysisResult = { 
              ok: false, 
              error: text || analysisResp.statusText || `Analysis failed with status ${analysisResp.status}` 
            };
          }
        }
        
        console.log('Analysis response status:', analysisResp.status);
        console.log('Analysis response data:', analysisResult);
        
        if (!analysisResp.ok) {
          // HTTP error status
          const errorMsg = analysisResult?.error || analysisResult?.message || analysisResp.statusText || `Analysis failed with status ${analysisResp.status}`;
          console.error('Analysis request failed:', analysisResp.status, errorMsg, analysisResult);
          throw new Error(errorMsg);
        }
        
        if (analysisResult?.ok) {
          // Analysis completed successfully - use result directly
          console.log('Analysis completed successfully');
          setVideoAnalysis(analysisResult as VideoAnalysis);
          analysisFound = true;
        } else {
          // Analysis returned 200 but with error in response
          const errorMsg = analysisResult?.error || analysisResult?.message || 'Analysis returned an error';
          console.error('Analysis returned error:', errorMsg, analysisResult);
          throw new Error(errorMsg);
        }
      } catch (error: any) {
        console.error('Analysis error:', error);
        console.error('Error details:', {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
        });
        
        // Extract error message
        let errorMessage = error?.message || 'Unknown error occurred during video analysis';
        
        // Handle specific error types
        if (error.name === 'AbortError') {
          errorMessage = 'Analysis timed out. The video may be too long or the service is taking longer than expected.';
          console.log('Analysis timed out, falling back to polling...');
        } else if (error.message?.includes('timeout')) {
          errorMessage = 'Analysis timed out. Please try again with a shorter video.';
          console.log('Analysis timed out, falling back to polling...');
        } else if (error.message?.includes('Failed to fetch') || error.message?.includes('NetworkError')) {
          errorMessage = 'Network error. Please check your connection and try again.';
          console.log('Network error, falling back to polling...');
        } else {
          console.log('Analysis failed, falling back to polling...');
        }
        
        // Try polling as fallback (in case analysis is still processing in background)
        const sid = createdSession.id as string;
        const start = Date.now();
        const timeoutMs = 5 * 60 * 1000; // 5 minutes
        const pollInterval = 3000;
        let pollAttempts = 0;
        
        while (Date.now() - start < timeoutMs && !analysisFound) {
          pollAttempts++;
          try {
            const resp = await fetch(`/api/video-analyses?sessionId=${encodeURIComponent(sid)}`, {
              headers: { 'Authorization': `Bearer ${token}` },
            });
            if (resp.ok) {
              const data = await resp.json();
              if (data?.ok) {
                console.log('Found analysis result via polling after', pollAttempts, 'attempts:', data);
                setVideoAnalysis(data as VideoAnalysis);
                analysisFound = true;
                break;
              } else if (data?.pending) {
                // Still processing, continue polling
                if (pollAttempts % 10 === 0) {
                  console.log(`Analysis still pending after ${pollAttempts} polling attempts, continuing...`);
                }
              } else if (data?.error) {
                // Error from polling endpoint
                console.error('Polling endpoint returned error:', data.error);
                errorMessage = data.error;
                break;
              }
            }
          } catch (pollError: any) {
            console.warn('Polling error:', pollError);
            if (pollAttempts % 10 === 0) {
              console.warn(`Polling failed after ${pollAttempts} attempts:`, pollError?.message);
            }
          }
          await new Promise((r) => setTimeout(r, pollInterval));
        }
        
        // If we still don't have a result, set error
        if (!analysisFound) {
          console.error('Final error after polling:', errorMessage);
          setVideoAnalysis({ ok: false, error: errorMessage } as VideoAnalysis);
        }
>>>>>>> Stashed changes
      }

      const analysis: VideoAnalysis = await response.json();
      setVideoAnalysis(analysis);
    } catch (error) {
      console.error('Video analysis error:', error);
      setVideoAnalysis({ ok: false, error: String(error) });
=======

      if (!createResp.ok) {
        const errorData = await createResp.json().catch(() => ({ error: 'Failed to create session' }));
        throw new Error(errorData.error || errorData.message || 'Failed to create session');
      }

      const createdSession = await createResp.json();

      // 3) Call OpenRouter for AI coaching feedback
      const openRouterResponse = await fetch('/api/openrouter/analyze-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: createdSession.id,
        }),
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text().catch(() => '');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Analysis failed' };
        }
        console.error('OpenRouter API error:', {
          status: openRouterResponse.status,
          statusText: openRouterResponse.statusText,
          error: errorData,
        });
        throw new Error(errorData.error || errorData.message || `Failed to get AI coaching feedback (${openRouterResponse.status})`);
      }

      const data = await openRouterResponse.json();
      if (data.ok && data.feedback) {
        setOpenRouterFeedback(data.feedback);
      } else {
        throw new Error('No feedback received from AI');
      }
    } catch (error: any) {
      console.error('Blast off error:', error);
      setError(error.message || 'Failed to analyze video. Please try again.');
>>>>>>> Stashed changes
=======

      if (!createResp.ok) {
        const errorData = await createResp.json().catch(() => ({ error: 'Failed to create session' }));
        throw new Error(errorData.error || errorData.message || 'Failed to create session');
      }

      const createdSession = await createResp.json();

      // 3) Call OpenRouter for AI coaching feedback
      const openRouterResponse = await fetch('/api/openrouter/analyze-video', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId: createdSession.id,
        }),
      });

      if (!openRouterResponse.ok) {
        const errorText = await openRouterResponse.text().catch(() => '');
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText || 'Analysis failed' };
        }
        console.error('OpenRouter API error:', {
          status: openRouterResponse.status,
          statusText: openRouterResponse.statusText,
          error: errorData,
        });
        throw new Error(errorData.error || errorData.message || `Failed to get AI coaching feedback (${openRouterResponse.status})`);
      }

      const data = await openRouterResponse.json();
      if (data.ok && data.feedback) {
        setOpenRouterFeedback(data.feedback);
      } else {
        throw new Error('No feedback received from AI');
      }
    } catch (error: any) {
      console.error('Blast off error:', error);
      setError(error.message || 'Failed to analyze video. Please try again.');
>>>>>>> Stashed changes
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
<<<<<<< Updated upstream
<<<<<<< Updated upstream
      {/* Fullscreen Analysis Animation Overlay */}
      <AnalysisAnimation isAnalyzing={analyzingVideo} />
<<<<<<< Updated upstream
      
=======

      {/* Floating CTA bar (mimics the design buttons) */}
      {videoAnalysis && videoAnalysis.ok && !analyzingVideo && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 flex gap-4">
          <button
            type="button"
            onClick={() => {
              setShowMoreInfo(true);
              // Scroll to results
              setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
            }}
            className="px-6 py-3 rounded-xl bg-blue-600 text-white font-semibold shadow-lg hover:bg-blue-700 transition-colors"
          >
            SEE MORE INFO
          </button>
          <button
            type="button"
            onClick={() => router.push('/leaderboard')}
            className="px-6 py-3 rounded-xl bg-red-600 text-white font-semibold shadow-lg hover:bg-red-700 transition-colors"
          >
            SEE LEADERBOARD
          </button>
        </div>
      )}

>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push('/')}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <Rocket className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Blast Off</h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-8">
            {/* Video Recording Section */}
            <section className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold mb-4">Record Your Swing</h2>
<<<<<<< Updated upstream
<<<<<<< Updated upstream
              <p className="text-gray-600 mb-4">
                Record a video of your baseball swing. Once recording is complete, the video will be automatically analyzed.
              </p>
              <CaptureUpload
                onImageSelect={handleImageSelect}
                onVideoSelect={handleVideoSelect}
                mode={mode}
                onModeChange={setMode}
              />
            </section>

            {/* Analysis Results */}
            {videoAnalysis && videoAnalysis.ok && (
              <section ref={resultsRef} className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Analysis Results</h2>
                {videoAnalysis.metrics && (
                  <div className="grid md:grid-cols-3 gap-4 mb-4">
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">Bat Speed</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {videoAnalysis.metrics.batLinearSpeedMph.toFixed(1)} mph
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">Exit Velocity</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {videoAnalysis.metrics.exitVelocityEstimateMph.toFixed(1)} mph
                      </div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-4">
                      <div className="text-sm text-gray-600 mb-1">Launch Angle</div>
                      <div className="text-2xl font-bold text-gray-900">
                        {videoAnalysis.metrics.launchAngle.toFixed(1)}°
                      </div>
                    </div>
                  </div>
                )}

                {videoAnalysis.formAnalysis && videoAnalysis.formAnalysis.feedback && (
                  <div className="mt-4">
                    <h3 className="font-semibold mb-2">Form Analysis</h3>
                    <ul className="space-y-2">
                      {videoAnalysis.formAnalysis.feedback.map((fb, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <span className="text-blue-600">•</span>
                          <span>{fb}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* See more info CTA after animation completes */}
                {isAnimationDone && (
                  <div className="mt-6">
                    {!showMoreInfo ? (
                      <button
                        type="button"
                        onClick={() => setShowMoreInfo(true)}
                        className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors text-sm font-medium"
                      >
                        See more info
                      </button>
                    ) : (
                      <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <p className="text-gray-800 text-sm">
                          {formatBlurb(videoAnalysis)}
                        </p>
                        {/* Top recommendations */}
                        <div className="mt-3">
                          <h4 className="text-sm font-semibold text-gray-900 mb-2">Recommendations</h4>
                          {extractTopRecommendations(videoAnalysis, 2).length > 0 ? (
                            <ul className="list-disc pl-5 space-y-1 text-sm text-gray-800">
                              {extractTopRecommendations(videoAnalysis, 2).map((rec, i) => (
                                <li key={i}>{rec.length > 180 ? rec.slice(0, 180) + '…' : rec}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-gray-600 text-sm">No specific recommendations available for this swing.</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            )}

            {videoAnalysis && !videoAnalysis.ok && (
              <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">
                  Video analysis encountered an error. Please try recording again.
                </p>
                {videoAnalysis.error && (
                  <p className="text-sm text-yellow-700 mt-2">{videoAnalysis.error}</p>
                )}
              </section>
            )}
            {!videoAnalysis && !analyzingVideo && (
              <section className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <p className="text-yellow-800">No analysis available yet. Record or upload a swing to see detailed insights and recommendations.</p>
=======
              <p className="text-gray-600 mb-4">Record or upload a swing to get AI coaching feedback.</p>
              <CaptureUpload 
                onImageSelect={handleImageSelect} 
                onVideoSelect={handleVideoSelect} 
                mode={mode} 
                onModeChange={setMode} 
              />
            </section>

            {/* Loading State */}
            {isAnalyzing && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Analyzing your swing... This may take a moment.</p>
                  <p className="text-sm text-gray-500 mt-2">Extracting frames and sending to AI for analysis...</p>
                </div>
              </section>
            )}

=======
              <p className="text-gray-600 mb-4">Record or upload a swing to get AI coaching feedback.</p>
              <CaptureUpload 
                onImageSelect={handleImageSelect} 
                onVideoSelect={handleVideoSelect} 
                mode={mode} 
                onModeChange={setMode} 
              />
            </section>

            {/* Loading State */}
            {isAnalyzing && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Analyzing your swing... This may take a moment.</p>
                  <p className="text-sm text-gray-500 mt-2">Extracting frames and sending to AI for analysis...</p>
                </div>
              </section>
            )}

>>>>>>> Stashed changes
            {/* Error State */}
            {error && (
              <section className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h3 className="font-semibold text-lg mb-2 text-red-900">Error</h3>
                    <p className="text-red-800">{error}</p>
                  </div>
                </div>
              </section>
            )}

            {/* OpenRouter Feedback */}
            {openRouterFeedback && !isAnalyzing && (
              <section className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 mb-4">
                  <Bot className="w-6 h-6 text-orange-600" />
                  <h2 className="text-xl font-semibold">AI Coaching Feedback</h2>
                </div>
                <div className="bg-gradient-to-br from-orange-50 to-yellow-50 rounded-lg p-6 border border-orange-200">
                  <p className="text-gray-800 whitespace-pre-wrap leading-relaxed">{openRouterFeedback}</p>
                </div>
<<<<<<< Updated upstream
>>>>>>> Stashed changes
=======
>>>>>>> Stashed changes
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

