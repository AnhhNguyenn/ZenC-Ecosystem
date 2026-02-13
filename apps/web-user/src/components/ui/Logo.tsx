import React from 'react';
import { clsx } from 'clsx';
import { Sparkles } from 'lucide-react';
import styles from './Logo.module.scss';
import Link from 'next/link';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const Logo: React.FC<LogoProps> = ({ className, size = 'md' }) => {
  return (
    <Link href="/" className={clsx(styles.logo, styles[size], className)}>
      <div className={styles.iconWrapper}>
        <Sparkles className={styles.icon} />
      </div>
      <span className={styles.text}>ZenC<span className={styles.highlight}>AI</span></span>
    </Link>
  );
};
