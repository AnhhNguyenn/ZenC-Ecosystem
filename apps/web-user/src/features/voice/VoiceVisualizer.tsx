"use client";

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import styles from './VoiceVisualizer.module.scss';

interface VoiceVisualizerProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  audioLevel?: number; // 0-1
}

export const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ state, audioLevel = 0 }) => {
  // Simulate random wave movement when active
  const [bars, setBars] = useState<number[]>(new Array(12).fill(10));

  useEffect(() => {
    if (state === 'idle') {
      setBars(new Array(12).fill(10));
      return;
    }

    const interval = setInterval(() => {
      const now = Date.now() / 1000;
      setBars(prev => prev.map((_, i) => {
        if (state === 'thinking') {
          // Gentle pulsing wave for "thinking" state
          return 12 + Math.sin(now * 3 + i * 0.5) * 5;
        }
        // Drive bars from real audio level with organic wave offset
        const wave = Math.sin(now * 4 + i * 0.8) * 0.3 + 0.7;
        const base = 10;
        const multiplier = state === 'speaking' || state === 'listening' ? 50 : 20;
        return base + multiplier * audioLevel * wave;
      }));
    }, 80);

    return () => clearInterval(interval);
  }, [state, audioLevel]);

  return (
    <div className={clsx(styles.container, styles[state])}>
      <div className={styles.avatarCircle}>
        <div className={styles.glow} />
        {/* Central visual */}
        <div className={styles.core} />
      </div>

      <div className={styles.waveWrapper}>
        {bars.map((height, i) => (
          <div 
            key={i} 
            className={styles.bar} 
            style={{ height: `${height}px` }} 
          />
        ))}
      </div>

      <div className={styles.statusText}>
        {state === 'idle' && 'Tap microphone to start'}
        {state === 'listening' && 'Listening...'}
        {state === 'thinking' && 'Processing...'}
        {state === 'speaking' && 'Speaking...'}
      </div>
    </div>
  );
};
