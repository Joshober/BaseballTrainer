'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Trophy, Loader2 } from 'lucide-react';
import { onAuthChange } from '@/lib/firebase/auth';
import { db } from '@/lib/database';
import LeaderboardTable from '@/components/Leaderboard/LeaderboardTable';
import type { LeaderboardEntry } from '@/types/team';

export default function LeaderboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [teamId] = useState('default'); // TODO: Get from user profile or URL param

  useEffect(() => {
    const unsubscribe = onAuthChange((user) => {
      if (!user) {
        router.push('/login');
      }
    });

    loadLeaderboard();

    return () => unsubscribe();
  }, [router, teamId]);

  const loadLeaderboard = async () => {
    try {
      const leaderboardEntries = await db.getLeaderboardEntries(teamId);
      
      // Fetch user display names
      const entriesWithNames = await Promise.all(
        leaderboardEntries.map(async (entry) => {
          const user = await db.getUser(entry.uid);
          return {
            ...entry,
            displayName: user?.displayName || 'Anonymous',
          };
        })
      );

      // Sort by distance (descending)
      entriesWithNames.sort((a, b) => b.bestDistanceFt - a.bestDistanceFt);
      
      setEntries(entriesWithNames);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setLoading(false);
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
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h1 className="text-3xl font-bold text-gray-900">Leaderboard</h1>
          </div>

          {/* Leaderboard Table */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <LeaderboardTable entries={entries} />
          </div>
        </div>
      </div>
    </div>
  );
}


