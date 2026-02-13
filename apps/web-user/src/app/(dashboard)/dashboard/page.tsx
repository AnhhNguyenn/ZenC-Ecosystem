"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Flame, Trophy, Star, ArrowRight, Play } from 'lucide-react';
import styles from './page.module.scss';
import Link from 'next/link';

import { useUserStats } from '@/hooks/useUserStats';
import { useAuth } from '@/features/auth/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, isLoading } = useUserStats();

  return (
    <div className={styles.container}>
      {/* Welcome Section */}
      <section className={styles.welcomeSection}>
        <h1 className={styles.greeting}>Welcome back, {user?.name || 'Learner'}! 👋</h1>
        <p className={styles.subtitle}>Ready to master English conversion today?</p>
      </section>

      {/* Stats Grid */}
      <section className={styles.statsGrid}>
        <Card className={styles.statCard}>
          <div className={styles.statIconWrapper} data-type="streak">
            <Flame size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{isLoading ? '-' : stats.streak}</span>
            <span className={styles.statLabel}>Day Streak</span>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statIconWrapper} data-type="xp">
            <Star size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{isLoading ? '-' : stats.totalXp}</span>
            <span className={styles.statLabel}>Total XP</span>
          </div>
        </Card>

        <Card className={styles.statCard}>
          <div className={styles.statIconWrapper} data-type="league">
            <Trophy size={24} />
          </div>
          <div className={styles.statInfo}>
            <span className={styles.statValue}>{isLoading ? '-' : stats.currentLeague}</span>
            <span className={styles.statLabel}>Current League</span>
          </div>
        </Card>
      </section>

      <div className={styles.contentGrid}>
        {/* Main Content: Daily Challenge & Course */}
        <div className={styles.mainColumn}>
          {/* Daily Challenge */}
          <Card className={styles.challengeCard}>
            <div className={styles.challengeContent}>
              <div className={styles.challengeText}>
                <span className={styles.tag}>Daily Challenge</span>
                <h3 className={styles.challengeTitle}>Describe Your Morning Routine</h3>
                <p className={styles.challengeDesc}>Practice past tense verbs in a 2-minute speaking session.</p>
              </div>
              <Button size="lg" className={styles.startButton}>
                Start Now <ArrowRight size={18} style={{ marginLeft: 8 }} />
              </Button>
            </div>
            <div className={styles.challengeDecoration} />
          </Card>

          {/* Continue Learning */}
          <section className={styles.courseSection}>
            <h2 className={styles.sectionTitle}>Continue Learning</h2>
            <Card className={styles.courseCard}>
              <div className={styles.courseImage} />
              <div className={styles.courseInfo}>
                <div className={styles.courseHeader}>
                  <span className={styles.courseUnit}>Unit 3: Travel & Commute</span>
                  <span className={styles.courseProgress}>60% Complete</span>
                </div>
                <h3 className={styles.courseTitle}>Asking for Directions at a Station</h3>
                <div className={styles.progressBar}>
                  <div className={styles.progressFill} style={{ width: '60%' }} />
                </div>
                <Button className={styles.continueButton}>
                  <Play size={16} fill="currentColor" style={{ marginRight: 8 }} />
                  Continue Lesson
                </Button>
              </div>
            </Card>
          </section>
        </div>

        {/* Sidebar Column: Leaderboard & Friends */}
        <div className={styles.sideColumn}>
          <Card className={styles.leaderboardCard}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardTitle}>Leaderboard</h3>
              <Link href="/leaderboard" className={styles.viewAll}>View All</Link>
            </div>
            <ul className={styles.leaderboardList}>
              {[1, 2, 3, 4, 5].map((i) => (
                <li key={i} className={styles.leaderboardItem}>
                  <span className={styles.rank}>{i}</span>
                  <div className={styles.userAvatar} />
                  <span className={styles.userName}>User {i}</span>
                  <span className={styles.userXp}>{1000 - i * 50} XP</span>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
