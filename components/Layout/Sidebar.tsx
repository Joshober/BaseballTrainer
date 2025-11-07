'use client';

import { ReactNode } from 'react';
import { TrendingUp, Activity, Zap, Users } from 'lucide-react';
import type { Session } from '@/types/session';

interface SidebarProps {
  stats?: {
    totalSessions: number;
    bestDistance: number;
    averageLaunchAngle: number;
    averageExitVelocity: number;
  };
  recentSessions?: Session[];
  teamInfo?: {
    name: string;
    memberCount: number;
  };
  quickActions?: ReactNode;
}

export default function Sidebar({ stats, recentSessions, teamInfo, quickActions }: SidebarProps) {
  return (
    <aside className="w-64 bg-white rounded-lg shadow-md p-6 space-y-6">
      {/* Quick Stats */}
      {stats && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4" />
            Quick Stats
          </h3>
          <div className="space-y-2">
            <div className="text-sm">
              <span className="text-gray-600">Sessions:</span>
              <span className="font-semibold ml-2">{stats.totalSessions}</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Best Distance:</span>
              <span className="font-semibold ml-2">{stats.bestDistance.toFixed(0)} ft</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Avg Launch:</span>
              <span className="font-semibold ml-2">{stats.averageLaunchAngle.toFixed(1)}°</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">Avg Velocity:</span>
              <span className="font-semibold ml-2">{stats.averageExitVelocity.toFixed(1)} mph</span>
            </div>
          </div>
        </div>
      )}

      {/* Team Info */}
      {teamInfo && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Team
          </h3>
          <div className="space-y-2">
            <p className="font-medium text-gray-900">{teamInfo.name}</p>
            <p className="text-sm text-gray-600">{teamInfo.memberCount} members</p>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      {recentSessions && recentSessions.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Recent Activity
          </h3>
          <div className="space-y-2">
            {recentSessions.slice(0, 5).map((session) => (
              <div key={session.id} className="text-sm">
                <p className="text-gray-600">
                  {new Date(session.createdAt).toLocaleDateString()}
                </p>
                <p className="font-medium text-gray-900">
                  {session.game.distanceFt.toFixed(0)} ft
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {quickActions && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <Zap className="w-4 h-4" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            {quickActions}
          </div>
        </div>
      )}
    </aside>
  );
}

