'use client';

import React from 'react';
import { Target, Clock, Users, Play } from 'lucide-react';
import type { Drill } from '@/lib/services/drill-recommender';

interface DrillCardProps {
  drill: Drill;
  onSelect?: (drill: Drill) => void;
}

export default function DrillCard({ drill, onSelect }: DrillCardProps) {
  const difficultyColors = {
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">{drill.name}</h3>
          <p className="text-sm text-gray-600 mb-3">{drill.description}</p>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${difficultyColors[drill.difficulty]}`}>
          {drill.difficulty}
        </span>
      </div>

      <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
        <div className="flex items-center gap-1">
          <Clock className="w-4 h-4" />
          <span>{drill.duration} min</span>
        </div>
        <div className="flex items-center gap-1">
          <Target className="w-4 h-4" />
          <span>{drill.reps} reps</span>
        </div>
        {drill.equipment && drill.equipment.length > 0 && (
          <div className="flex items-center gap-1">
            <Users className="w-4 h-4" />
            <span>{drill.equipment.join(', ')}</span>
          </div>
        )}
      </div>

      {drill.instructions && drill.instructions.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Instructions:</h4>
          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600">
            {drill.instructions.slice(0, 3).map((instruction, idx) => (
              <li key={idx}>{instruction}</li>
            ))}
            {drill.instructions.length > 3 && (
              <li className="text-blue-600">...and {drill.instructions.length - 3} more steps</li>
            )}
          </ol>
        </div>
      )}

      {drill.corrections && drill.corrections.length > 0 && (
        <div className="mb-4">
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Targets:</h4>
          <div className="flex flex-wrap gap-2">
            {drill.corrections.map((correction, idx) => (
              <span
                key={idx}
                className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs font-medium"
              >
                {correction.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
      )}

      {onSelect && (
        <button
          onClick={() => onSelect(drill)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          <Play className="w-4 h-4" />
          View Details
        </button>
      )}
    </div>
  );
}

