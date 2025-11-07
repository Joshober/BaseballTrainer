'use client';

import React from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import type { Session } from '@/types/session';

interface ProgressChartProps {
  sessions: Session[];
  metric: 'distance' | 'exitVelocity' | 'launchAngle';
  title?: string;
}

export default function ProgressChart({ sessions, metric, title }: ProgressChartProps) {
  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const getValue = (session: Session) => {
    switch (metric) {
      case 'distance':
        return session.game.distanceFt;
      case 'exitVelocity':
        return session.metrics.exitVelocity || 0;
      case 'launchAngle':
        return session.metrics.launchAngleEst || 0;
      default:
        return 0;
    }
  };

  const getUnit = () => {
    switch (metric) {
      case 'distance':
        return 'ft';
      case 'exitVelocity':
        return 'mph';
      case 'launchAngle':
        return '°';
      default:
        return '';
    }
  };

  const values = sortedSessions.map(getValue);
  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = maxValue - minValue || 1;

  const getTrend = () => {
    if (values.length < 2) return null;
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    return secondAvg > firstAvg ? 'up' : secondAvg < firstAvg ? 'down' : 'neutral';
  };

  const trend = getTrend();
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;
  const trendColor = trend === 'up' ? 'text-green-600' : trend === 'down' ? 'text-red-600' : 'text-gray-600';

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">
          {title || `${metric.charAt(0).toUpperCase() + metric.slice(1)} Progress`}
        </h3>
        {trend && (
          <div className={`flex items-center gap-1 ${trendColor}`}>
            <TrendIcon className="w-5 h-5" />
            <span className="text-sm font-medium">
              {trend === 'up' ? 'Improving' : trend === 'down' ? 'Declining' : 'Stable'}
            </span>
          </div>
        )}
      </div>

      <div className="space-y-2">
        {sortedSessions.map((session, idx) => {
          const value = getValue(session);
          const percentage = ((value - minValue) / range) * 100;
          const date = new Date(session.createdAt);
          
          return (
            <div key={session.id} className="flex items-center gap-3">
              <div className="w-20 text-xs text-gray-600">
                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </div>
              <div className="flex-1 relative">
                <div className="h-8 bg-gray-100 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-lg transition-all duration-300"
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
              <div className="w-16 text-sm font-semibold text-gray-900 text-right">
                {value.toFixed(metric === 'distance' ? 0 : 1)} {getUnit()}
              </div>
            </div>
          );
        })}
      </div>

      {sortedSessions.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No data available</p>
        </div>
      )}
    </div>
  );
}

