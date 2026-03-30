"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Mic, Headphones, ArrowRight, MessageSquare, BookOpen } from 'lucide-react';
import styles from './page.module.scss';
import Link from 'next/link';

export default function PracticePage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Practice Arena</h1>
        <p className={styles.subtitle}>Choose an exercise to improve your skills today.</p>
      </header>

      <div className={styles.grid}>
        {/* Highlighted Practice Mode */}
        <Card className={`${styles.practiceCard} ${styles.featured}`}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.primaryIcon}`}>
              <Mic size={28} />
            </div>
            <span className={styles.badge}>Recommended</span>
          </div>
          <div className={styles.cardBody}>
            <h3 className={styles.cardTitle}>Native Audio Dialog</h3>
            <p className={styles.cardDesc}>
              Practice speaking with our advanced AI. Get real-time grammar feedback and pronunciation scoring.
            </p>
            <div className={styles.features}>
              <span><Headphones size={14} /> Real-time Voice</span>
              <span><MessageSquare size={14} /> Instant Feedback</span>
            </div>
          </div>
          <div className={styles.cardFooter}>
            <Link href="/practice/voice" passHref>
              <Button size="lg" className={styles.startBtn}>
                Start Session <ArrowRight size={18} className={styles.btnIcon} />
              </Button>
            </Link>
          </div>
        </Card>

        {/* Other Practice Modes */}
        <Card className={styles.practiceCard}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.secondaryIcon}`}>
              <BookOpen size={24} />
            </div>
          </div>
          <div className={styles.cardBody}>
            <h3 className={styles.cardTitle}>Vocabulary Builder</h3>
            <p className={styles.cardDesc}>
              Learn new words through spaced repetition flashcards based on your recent lessons.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Button variant="secondary" className={styles.startBtn}>
              Coming Soon
            </Button>
          </div>
        </Card>

        <Card className={styles.practiceCard}>
          <div className={styles.cardHeader}>
            <div className={`${styles.iconWrapper} ${styles.tertiaryIcon}`}>
              <MessageSquare size={24} />
            </div>
          </div>
          <div className={styles.cardBody}>
            <h3 className={styles.cardTitle}>Grammar Quizzes</h3>
            <p className={styles.cardDesc}>
              Test your knowledge with quick 5-minute grammar exercises tailored to your level.
            </p>
          </div>
          <div className={styles.cardFooter}>
            <Button variant="secondary" className={styles.startBtn}>
              Coming Soon
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
