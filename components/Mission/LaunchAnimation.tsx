'use client';

import { useEffect, useState } from 'react';
import { Rocket, Trophy } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { getZone, getMilestone, getProgressToNext, getVelocityFeedback } from '@/lib/game/zones';

interface LaunchAnimationProps {
  distanceFt: number;
  exitVelocity: number;
  zone: string;
  milestone: string;
  progress: number;
}

export default function LaunchAnimation({
  distanceFt,
  exitVelocity,
  zone,
  milestone,
  progress,
}: LaunchAnimationProps) {
  const [showAnimation, setShowAnimation] = useState(true);
  const velocityFeedback = getVelocityFeedback(exitVelocity);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowAnimation(false);
    }, 5000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-6">
      <AnimatePresence>
        {showAnimation && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="relative h-64 bg-gradient-to-b from-blue-900 via-blue-600 to-gray-900 rounded-lg overflow-hidden"
          >
            <motion.div
              initial={{ y: 200 }}
              animate={{ y: -100 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="absolute bottom-0 left-1/2 transform -translate-x-1/2"
            >
              <Rocket className="w-16 h-16 text-yellow-400" />
            </motion.div>
            <div className="absolute inset-0 flex items-center justify-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 1, type: 'spring' }}
                className="text-center text-white"
              >
                <div className="text-4xl font-bold mb-2">{distanceFt.toFixed(0)} ft</div>
                <div className="text-xl">{milestone}</div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-4">
        <div className="p-6 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg">
          <div className="flex items-center gap-3 mb-4">
            <Trophy className="w-8 h-8 text-yellow-500" />
            <h3 className="text-2xl font-bold text-gray-900">Mission Results</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Distance:</span>
              <span className="text-2xl font-bold text-blue-600">{distanceFt.toFixed(0)} ft</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Zone:</span>
              <span className="text-xl font-semibold text-purple-600">{zone}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Exit Velocity:</span>
              <span className="text-xl font-semibold text-gray-900">{exitVelocity} mph</span>
            </div>
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg">
          <p className="text-green-800 font-medium">{velocityFeedback}</p>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600">
            <span>Progress to next zone</span>
            <span>{(progress * 100).toFixed(0)}%</span>
          </div>
          <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress * 100}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
}


