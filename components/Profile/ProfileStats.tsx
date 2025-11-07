'use client';

import React from 'react';
import { TrendingUp, Target, Trophy, Activity } from 'lucide-react';
import type { Session } from '@/types/session';

interface ProfileStatsProps {
  sessions: Session[];
}

export default function ProfileStats({ sessions }: ProfileStatsProps) {
  const totalSessions = sessions.length;
  const bestDistance = sessions.reduce((max, s) => Math.max(max, s.game.distanceFt), 0);
  const averageLaunchAngle = sessions.reduce((sum, s) => sum + (s.metrics.launchAngleEst || 0), 0) / totalSessions || 0;
  const averageExitVelocity = sessions.reduce((sum, s) => sum + (s.metrics.exitVelocity || 0), 0) / totalSessions || 0;
  const goodSwings = sessions.filter(s => s.label === 'good').length;
  const needsWork = sessions.filter(s => s.label === 'needs_work').length;

  const stats = [
    { label: 'Total Sessions', value: totalSessions, icon: Activity, color: 'text-blue-600' },
    { label: 'Best Distance', value: `${bestDistance.toFixed(0)} ft`, icon: Trophy, color: 'text-yellow-600' },
    { label: 'Avg Launch Angle', value: `${averageLaunchAngle.toFixed(1)}°`, icon: Target, color: 'text-green-600' },
    { label: 'Avg Exit Velocity', value: `${averageExitVelocity.toFixed(1)} mph`, icon: TrendingUp, color: 'text-purple-600' },
    { label: 'Good Swings', value: goodSwings, icon: TrendingUp, color: 'text-green-600' },
    { label: 'Needs Work', value: needsWork, icon: Target, color: 'text-red-600' },
  ];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Statistics</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {stats.map((stat, idx) => {
          const Icon = stat.icon;
          return (
            <div key={idx} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${stat.color}`} />
                <span className="text-sm font-medium text-gray-700">{stat.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

