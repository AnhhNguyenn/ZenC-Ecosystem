"use client";

import React, { useEffect, useState } from 'react';
import { clsx } from 'clsx';
import styles from './VoiceVisualizer.module.scss';

interface VoiceVisualizerProps {
  state: 'idle' | 'listening' | 'thinking' | 'speaking';
  audioLevel?: number; // 0-1
}

const VoiceVisualizer: React.FC<VoiceVisualizerProps> = ({ state, audioLevel = 0 }) => {
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const requestRef = React.useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Handle high DPI displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    // Set actual canvas size
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Normalize coordinate system to use css pixels
    ctx.scale(dpr, dpr);

    // Constants for drawing
    const numBars = 12;
    const gap = 4;
    const totalGapWidth = (numBars - 1) * gap;
    const barWidth = (rect.width - totalGapWidth) / numBars;
    const centerY = rect.height / 2;

    const animate = () => {
      ctx.clearRect(0, 0, rect.width, rect.height);
      const now = Date.now() / 1000;

      for (let i = 0; i < numBars; i++) {
        let height = 10; // Default base height

        if (state === 'thinking') {
           // Gentle pulsing wave for "thinking" state
           height = 12 + Math.sin(now * 3 + i * 0.5) * 5;
        } else if (state !== 'idle') {
           // Active listening/speaking
           const wave = Math.sin(now * 4 + i * 0.8) * 0.3 + 0.7;
           const multiplier = state === 'speaking' || state === 'listening' ? 50 : 20;
           height = 10 + multiplier * audioLevel * wave;
        }

        const x = i * (barWidth + gap);
        const y = centerY - height / 2;

        // Draw rounded rectangle
        ctx.fillStyle = 'var(--color-primary)';
        ctx.beginPath();
        ctx.roundRect(x, y, barWidth, height, barWidth / 2);
        ctx.fill();
      }

      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);

    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [state, audioLevel]);

  return (
    <div className={clsx(styles.container, styles[state])}>
      <div className={styles.avatarCircle}>
        <div className={styles.glow} />
        {/* Central visual */}
        <div className={styles.core} />
      </div>

      <div className={styles.waveWrapper}>
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100px', display: 'block' }}
        />
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

export default VoiceVisualizer;
