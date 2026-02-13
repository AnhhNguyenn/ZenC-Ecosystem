import styles from './layout.module.scss';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Authentication | ZenC AI',
  description: 'Login or create an account to start your English mastery journey.',
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className={styles.container}>
      <div className={styles.pattern} />
      <main className={styles.main}>
        {children}
      </main>
    </div>
  );
}
