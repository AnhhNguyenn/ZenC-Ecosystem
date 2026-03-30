import React from 'react';
import { useRouter } from 'next/navigation';
import styles from './EmptyState.module.scss';
import { Bot } from 'lucide-react';

export function DashboardEmptyState() {
  const router = useRouter();

  return (
    <div className={styles.emptyStateContainer}>
      <div className={styles.illustrationWrapper}>
        <div className={styles.botIconContainer}>
          <Bot className={styles.botIcon} size={64} />
        </div>
      </div>

      <h1 className={styles.title}>
        Hành trình vạn dặm bắt đầu từ một bước chân.
      </h1>

      <p className={styles.subtitle}>
        Bạn đã sẵn sàng để nâng tầm tiếng Anh của mình cùng Gia sư AI thông minh nhất?
      </p>

      <button
        className={styles.ctaButton}
        onClick={() => router.push('/voice')}
      >
        Bắt đầu bài test AI ngay
        <div className={styles.pulseRing}></div>
      </button>
    </div>
  );
}
