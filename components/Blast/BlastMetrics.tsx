'use client';

import React from 'react';
import { TrendingUp, Zap, Gauge, Target } from 'lucide-react';
import type { BlastData } from '@/lib/services/blast-connector';

interface BlastMetricsProps {
  data: BlastData;
}

export default function BlastMetrics({ data }: BlastMetricsProps) {
  const metrics = [
    { label: 'Bat Speed', value: data.batSpeed, unit: 'mph', icon: Zap, color: 'text-blue-600' },
    { label: 'Attack Angle', value: data.attackAngle, unit: '°', icon: Target, color: 'text-green-600' },
    { label: 'Time to Contact', value: data.timeToContact, unit: 'ms', icon: Gauge, color: 'text-purple-600' },
    { label: 'Power', value: data.power, unit: '', icon: TrendingUp, color: 'text-yellow-600' },
    { label: 'Hand Speed', value: data.handSpeed, unit: 'mph', icon: Zap, color: 'text-red-600' },
    { label: 'Connection', value: data.connection, unit: '%', icon: Target, color: 'text-indigo-600' },
  ].filter(metric => metric.value !== undefined && metric.value !== null);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <h2 className="text-xl font-bold text-gray-900 mb-4">Blast Motion Metrics</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric, idx) => {
          const Icon = metric.icon;
          return (
            <div key={idx} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center gap-3 mb-2">
                <Icon className={`w-5 h-5 ${metric.color}`} />
                <span className="text-sm font-medium text-gray-700">{metric.label}</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900">
                  {typeof metric.value === 'number' ? metric.value.toFixed(1) : metric.value}
                </span>
                {metric.unit && (
                  <span className="text-sm text-gray-500">{metric.unit}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {data.onPlane !== undefined && (
        <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm font-medium text-blue-800">
            On Plane: {data.onPlane ? 'Yes ✓' : 'No ✗'}
          </p>
        </div>
      )}
    </div>
  );
}

