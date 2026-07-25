import { useVideoPlayer } from '@/lib/video/hooks';
import { AnimatePresence, motion } from 'framer-motion';

import { Scene0 } from './video_scenes/Scene0';
import { Scene1 } from './video_scenes/Scene1';
import { Scene2 } from './video_scenes/Scene2';
import { Scene3 } from './video_scenes/Scene3';
import { Scene4 } from './video_scenes/Scene4';
import { Scene5 } from './video_scenes/Scene5';

const SCENE_DURATIONS = {
  0: 6000, // Hook
  1: 8000, // Problem
  2: 8000, // Brand Reveal
  3: 22000, // Pipeline
  4: 8000, // Demo
  5: 8000, // Outro
};

export default function VideoTemplate() {
  const { currentScene } = useVideoPlayer({
    durations: SCENE_DURATIONS,
  });

  return (
    <div
      className="w-full h-[100vh] overflow-hidden relative"
      style={{ backgroundColor: 'var(--color-bg-dark)' }}
    >
      {/* Background layer - Persists across all scenes */}
      <motion.div
        className="absolute inset-0 z-0 opacity-40 mix-blend-screen pointer-events-none"
        style={{
          backgroundImage: `url('${import.meta.env.BASE_URL}attached_assets/generated_images/tech-bg.png')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
        animate={{
          scale: [1, 1.05, 1],
          opacity: [0.3, 0.4, 0.3],
          filter: [
            'hue-rotate(0deg)',
            'hue-rotate(15deg)',
            'hue-rotate(0deg)'
          ]
        }}
        transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-0 z-0 bg-gradient-to-t from-primary/90 to-transparent pointer-events-none" />

      {/* Noise Texture */}
      <div className="absolute inset-0 z-50 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\'/%3E%3C/svg%3E")' }} />

      <AnimatePresence mode="popLayout">
        {currentScene === 0 && <Scene0 key="scene0" />}
        {currentScene === 1 && <Scene1 key="scene1" />}
        {currentScene === 2 && <Scene2 key="scene2" />}
        {currentScene === 3 && <Scene3 key="scene3" />}
        {currentScene === 4 && <Scene4 key="scene4" />}
        {currentScene === 5 && <Scene5 key="scene5" />}
      </AnimatePresence>
    </div>
  );
}
