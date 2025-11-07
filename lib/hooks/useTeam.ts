'use client';

import { useState, useEffect } from 'react';
import { getAuthUser, getAuthToken } from '@/lib/auth0/client';
import type { User } from '@/types/user';

export function useTeam() {
  const [teamId, setTeamId] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserTeam();
  }, []);

  const loadUserTeam = async () => {
    try {
      const authUser = getAuthUser();
      if (!authUser) {
        setLoading(false);
        return;
      }

      const token = getAuthToken();
      if (!token) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/users?uid=${authUser.sub}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData: User = await response.json();
        setUser(userData);
        setTeamId(userData.teamId || 'default');
      } else {
        // If user doesn't exist, use default
        setTeamId('default');
      }
    } catch (error) {
      console.error('Failed to load user team:', error);
      setTeamId('default');
    } finally {
      setLoading(false);
    }
  };

  return { teamId, user, loading, refresh: loadUserTeam };
}

