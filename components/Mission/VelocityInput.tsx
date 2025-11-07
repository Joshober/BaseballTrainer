'use client';

import { useState } from 'react';
import { Gauge } from 'lucide-react';

interface VelocityInputProps {
  value: number;
  onChange: (value: number) => void;
}

const VELOCITY_BANDS = [
  { label: '< 70 mph', min: 0, max: 70 },
  { label: '70-90 mph', min: 70, max: 90 },
  { label: '90-105 mph', min: 90, max: 105 },
  { label: '105+ mph', min: 105, max: 150 },
];

export default function VelocityInput({ value, onChange }: VelocityInputProps) {
  const [inputMode, setInputMode] = useState<'number' | 'slider'>('number');

  const handleBandSelect = (band: typeof VELOCITY_BANDS[0]) => {
    // Set to middle of band
    const midValue = (band.min + band.max) / 2;
    onChange(Math.round(midValue));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Gauge className="w-5 h-5 text-blue-600" />
        <h3 className="text-lg font-semibold">Exit Velocity</h3>
      </div>

      <div className="flex gap-2 p-1 bg-gray-100 rounded-lg">
        <button
          onClick={() => setInputMode('number')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            inputMode === 'number'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Number
        </button>
        <button
          onClick={() => setInputMode('slider')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            inputMode === 'slider'
              ? 'bg-white text-blue-600 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          Slider
        </button>
      </div>

      {inputMode === 'number' ? (
        <div>
          <input
            type="number"
            min="0"
            max="150"
            step="1"
            value={value || ''}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg"
            placeholder="Enter exit velocity (mph)"
          />
        </div>
      ) : (
        <div className="space-y-4">
          <input
            type="range"
            min="0"
            max="150"
            step="1"
            value={value || 0}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
          />
          <div className="text-center text-2xl font-bold text-blue-600">
            {value || 0} mph
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        {VELOCITY_BANDS.map((band) => (
          <button
            key={band.label}
            onClick={() => handleBandSelect(band)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              value >= band.min && value < band.max
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {band.label}
          </button>
        ))}
      </div>
    </div>
  );
}

