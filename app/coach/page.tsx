'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, TrendingUp, AlertCircle, BarChart3 } from 'lucide-react';
import { onAuthChange, getFirebaseAuth } from '@/lib/firebase/auth';
import type { Session } from '@/types/session';
import type { LeaderboardEntry } from '@/types/team';

export default function CoachDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teamId] = useState('default'); // TODO: Get from user profile
  const [sessions, setSessions] = useState<Session[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [stats, setStats] = useState({
    totalSessions: 0,
    averageLaunchAngle: 0,
    averageExitVelocity: 0,
    goodSwings: 0,
    needsWorkSwings: 0,
  });

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (!user) {
        router.push('/login');
      } else {
        loadDashboardData();
      }
    });

    return () => unsubscribe();
  }, [router, teamId]);

  const loadDashboardData = async () => {
    try {
      // Get Firebase Auth token
      const auth = getFirebaseAuth();
      if (!auth?.currentUser) {
        router.push('/login');
        return;
      }
      const token = await auth.currentUser.getIdToken();

      // Load all team sessions via API
      const sessionsResponse = await fetch(`/api/sessions?teamId=${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!sessionsResponse.ok) {
        throw new Error('Failed to load sessions');
      }
      
      const allSessions: Session[] = await sessionsResponse.json();
      
      // Load leaderboard via API
      const leaderboardResponse = await fetch(`/api/leaderboard?teamId=${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!leaderboardResponse.ok) {
        throw new Error('Failed to load leaderboard');
      }
      
      const entries: LeaderboardEntry[] = await leaderboardResponse.json();
      setLeaderboard(entries);

      // Calculate stats
      const goodSwings = allSessions.filter((s) => s.label === 'good').length;
      const needsWorkSwings = allSessions.filter((s) => s.label === 'needs_work').length;
      const avgLaunchAngle = allSessions.length > 0
        ? allSessions.reduce((sum, s) => sum + s.metrics.launchAngleEst, 0) / allSessions.length
        : 0;
      const avgExitVelocity = allSessions.length > 0
        ? allSessions.reduce((sum, s) => sum + s.metrics.exitVelocity, 0) / allSessions.length
        : 0;

      setStats({
        totalSessions: allSessions.length,
        averageLaunchAngle: avgLaunchAngle,
        averageExitVelocity: avgExitVelocity,
        goodSwings,
        needsWorkSwings,
      });

      setSessions(allSessions);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

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
          <div className="flex items-center gap-3 mb-8">
            <BarChart3 className="w-8 h-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
          </div>

          {/* Stats Cards */}
          <div className="grid md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <Users className="w-6 h-6 text-blue-600" />
                <h3 className="text-sm font-medium text-gray-600">Total Sessions</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.totalSessions}</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-green-600" />
                <h3 className="text-sm font-medium text-gray-600">Avg Launch Angle</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.averageLaunchAngle.toFixed(1)}°</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <TrendingUp className="w-6 h-6 text-purple-600" />
                <h3 className="text-sm font-medium text-gray-600">Avg Exit Velocity</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">{stats.averageExitVelocity.toFixed(1)} mph</p>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="flex items-center gap-3 mb-2">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
                <h3 className="text-sm font-medium text-gray-600">Good Swings</h3>
              </div>
              <p className="text-3xl font-bold text-gray-900">
                {stats.goodSwings} / {stats.totalSessions}
              </p>
            </div>
          </div>

          {/* Recent Sessions */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">Recent Sessions</h2>
            {sessions.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No sessions yet</p>
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

          {/* Leaderboard Preview */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Team Leaderboard</h2>
            {leaderboard.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No leaderboard entries yet</p>
            ) : (
              <div className="space-y-2">
                {leaderboard.slice(0, 5).map((entry, index) => (
                  <div key={entry.uid} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 flex items-center justify-center rounded-full bg-blue-100 text-blue-700 font-semibold">
                        {index + 1}
                      </span>
                      <span className="font-medium">{entry.displayName || 'Anonymous'}</span>
                    </div>
                    <span className="text-lg font-bold text-blue-600">
                      {entry.bestDistanceFt.toFixed(0)} ft
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

