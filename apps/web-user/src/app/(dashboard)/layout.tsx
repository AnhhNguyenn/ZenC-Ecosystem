import React from 'react';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import styles from './layout.module.scss';
import QueryProvider from '@/components/providers/QueryProvider';
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "ZenC | Dashboard",
  description: "Track your progress",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <QueryProvider>
      <div className={styles.container}>
        <Sidebar />
        <div className={styles.contentWrapper}>
          <Header />
          <main className={styles.mainContent}>
            {children}
          </main>
        </div>
      </div>
    </QueryProvider>
  );
}
