'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface AnalysisAnimationProps {
  isAnalyzing: boolean;
  progress?: number;
}

export default function AnalysisAnimation({ isAnalyzing, progress = 0 }: AnalysisAnimationProps) {
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    if (isAnalyzing) {
      setShowAnimation(true);
    } else {
      // Delay hiding to allow animation to complete
      const timer = setTimeout(() => {
        setShowAnimation(false);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAnalyzing]);

  if (!showAnimation) return null;

  return (
    <AnimatePresence>
      {isAnalyzing && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
        >
          {/* Figma Site Embed */}
          <div className="w-full h-full">
            <iframe
              src="https://suds-dried-67057543.figma.site"
              className="w-full h-full border-0"
              allow="autoplay; fullscreen"
              style={{ pointerEvents: 'auto' }}
            />
          </div>

          {/* Optional: Progress indicator overlay */}
          {progress > 0 && (
            <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 w-64">
              <div className="bg-white/20 rounded-full h-2 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                  className="h-full bg-blue-500"
                />
              </div>
              <p className="text-white text-center mt-2 text-sm">{progress}%</p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

