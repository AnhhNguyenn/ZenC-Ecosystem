"use client";

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import CountUp from 'react-countup';
import styles from './RewardScreen.module.scss';
import { Flame, Gem, Medal } from 'lucide-react';

interface RewardScreenProps {
  xpEarned: number;
  coinsEarned: number;
  onClose?: () => void;
}

export function RewardScreen({ xpEarned, coinsEarned, onClose }: RewardScreenProps) {
  const [opened, setOpened] = useState(false);
  const router = useRouter();

  const handleOpenChest = () => {
    if (opened) return;
    setOpened(true);

    // Play "Ting" sound via Base64 URI
    const audio = new Audio("data:audio/mp3;base64,//OExAAAAANIAAAAAExBTUUzLjEwMKqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq");
    audio.volume = 0.5;
    audio.play().catch(() => {});

    // Confetti explosion
    const end = Date.now() + 1.5 * 1000;
    const colors = ['#38bdf8', '#facc15', '#a855f7'];

    (function frame() {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: colors
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: colors
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    }());

    // Vibrate device if supported
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 50, 100]);
    }
  };

  const handleContinue = () => {
    if (onClose) {
      onClose();
    } else {
      router.push('/dashboard');
    }
  };

  return (
    <div className={styles.rewardContainer}>
      {!opened ? (
        <div className={styles.chestWrapper} onClick={handleOpenChest}>
          <div className={`${styles.chestIcon} ${opened ? styles.opened : ''}`}>
            🎁
          </div>
          <p className={styles.tapText}>Chạm để mở quà</p>
        </div>
      ) : (
        <>
          <div className={styles.rewardsList}>
            <div className={styles.rewardItem} style={{ animationDelay: '0.2s' }}>
              <div className={`${styles.rewardValue} ${styles.xp}`}>
                <Flame size={32} />
                <CountUp end={xpEarned} duration={2} suffix=" XP" />
              </div>
              <span className={styles.rewardLabel}>Kinh nghiệm</span>
            </div>

            <div className={styles.rewardItem} style={{ animationDelay: '0.6s' }}>
              <div className={`${styles.rewardValue} ${styles.coin}`}>
                <Gem size={32} />
                <CountUp end={coinsEarned} duration={2.5} />
              </div>
              <span className={styles.rewardLabel}>ZenC Coin</span>
            </div>
          </div>

          <button className={styles.continueBtn} onClick={handleContinue}>
            Tiếp tục
          </button>
        </>
      )}
    </div>
  );
}
