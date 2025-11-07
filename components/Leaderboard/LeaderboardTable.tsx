'use client';

import { Trophy, Medal, Award } from 'lucide-react';
import type { LeaderboardEntry } from '@/types/team';
import { getZone } from '@/lib/game/zones';

interface LeaderboardTableProps {
  entries: LeaderboardEntry[];
}

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Award className="w-6 h-6 text-orange-500" />;
    return <span className="w-6 h-6 flex items-center justify-center text-gray-500 font-semibold">{rank}</span>;
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Rank</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Player</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Distance</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Zone</th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Date</th>
          </tr>
        </thead>
        <tbody>
          {entries.length === 0 ? (
            <tr>
              <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                No entries yet. Be the first!
              </td>
            </tr>
          ) : (
            entries.map((entry, index) => {
              const rank = index + 1;
              const zone = getZone(entry.bestDistanceFt);
              return (
                <tr key={entry.uid} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-2">
                      {getRankIcon(rank)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="font-medium text-gray-900">
                      {entry.displayName || 'Anonymous'}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <span className="font-semibold text-blue-600">
                      {entry.bestDistanceFt.toFixed(0)} ft
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-sm font-medium">
                      {zone.name}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right text-sm text-gray-500">
                    {new Date(entry.updatedAt).toLocaleDateString()}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}


