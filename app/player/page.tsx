'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Rocket, TrendingUp, Target, BarChart3, ArrowRight, Video } from 'lucide-react';
import { onAuthChange } from '@/lib/hooks/useAuth';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import TrendAnalysis from '@/components/Analytics/TrendAnalysis';
import type { Session } from '@/types/session';
import type { User } from '@/types/user';

export default function PlayerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [viewingUid, setViewingUid] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    averageLaunchAngle: 0,
    averageExitVelocity: 0,
    bestDistance: 0,
    goodSwings: 0,
    needsWorkSwings: 0,
    bestLaunchAngle: 0,
    bestExitVelocity: 0,
    totalVideosAnalyzed: 0,
    averageTrackingQuality: 0,
    formErrorsCount: 0,
  });

  const loadDashboardData = async (uid: string) => {
    try {
      const authUser = getAuthUser();
      const token = getAuthToken();
      if (!authUser || !token) return;

      // Load user data if viewing another player
      const isViewingOtherPlayer = uid !== authUser.sub;
      if (isViewingOtherPlayer) {
        const userResponse = await fetch(`/api/users?uid=${uid}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
        if (userResponse.ok) {
          const userData = await userResponse.json();
          setUser(userData);
        }
      }

      // Load user sessions
      const sessionsResponse = await fetch(`/api/sessions?uid=${uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (sessionsResponse.ok) {
        const allSessions: Session[] = await sessionsResponse.json();
        setSessions(allSessions);

        // Calculate stats - only use valid values (not NaN, not null, not undefined, not 0 for meaningful metrics)
        const goodSwings = allSessions.filter((s) => s.label === 'good').length;
        const needsWorkSwings = allSessions.filter((s) => s.label === 'needs_work').length;
        
        // Helper function to check if a value is valid
        const isValidValue = (value: any): boolean => {
          return value != null && 
                 !isNaN(value) && 
                 isFinite(value) && 
                 value !== 0; // Exclude 0 for metrics that should have meaningful values
        };
        
        // Calculate average launch angle from valid values only
        const validLaunchAngles = allSessions
          .map((s) => {
            // Prefer video analysis data if available
            if (s.videoAnalysis?.ok && s.videoAnalysis.metrics?.launchAngle != null) {
              return s.videoAnalysis.metrics.launchAngle;
            }
            return s.metrics.launchAngleEst;
          })
          .filter(isValidValue);
        const avgLaunchAngle = validLaunchAngles.length > 0
          ? validLaunchAngles.reduce((sum, val) => sum + val, 0) / validLaunchAngles.length
          : null;
        
        // Calculate average exit velocity from valid values only
        const validExitVelocities = allSessions
          .map((s) => {
            // Prefer video analysis data if available
            if (s.videoAnalysis?.ok && s.videoAnalysis.metrics?.exitVelocityEstimateMph != null) {
              return s.videoAnalysis.metrics.exitVelocityEstimateMph;
            }
            if (s.videoAnalysis?.ok && s.videoAnalysis.metrics?.batLinearSpeedMph != null) {
              return s.videoAnalysis.metrics.batLinearSpeedMph;
            }
            return s.metrics.exitVelocity;
          })
          .filter(isValidValue);
        const avgExitVelocity = validExitVelocities.length > 0
          ? validExitVelocities.reduce((sum, val) => sum + val, 0) / validExitVelocities.length
          : null;
        
        // Calculate best distance (allow 0 for distance as it's a valid value)
        const validDistances = allSessions
          .map((s) => {
            // Try to calculate from exit velocity if available
            if (s.videoAnalysis?.ok && s.videoAnalysis.metrics?.exitVelocityEstimateMph != null) {
              const estimatedDistance = Math.round(s.videoAnalysis.metrics.exitVelocityEstimateMph * 0.15);
              if (estimatedDistance > 0) return estimatedDistance;
            }
            return s.game.distanceFt;
          })
          .filter((d) => d != null && !isNaN(d) && isFinite(d));
        const bestDistance = validDistances.length > 0
          ? Math.max(...validDistances)
          : null;
        
        // Calculate best launch angle
        const bestLaunchAngle = validLaunchAngles.length > 0
          ? Math.max(...validLaunchAngles)
          : null;
        
        // Calculate best exit velocity
        const bestExitVelocity = validExitVelocities.length > 0
          ? Math.max(...validExitVelocities)
          : null;
        
        // Count videos with analysis
        const videosAnalyzed = allSessions.filter((s) => 
          s.videoAnalysis?.ok || s.videoURL
        ).length;
        
        // Calculate average tracking quality from video analyses
        const trackingQualities = allSessions
          .map((s) => {
            if (s.videoAnalysis?.ok && s.videoAnalysis.trackingQuality?.overallScore != null) {
              const score = s.videoAnalysis.trackingQuality.overallScore;
              return score > 1 ? score : score * 100; // Convert to percentage if needed
            }
            return null;
          })
          .filter((q) => q != null && !isNaN(q) && isFinite(q) && q > 0) as number[];
        const avgTrackingQuality = trackingQualities.length > 0
          ? trackingQualities.reduce((sum, q) => sum + q, 0) / trackingQualities.length
          : null;
        
        // Count form errors from video analyses
        const totalFormErrors = allSessions.reduce((count, s) => {
          if (s.videoAnalysis?.ok && s.videoAnalysis.formErrors) {
            const errors = Array.isArray(s.videoAnalysis.formErrors)
              ? s.videoAnalysis.formErrors
              : s.videoAnalysis.formErrors.errors || [];
            return count + errors.length;
          }
          return count;
        }, 0);

        setStats({
          totalSessions: allSessions.length,
          averageLaunchAngle: avgLaunchAngle ?? 0,
          averageExitVelocity: avgExitVelocity ?? 0,
          bestDistance: bestDistance ?? 0,
          goodSwings,
          needsWorkSwings,
          bestLaunchAngle: bestLaunchAngle ?? 0,
          bestExitVelocity: bestExitVelocity ?? 0,
          totalVideosAnalyzed: videosAnalyzed,
          averageTrackingQuality: avgTrackingQuality ?? 0,
          formErrorsCount: totalFormErrors,
        });
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Check if viewing another player's dashboard (for coaches)
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const uid = searchParams.get('uid');
      if (uid) {
        setViewingUid(uid);
        loadDashboardData(uid);
        return;
      }
    }

    const unsubscribe = onAuthChange(async (authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        // Get user data
        const token = getAuthToken();
        if (token) {
          try {
            const userResponse = await fetch(`/api/users?uid=${authUser.sub}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (userResponse.ok) {
              const userData = await userResponse.json();
              setUser(userData);
              
              loadDashboardData(authUser.sub);
            }
          } catch (error) {
            console.error('Failed to load user:', error);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Rocket className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">
                {user && viewingUid && viewingUid !== user.uid ? `${user.displayName || 'Player'}'s Dashboard` : 'Player Dashboard'}
              </h1>
            </div>
            {(!viewingUid || (user && viewingUid === user.uid)) && (
              <Link
                href="/mission"
                className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                <Rocket className="w-5 h-5" />
                New Mission
              </Link>
            )}
            {viewingUid && user && viewingUid !== user.uid && (
              <Link
                href="/coach"
                className="flex items-center gap-2 px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
              >
                ← Back to Coach Dashboard
              </Link>
            )}
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-6 h-6 text-blue-600" />
                <h3 className="text-sm font-medium text-gray-600">Total Sessions</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalSessions}</p>
              {(stats.goodSwings > 0 || stats.needsWorkSwings > 0) && (
                <p className="text-xs text-gray-500 mt-1">
                  {stats.goodSwings} good • {stats.needsWorkSwings} needs work
                </p>
              )}
            </div>

            {stats.bestDistance > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                  <h3 className="text-sm font-medium text-gray-600">Best Distance</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.bestDistance.toFixed(0)} ft</p>
                {stats.averageExitVelocity > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Avg: {stats.averageExitVelocity.toFixed(1)} mph
                  </p>
                )}
              </div>
            )}

            {stats.averageLaunchAngle > 0 && !isNaN(stats.averageLaunchAngle) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 mb-2">
                  <BarChart3 className="w-6 h-6 text-purple-600" />
                  <h3 className="text-sm font-medium text-gray-600">Avg Launch Angle</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.averageLaunchAngle.toFixed(1)}°</p>
                {stats.bestLaunchAngle > 0 && stats.bestLaunchAngle > stats.averageLaunchAngle && (
                  <p className="text-xs text-gray-500 mt-1">
                    Best: {stats.bestLaunchAngle.toFixed(1)}°
                  </p>
                )}
              </div>
            )}

            {stats.averageExitVelocity > 0 && !isNaN(stats.averageExitVelocity) && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-6 h-6 text-orange-600" />
                  <h3 className="text-sm font-medium text-gray-600">Avg Exit Velocity</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.averageExitVelocity.toFixed(1)} mph</p>
                {stats.bestExitVelocity > 0 && stats.bestExitVelocity > stats.averageExitVelocity && (
                  <p className="text-xs text-gray-500 mt-1">
                    Best: {stats.bestExitVelocity.toFixed(1)} mph
                  </p>
                )}
              </div>
            )}

            {stats.totalVideosAnalyzed > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Video className="w-6 h-6 text-indigo-600" />
                  <h3 className="text-sm font-medium text-gray-600">Videos Analyzed</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.totalVideosAnalyzed}</p>
                {stats.averageTrackingQuality > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Avg tracking: {stats.averageTrackingQuality.toFixed(0)}%
                  </p>
                )}
              </div>
            )}

            {stats.formErrorsCount > 0 && (
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center gap-3 mb-2">
                  <Target className="w-6 h-6 text-red-600" />
                  <h3 className="text-sm font-medium text-gray-600">Form Errors Found</h3>
                </div>
                <p className="text-3xl font-bold text-gray-900">{stats.formErrorsCount}</p>
                <p className="text-xs text-gray-500 mt-1">
                  Areas to improve
                </p>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-3 gap-6 mb-8">
            <Link
              href="/mission"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Start New Mission</h3>
                  <p className="text-gray-600">Capture and analyze your swing</p>
                </div>
                <ArrowRight className="w-6 h-6 text-blue-600" />
              </div>
            </Link>

            <Link
              href="/leaderboard"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">View Leaderboard</h3>
                  <p className="text-gray-600">See how you rank against your team</p>
                </div>
                <ArrowRight className="w-6 h-6 text-blue-600" />
              </div>
            </Link>

            <Link
              href="/videos"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">My Videos</h3>
                  <p className="text-gray-600">View and share your recorded swings</p>
                </div>
                <ArrowRight className="w-6 h-6 text-blue-600" />
              </div>
            </Link>
          </div>

          {/* Real-Time Analysis Card */}
          <div className="bg-gradient-to-r from-purple-500 to-blue-600 rounded-lg shadow-md p-6 mb-8 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold mb-2">Real-Time Analysis</h3>
                <p className="text-white text-opacity-90">Get instant feedback on your swing as you perform it</p>
              </div>
              <Link
                href="/blast-off"
                className="flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-lg hover:bg-gray-100 transition-colors font-medium"
              >
                <Video className="w-5 h-5" />
                Start Live Analysis
              </Link>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
            {sessions.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No sessions yet. Start your first mission!</p>
                <Link
                  href="/mission"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Rocket className="w-5 h-5" />
                  Start Mission
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {sessions.slice(0, 10).map((session) => (
                  <div key={session.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{new Date(session.createdAt).toLocaleDateString()}</p>
                      <p className="text-sm text-gray-600">
                        Launch: {session.metrics.launchAngleEst.toFixed(1)}° | 
                        Velocity: {session.metrics.exitVelocity} mph | 
                        Distance: {session.game.distanceFt.toFixed(0)} ft
                      </p>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      session.label === 'good'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {session.label === 'good' ? 'Good' : 'Needs Work'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Trend Analysis */}
          {sessions.length > 0 && (
            <div className="mt-8">
              <TrendAnalysis sessions={sessions} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

