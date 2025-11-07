'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, TrendingUp, BarChart3, Plus, UserPlus, Eye, Target, ArrowRight } from 'lucide-react';
import { onAuthChange, getAuth, getIdToken } from '@/lib/auth0/client-auth';
import type { Team } from '@/types/team';
import type { User } from '@/types/user';
import type { Session } from '@/types/session';

interface PlayerStats {
  uid: string;
  displayName: string;
  totalSessions: number;
  bestDistance: number;
  averageLaunchAngle: number;
  averageExitVelocity: number;
  goodSwings: number;
  needsWorkSwings: number;
}

export default function CoachDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<User[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [overallStats, setOverallStats] = useState({
    totalPlayers: 0,
    totalSessions: 0,
    averageLaunchAngle: 0,
    averageExitVelocity: 0,
    totalGoodSwings: 0,
    totalNeedsWorkSwings: 0,
  });

  useEffect(() => {
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
              
              // Redirect if player
              if (userData.role === 'player') {
                router.push('/player');
                return;
              }
              
              loadTeams(authUser.uid);
            }
          } catch (error) {
            console.error('Failed to load user:', error);
          }
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadTeams = async (coachUid: string) => {
    try {
      const auth = getAuth();
      if (!auth?.currentUser) return;
      
      const token = await getIdToken();
      const teamsResponse = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (teamsResponse.ok) {
        const allTeams = await teamsResponse.json();
        const myTeams = allTeams.filter((team: Team) => team.coachUid === coachUid);
        setTeams(myTeams);
        
        if (myTeams.length > 0 && !selectedTeam) {
          setSelectedTeam(myTeams[0]);
          loadTeamPlayers(myTeams[0].id);
        }
      }
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTeamPlayers = async (teamId: string) => {
    try {
      const auth = getAuth();
      if (!auth?.currentUser) return;
      
      const token = await getIdToken();

      // Load players in team
      const playersResponse = await fetch(`/api/users?teamId=${teamId}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (playersResponse.ok) {
        const teamPlayers: User[] = await playersResponse.json();
        setPlayers(teamPlayers);

        // Load stats for each player
        const statsPromises = teamPlayers.map(async (player) => {
          const sessionsResponse = await fetch(`/api/sessions?uid=${player.uid}`, {
            headers: {
              'Authorization': `Bearer ${token}`,
            },
          });
          
          if (sessionsResponse.ok) {
            const sessions: Session[] = await sessionsResponse.json();
            const goodSwings = sessions.filter((s) => s.label === 'good').length;
            const needsWorkSwings = sessions.filter((s) => s.label === 'needs_work').length;
            const avgLaunchAngle = sessions.length > 0
              ? sessions.reduce((sum, s) => sum + s.metrics.launchAngleEst, 0) / sessions.length
              : 0;
            const avgExitVelocity = sessions.length > 0
              ? sessions.reduce((sum, s) => sum + s.metrics.exitVelocity, 0) / sessions.length
              : 0;
            const bestDistance = sessions.length > 0
              ? Math.max(...sessions.map((s) => s.game.distanceFt))
              : 0;

            return {
              uid: player.uid,
              displayName: player.displayName,
              totalSessions: sessions.length,
              bestDistance,
              averageLaunchAngle: avgLaunchAngle,
              averageExitVelocity: avgExitVelocity,
              goodSwings,
              needsWorkSwings,
            } as PlayerStats;
          }
          return null;
        });

        const stats = await Promise.all(statsPromises);
        const validStats = stats.filter((s) => s !== null) as PlayerStats[];
        setPlayerStats(validStats);

        // Calculate overall stats
        const totalSessions = validStats.reduce((sum, s) => sum + s.totalSessions, 0);
        const totalGoodSwings = validStats.reduce((sum, s) => sum + s.goodSwings, 0);
        const totalNeedsWorkSwings = validStats.reduce((sum, s) => sum + s.needsWorkSwings, 0);
        const avgLaunchAngle = validStats.length > 0
          ? validStats.reduce((sum, s) => sum + s.averageLaunchAngle, 0) / validStats.length
          : 0;
        const avgExitVelocity = validStats.length > 0
          ? validStats.reduce((sum, s) => sum + s.averageExitVelocity, 0) / validStats.length
          : 0;

        setOverallStats({
          totalPlayers: teamPlayers.length,
          totalSessions,
          averageLaunchAngle: avgLaunchAngle,
          averageExitVelocity: avgExitVelocity,
          totalGoodSwings: totalGoodSwings,
          totalNeedsWorkSwings: totalNeedsWorkSwings,
        });
      }
    } catch (error) {
      console.error('Failed to load team players:', error);
    }
  };

  const handleCreateTeam = async () => {
    if (!teamName.trim() || !user) return;

    try {
      const auth = getAuth();
      if (!auth?.currentUser) return;
      
      const token = await getIdToken();

      // Create team via API
      const teamResponse = await fetch('/api/teams', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ name: teamName }),
      });

      if (!teamResponse.ok) {
        throw new Error('Failed to create team');
      }

      const newTeam = await teamResponse.json();
      setTeams([...teams, newTeam]);
      setSelectedTeam(newTeam);
      setShowCreateModal(false);
      setTeamName('');
      loadTeamPlayers(newTeam.id);
    } catch (error) {
      console.error('Failed to create team:', error);
      alert('Failed to create team');
    }
  };

  const handleTeamSelect = (team: Team) => {
    setSelectedTeam(team);
    loadTeamPlayers(team.id);
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
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Coach Dashboard</h1>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Team
            </button>
          </div>

          {/* Teams Section */}
          <div className="bg-white rounded-lg shadow-md p-6 mb-8">
            <h2 className="text-xl font-semibold mb-4">My Teams</h2>
            {teams.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No teams yet. Create your first team!</p>
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  Create Team
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap gap-3">
                {teams.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleTeamSelect(team)}
                    className={`px-4 py-2 rounded-lg transition-colors ${
                      selectedTeam?.id === team.id
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {team.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedTeam && (
            <>
              {/* Overall Stats */}
              <div className="grid md:grid-cols-4 gap-6 mb-8">
                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Users className="w-6 h-6 text-blue-600" />
                    <h3 className="text-sm font-medium text-gray-600">Total Players</h3>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{overallStats.totalPlayers}</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <Target className="w-6 h-6 text-green-600" />
                    <h3 className="text-sm font-medium text-gray-600">Total Sessions</h3>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{overallStats.totalSessions}</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-6 h-6 text-purple-600" />
                    <h3 className="text-sm font-medium text-gray-600">Avg Launch Angle</h3>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{overallStats.averageLaunchAngle.toFixed(1)}°</p>
                </div>

                <div className="bg-white rounded-lg shadow-md p-6">
                  <div className="flex items-center gap-3 mb-2">
                    <TrendingUp className="w-6 h-6 text-orange-600" />
                    <h3 className="text-sm font-medium text-gray-600">Avg Exit Velocity</h3>
                  </div>
                  <p className="text-3xl font-bold text-gray-900">{overallStats.averageExitVelocity.toFixed(1)} mph</p>
                </div>
              </div>

              {/* Players List */}
              <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold mb-4">Players in {selectedTeam.name}</h2>
                {players.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No players in this team yet</p>
                ) : (
                  <div className="space-y-4">
                    {playerStats.map((stat) => (
                      <div key={stat.uid} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <h3 className="font-semibold text-lg mb-2">{stat.displayName}</h3>
                          <div className="grid grid-cols-4 gap-4 text-sm text-gray-600">
                            <div>
                              <span className="font-medium">Sessions:</span> {stat.totalSessions}
                            </div>
                            <div>
                              <span className="font-medium">Best Distance:</span> {stat.bestDistance.toFixed(0)} ft
                            </div>
                            <div>
                              <span className="font-medium">Avg Launch:</span> {stat.averageLaunchAngle.toFixed(1)}°
                            </div>
                            <div>
                              <span className="font-medium">Avg Velocity:</span> {stat.averageExitVelocity.toFixed(1)} mph
                            </div>
                          </div>
                          <div className="mt-2 flex gap-4 text-sm">
                            <span className="text-green-600">Good: {stat.goodSwings}</span>
                            <span className="text-yellow-600">Needs Work: {stat.needsWorkSwings}</span>
                          </div>
                        </div>
                        <Link
                          href={`/player?uid=${stat.uid}`}
                          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                          View Dashboard
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create Team Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Create New Team</h2>
            <div className="space-y-4">
              <div>
                <label htmlFor="teamName" className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name
                </label>
                <input
                  type="text"
                  id="teamName"
                  value={teamName}
                  onChange={(e) => setTeamName(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter team name"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleCreateTeam}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create
                </button>
                <button
                  onClick={() => {
                    setShowCreateModal(false);
                    setTeamName('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
