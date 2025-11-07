'use client';

import React from 'react';
import { TrendingUp, Target, Award } from 'lucide-react';
import ProgressChart from './ProgressChart';
import type { Session } from '@/types/session';

interface TrendAnalysisProps {
  sessions: Session[];
}

export default function TrendAnalysis({ sessions }: TrendAnalysisProps) {
  const sortedSessions = [...sessions].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  const calculateImprovement = (metric: 'distance' | 'exitVelocity' | 'launchAngle') => {
    if (sortedSessions.length < 2) return { percent: 0, value: 0 };
    
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

    const firstHalf = sortedSessions.slice(0, Math.floor(sortedSessions.length / 2));
    const secondHalf = sortedSessions.slice(Math.floor(sortedSessions.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, s) => sum + getValue(s), 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, s) => sum + getValue(s), 0) / secondHalf.length;
    
    const percent = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
    const value = secondAvg - firstAvg;
    
    return { percent, value };
  };

  const distanceImprovement = calculateImprovement('distance');
  const velocityImprovement = calculateImprovement('exitVelocity');
  const angleImprovement = calculateImprovement('launchAngle');

  const improvements = [
    {
      label: 'Distance',
      percent: distanceImprovement.percent,
      value: distanceImprovement.value,
      icon: Target,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      label: 'Exit Velocity',
      percent: velocityImprovement.percent,
      value: velocityImprovement.value,
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      label: 'Launch Angle',
      percent: angleImprovement.percent,
      value: angleImprovement.value,
      icon: Award,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Improvement Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {improvements.map((improvement, idx) => {
          const Icon = improvement.icon;
          return (
            <div key={idx} className={`${improvement.bgColor} rounded-lg p-4`}>
              <div className="flex items-center gap-2 mb-2">
                <Icon className={`w-5 h-5 ${improvement.color}`} />
                <span className="text-sm font-medium text-gray-700">{improvement.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">
                {improvement.percent > 0 ? '+' : ''}{improvement.percent.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">
                {improvement.value > 0 ? '+' : ''}{improvement.value.toFixed(1)}
              </div>
            </div>
          );
        })}
      </div>

      {/* Progress Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ProgressChart sessions={sessions} metric="distance" title="Distance Progress" />
        <ProgressChart sessions={sessions} metric="exitVelocity" title="Exit Velocity Progress" />
        <ProgressChart sessions={sessions} metric="launchAngle" title="Launch Angle Progress" />
      </div>
    </div>
  );
}

