"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { 
  Home, 
  BookOpen, 
  Mic, 
  Trophy, 
  Settings, 
  LogOut,
  Sparkles
} from 'lucide-react';
import { Logo } from '@/components/ui/Logo';
import styles from './Sidebar.module.scss';

const NAV_ITEMS = [
  { label: 'Dashboard', icon: Home, href: '/dashboard' },
  { label: 'Learn', icon: BookOpen, href: '/learn' },
  { label: 'Practice', icon: Mic, href: '/practice' },
  { label: 'Achievements', icon: Trophy, href: '/achievements' },
  { label: 'Settings', icon: Settings, href: '/settings' },
];

export const Sidebar = () => {
  const pathname = usePathname();

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <Logo />
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          const Icon = item.icon;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(styles.navItem, isActive && styles.active)}
            >
              <Icon className={styles.navIcon} size={20} />
              <span className={styles.navLabel}>{item.label}</span>
              {isActive && <div className={styles.activeIndicator} />}
            </Link>
          );
        })}
      </nav>
      
      <div className={styles.footer}>
        <div className={styles.upgradeCard}>
          <div className={styles.upgradeContent}>
            <Sparkles size={16} className={styles.sparkleIcon} />
            <span className={styles.upgradeTitle}>Pro Plan</span>
            <p className={styles.upgradeDesc}>Unlock all features</p>
          </div>
        </div>

        <button className={styles.logoutButton}>
          <LogOut size={20} />
          <span>Log out</span>
        </button>
      </div>
    </aside>
  );
};
