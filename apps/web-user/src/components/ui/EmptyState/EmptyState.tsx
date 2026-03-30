import React from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Flame } from 'lucide-react';
import styles from './EmptyState.module.scss';

interface EmptyStateProps {
  title?: string;
  description?: string;
  actionText?: string;
  onAction?: () => void;
}

export function EmptyState({
  title = "Cuộc hành trình vạn dặm bắt đầu từ một bước chân.",
  description = "Bạn đã sẵn sàng để bắt đầu chưa?",
  actionText = "Làm bài Test Trình Độ Đầu Vào",
  onAction,
}: EmptyStateProps) {
  const router = useRouter();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      router.push('/dashboard/lessons');
    }
  };

  return (
    <Card className={styles.emptyCard}>
      <CardContent className={styles.content}>
        <div className={styles.illustration}>
          {/* A majestic flame to signify starting the streak/journey */}
          <Flame size={80} className={styles.flameIcon} />
        </div>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.description}>{description}</p>

        <Button
          variant="primary"
          size="lg"
          className={styles.pulseButton}
          onClick={handleAction}
        >
          {actionText}
        </Button>
      </CardContent>
    </Card>
  );
}
