"use client";
import { motion } from 'framer-motion';

interface Planet3DProps {
  image: string;
  name: string;
  size: number;
  color: { r: number; g: number; b: number };
  rotationSpeed?: number;
}

export function Planet3D({ image, name, size, color, rotationSpeed = 20 }: Planet3DProps) {
  return (
    <div className="relative" style={{ transformStyle: 'preserve-3d' }}>
      {/* Outer atmospheric glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle at 40% 40%, 
            rgba(${color.r}, ${color.g}, ${color.b}, 0.5) 0%, 
            rgba(${color.r}, ${color.g}, ${color.b}, 0.3) 40%,
            transparent 70%)`,
          width: size * 1.6,
          height: size * 1.6,
          left: '50%',
          top: '50%',
          transform: 'translate(-50%, -50%)',
          filter: 'blur(40px)'
        }}
        animate={{
          scale: [1, 1.15, 1],
          opacity: [0.6, 1, 0.6]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* Main 3D sphere container */}
      <motion.div
        className="relative rounded-full overflow-hidden"
        style={{
          width: size,
          height: size,
          transformStyle: 'preserve-3d',
          boxShadow: `
            inset -50px -50px 100px rgba(0, 0, 0, 0.85),
            inset 30px 30px 60px rgba(255, 255, 255, 0.12),
            0 0 100px rgba(${color.r}, ${color.g}, ${color.b}, 0.5),
            0 0 200px rgba(${color.r}, ${color.g}, ${color.b}, 0.3)
          `
        }}
        animate={{ rotateZ: [0, 360] }}
        transition={{ duration: rotationSpeed, repeat: Infinity, ease: 'linear' }}
      >
        {/* Base sphere with texture */}
        <div 
          className="absolute inset-0 w-full h-full rounded-full overflow-hidden"
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* Planet texture layer */}
          <motion.div
            className="absolute inset-0 w-full h-full"
            style={{
              backgroundImage: `url(${image})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'brightness(1.2) contrast(1.15) saturate(1.1)'
            }}
            animate={{ 
              backgroundPosition: ['0% center', '100% center']
            }}
            transition={{
              duration: rotationSpeed * 2,
              repeat: Infinity,
              ease: 'linear'
            }}
          />

          {/* Multiple sphere depth layers for 3D effect */}
          {[...Array(8)].map((_, i) => {
            const depth = i * 12.5;
            const scale = 1 - (i * 0.02);
            const opacity = 0.15 - (i * 0.015);
            
            return (
              <div
                key={i}
                className="absolute inset-0 rounded-full border border-white"
                style={{
                  transform: `translateZ(${depth}px) scale(${scale})`,
                  transformStyle: 'preserve-3d',
                  opacity: opacity,
                  boxShadow: 'inset 0 0 20px rgba(255,255,255,0.1)'
                }}
              />
            );
          })}
        </div>

        {/* Specular highlight (sun reflection) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 35% 28%, rgba(255,255,255,0.75) 0%, rgba(255,255,255,0.3) 18%, transparent 40%)',
            mixBlendMode: 'screen'
          }}
        />

        {/* Subsurface scattering effect */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 30% 30%, 
              rgba(${color.r + 50}, ${color.g + 50}, ${color.b + 50}, 0.3) 0%, 
              transparent 50%)`,
            mixBlendMode: 'overlay'
          }}
        />

        {/* Terminator shadow (day/night divide) */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(circle at 72% 72%, transparent 25%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.9) 85%)'
          }}
        />

        {/* Rim light effect */}
        <div
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            background: 'radial-gradient(ellipse at 85% 50%, rgba(255,255,255,0.25) 0%, transparent 30%)',
            mixBlendMode: 'screen'
          }}
        />

        {/* Atmospheric scattering on edge */}
        <div
          className="absolute inset-0 pointer-events-none rounded-full"
          style={{
            boxShadow: `inset 0 0 60px rgba(${color.r}, ${color.g}, ${color.b}, 0.4)`,
            border: `1px solid rgba(${color.r}, ${color.g}, ${color.b}, 0.3)`
          }}
        />
      </motion.div>

      {/* Animated lens flare */}
      <motion.div
        className="absolute top-1/4 left-1/4 rounded-full pointer-events-none"
        style={{
          width: size * 0.15,
          height: size * 0.15,
          background: 'radial-gradient(circle, rgba(255,255,255,0.9), rgba(255,255,255,0.3) 50%, transparent 70%)',
          filter: 'blur(10px)',
          mixBlendMode: 'screen'
        }}
        animate={{
          opacity: [0.3, 0.8, 0.3],
          scale: [0.8, 1.3, 0.8]
        }}
        transition={{
          duration: 2.5,
          repeat: Infinity,
          ease: 'easeInOut'
        }}
      />

      {/* Secondary lens flare */}
      <motion.div
        className="absolute top-1/3 left-1/3 rounded-full pointer-events-none"
        style={{
          width: size * 0.08,
          height: size * 0.08,
          background: 'radial-gradient(circle, rgba(255,255,255,0.6), transparent 60%)',
          filter: 'blur(8px)',
          mixBlendMode: 'screen'
        }}
        animate={{
          opacity: [0.2, 0.5, 0.2],
          scale: [1, 1.5, 1]
        }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: 'easeInOut',
          delay: 0.5
        }}
      />
    </div>
  );
}

