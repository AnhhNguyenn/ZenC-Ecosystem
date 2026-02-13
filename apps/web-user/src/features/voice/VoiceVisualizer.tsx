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
      setBars(prev => prev.map(() => {
        if (state === 'thinking') return 15 + Math.random() * 10;
        const multiplier = state === 'speaking' || state === 'listening' ? 50 : 20;
        return 10 + Math.random() * multiplier * (audioLevel + 0.5);
      }));
    }, 100);

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
