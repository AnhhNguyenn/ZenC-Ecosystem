"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Trophy, Flame, Star, Zap, Shield, Target } from 'lucide-react';
import styles from './page.module.scss';
import { useUserStats } from '@/hooks/useUserStats';

const BADGES = [
  { id: 1, name: 'First Words', desc: 'Completed the first speaking challenge.', icon: MessageCircle, color: '#3b82f6', earned: true },
  { id: 2, name: 'Grammar Guru', desc: 'Achieved 100% grammar score in 5 sessions.', icon: Shield, color: '#10b981', earned: true },
  { id: 3, name: '7-Day Streak', desc: 'Practiced consistently for 7 days.', icon: Flame, color: '#f59e0b', earned: false },
  { id: 4, name: 'Sharpshooter', desc: 'Answered 50 flashcards correctly in a row.', icon: Target, color: '#ef4444', earned: false },
  { id: 5, name: 'Speed Demon', desc: 'Fastest response time in Top 10%.', icon: Zap, color: '#a855f7', earned: false },
  { id: 6, name: 'Zen Master', desc: 'Reached Level 50.', icon: Star, color: '#eab308', earned: false },
];

function MessageCircle(props: any) {
  // Polyfill for MessageCircle from lucide-react if not imported
  return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>;
}

export default function AchievementsPage() {
  const { stats, isLoading } = useUserStats();

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <h1 className={styles.title}>Your Achievements</h1>
          <p className={styles.subtitle}>Track your progress and collect badges.</p>
        </div>
        <div className={styles.leagueBanner}>
          <Trophy size={32} className={styles.leagueIcon} />
          <div className={styles.leagueInfo}>
             <span className={styles.leagueLabel}>Current League</span>
             <span className={styles.leagueName}>{isLoading ? 'Loading...' : stats.currentLeague}</span>
          </div>
        </div>
      </header>

      <section className={styles.statsOverview}>
        <Card className={styles.overviewCard}>
          <Flame size={28} className={styles.streakIcon} />
          <div className={styles.overviewText}>
            <span className={styles.overviewValue}>{isLoading ? '-' : stats.streak}</span>
            <span className={styles.overviewLabel}>Day Streak</span>
          </div>
        </Card>
        
        <Card className={styles.overviewCard}>
          <Star size={28} className={styles.xpIcon} />
          <div className={styles.overviewText}>
            <span className={styles.overviewValue}>{isLoading ? '-' : stats.totalXp}</span>
            <span className={styles.overviewLabel}>Total XP</span>
          </div>
        </Card>

        <Card className={styles.overviewCard}>
          <Target size={28} className={styles.accuracyIcon} />
          <div className={styles.overviewText}>
            <span className={styles.overviewValue}>92%</span>
            <span className={styles.overviewLabel}>Avg. Accuracy</span>
          </div>
        </Card>
      </section>

      <section className={styles.badgesSection}>
        <h2 className={styles.sectionTitle}>Badges Collection</h2>
        <div className={styles.badgesGrid}>
          {BADGES.map((badge) => {
            const Icon = badge.icon;
            return (
              <Card key={badge.id} className={`${styles.badgeCard} ${badge.earned ? styles.earned : styles.locked}`}>
                <div 
                  className={styles.badgeIconWrapper} 
                  style={{ backgroundColor: badge.earned ? `${badge.color}20` : '#f3f4f6' }}
                >
                  <Icon size={32} color={badge.earned ? badge.color : '#9ca3af'} />
                </div>
                <h3 className={styles.badgeName}>{badge.name}</h3>
                <p className={styles.badgeDesc}>{badge.desc}</p>
                {!badge.earned && <div className={styles.lockOverlay}><span className={styles.lockText}>Locked</span></div>}
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
