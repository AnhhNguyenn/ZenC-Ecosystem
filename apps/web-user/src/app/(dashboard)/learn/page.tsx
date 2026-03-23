"use client";

import React from 'react';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Play, CheckCircle, Lock } from 'lucide-react';
import styles from './page.module.scss';

const LESSONS = [
  { id: 1, title: 'Introduction to English Basics', status: 'completed', duration: '15 Min' },
  { id: 2, title: 'Everyday Greetings and Farewells', status: 'in-progress', duration: '20 Min', progress: 60 },
  { id: 3, title: 'Ordering Food at a Restaurant', status: 'locked', duration: '25 Min' },
  { id: 4, title: 'Asking for Directions', status: 'locked', duration: '30 Min' },
];

export default function LearnPage() {
  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Learning Path</h1>
        <p className={styles.subtitle}>Continue from where you left off or start a new lesson.</p>
      </header>
      
      <div className={styles.pathContainer}>
        {LESSONS.map((lesson, index) => (
          <div key={lesson.id} className={`${styles.lessonNode} ${styles[lesson.status]}`}>
            <div className={styles.iconContainer}>
              {lesson.status === 'completed' && <CheckCircle size={24} />}
              {lesson.status === 'in-progress' && <Play size={24} />}
              {lesson.status === 'locked' && <Lock size={24} />}
            </div>
            
            <Card className={styles.lessonCard}>
              <div className={styles.lessonInfo}>
                <span className={styles.lessonNumber}>Lesson {index + 1}</span>
                <h3 className={styles.lessonTitle}>{lesson.title}</h3>
                <span className={styles.lessonDuration}>{lesson.duration}</span>
              </div>
              
              {lesson.status === 'in-progress' && (
                <div className={styles.progressSection}>
                  <div className={styles.progressBar}>
                    <div className={styles.progressFill} style={{ width: `${lesson.progress}%` }} />
                  </div>
                  <Button className={styles.resumeBtn}>Resume</Button>
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
