'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Rocket, TrendingUp, Target, BarChart3, ArrowRight, Video } from 'lucide-react';
import { onAuthChange, getAuth, getIdToken } from '@/lib/auth0/client-auth';
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
  });

  const loadDashboardData = async (uid: string) => {
    try {
      const auth = getAuth();
      if (!auth?.currentUser) return;
      
      const token = await getIdToken();

      // Load user data if viewing another player
      const isViewingOtherPlayer = uid !== auth.currentUser.uid;
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

        // Calculate stats
        const goodSwings = allSessions.filter((s) => s.label === 'good').length;
        const needsWorkSwings = allSessions.filter((s) => s.label === 'needs_work').length;
        const avgLaunchAngle = allSessions.length > 0
          ? allSessions.reduce((sum, s) => sum + s.metrics.launchAngleEst, 0) / allSessions.length
          : 0;
        const avgExitVelocity = allSessions.length > 0
          ? allSessions.reduce((sum, s) => sum + s.metrics.exitVelocity, 0) / allSessions.length
          : 0;
        const bestDistance = allSessions.length > 0
          ? Math.max(...allSessions.map((s) => s.game.distanceFt))
          : 0;

        setStats({
          totalSessions: allSessions.length,
          averageLaunchAngle: avgLaunchAngle,
          averageExitVelocity: avgExitVelocity,
          bestDistance,
          goodSwings,
          needsWorkSwings,
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
        const auth = getAuth();
        if (auth?.currentUser) {
          try {
            const token = await getIdToken();
            const userResponse = await fetch(`/api/users?uid=${authUser.uid}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (userResponse.ok) {
              const userData = await userResponse.json();
              setUser(userData);
              
              // Redirect if coach (unless viewing another player)
              if (userData.role === 'coach') {
                if (typeof window !== 'undefined') {
                  const searchParams = new URLSearchParams(window.location.search);
                  if (!searchParams.get('uid')) {
                    router.push('/coach');
                    return;
                  }
                } else {
                  router.push('/coach');
                  return;
                }
              }
              
              loadDashboardData(authUser.uid);
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
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <Target className="w-6 h-6 text-blue-600" />
                <h3 className="text-sm font-medium text-gray-600">Total Sessions</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalSessions}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-green-600" />
                <h3 className="text-sm font-medium text-gray-600">Best Distance</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.bestDistance.toFixed(0)} ft</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <BarChart3 className="w-6 h-6 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-600">Avg Launch Angle</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.averageLaunchAngle.toFixed(1)}°</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-orange-600" />
                <h3 className="text-sm font-medium text-gray-600">Avg Exit Velocity</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.averageExitVelocity.toFixed(1)} mph</p>
            </div>
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

            <Link
              href="/messages"
              className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-semibold mb-2">Messages</h3>
                  <p className="text-gray-600">Chat with coaches and AI bot</p>
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
                href="/streaming"
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

