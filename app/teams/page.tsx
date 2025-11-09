'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Users, Plus, UserPlus } from 'lucide-react';
import { onAuthChange, getAuth, getIdToken } from '@/lib/auth0/client-auth';
import type { Team } from '@/types/team';
import type { User } from '@/types/user';

export default function TeamsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teams, setTeams] = useState<Team[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [teamName, setTeamName] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthChange(async (authUser) => {
      if (!authUser) {
        router.push('/login');
      } else {
        // Get user via API
        const auth = getAuth();
        if (auth?.currentUser) {
          const token = await getIdToken();
          try {
            const userResponse = await fetch(`/api/users?uid=${authUser.uid}`, {
              headers: {
                'Authorization': `Bearer ${token}`,
              },
            });
            if (userResponse.ok) {
              const userData = await userResponse.json();
              setUser(userData);
            }
          } catch (error) {
            console.error('Failed to load user:', error);
          }
        }
        loadTeams();
      }
    });

    return () => unsubscribe();
  }, [router]);

  const loadTeams = async () => {
    try {
      const auth = getAuth();
      if (!auth?.currentUser) return;
      
      const token = await getIdToken();
      const teamsResponse = await fetch('/api/teams', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!teamsResponse.ok) {
        throw new Error('Failed to load teams');
      }

      const allTeams = await teamsResponse.json();
      setTeams(allTeams);
    } catch (error) {
      console.error('Failed to load teams:', error);
    } finally {
      setLoading(false);
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

      // Update user with teamId via API
      await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          teamId: newTeam.id,
        }),
      });

      // Reload user data
      const userResponse = await fetch(`/api/users?uid=${user.uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (userResponse.ok) {
        const updatedUser = await userResponse.json();
        setUser(updatedUser);
      }

      setTeams([...teams, newTeam]);
      setShowCreateModal(false);
      setTeamName('');
    } catch (error) {
      console.error('Failed to create team:', error);
      alert('Failed to create team');
    }
  };

  const handleJoinTeam = async (teamId: string) => {
    if (!user) return;

    try {
      const auth = getAuth();
      if (!auth?.currentUser) return;
      
      const token = await getIdToken();

      // Update user with teamId via API
      await fetch('/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          uid: user.uid,
          displayName: user.displayName,
          email: user.email,
          teamId: teamId,
        }),
      });

      // Reload user data
      const userResponse = await fetch(`/api/users?uid=${user.uid}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (userResponse.ok) {
        const updatedUser = await userResponse.json();
        setUser(updatedUser);
      }
      
      alert('Successfully joined team!');
    } catch (error) {
      console.error('Failed to join team:', error);
      alert('Failed to join team');
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
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Teams</h1>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Create Team
            </button>
          </div>

          {/* Current Team */}
          {user?.teamId && (
            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Your Team</h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-lg font-medium">
                    {teams.find((t) => t.id === user.teamId)?.name || 'Team'}
                  </p>
                  <p className="text-sm text-gray-600">Team ID: {user.teamId}</p>
                </div>
                <div className="text-sm text-gray-500">Stay tuned for team rankings.</div>
              </div>
            </div>
          )}

          {/* Teams List */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold mb-4">Available Teams</h2>
            {teams.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No teams available. Create one to get started!</p>
            ) : (
              <div className="space-y-4">
                {teams.map((team) => (
                  <div key={team.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div>
                      <p className="font-medium">{team.name}</p>
                      <p className="text-sm text-gray-600">Coach: {team.coachUid === user?.uid ? 'You' : 'Other'}</p>
                    </div>
                    {team.id !== user?.teamId && (
                      <button
                        onClick={() => handleJoinTeam(team.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                      >
                        <UserPlus className="w-4 h-4" />
                        Join
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
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

