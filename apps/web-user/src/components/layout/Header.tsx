"use client";

import React from 'react';
import { Bell, Search } from 'lucide-react';
import styles from './Header.module.scss';
import { Button } from '@/components/ui/Button';

export const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.searchWrapper}>
        <Search className={styles.searchIcon} size={20} />
        <input 
          type="text" 
          placeholder="Search for lessons, topics..." 
          className={styles.searchInput}
        />
      </div>

      <div className={styles.actions}>
        <div className={styles.streakBadge}>
          🔥 5 Days
        </div>

        <button className={styles.iconButton}>
          <Bell size={20} />
          <span className={styles.notificationDot} />
        </button>
        
        <div className={styles.userAvatar}>
          <span className={styles.initials}>JD</span>
        </div>
      </div>
    </header>
  );
};
