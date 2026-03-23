import React from "react";
import styles from "./PageLayout.module.scss";

export function PageHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className={styles.pageHeader}>
      <h1 className={styles.title}>{title}</h1>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}

export function StatsSection({ children }: { children: React.ReactNode }) {
  // Enforces 4-card maximum visually via the SCSS grid configuration
  return <div className={styles.statsSection}>{children}</div>;
}

export function DashboardGrid({
  mainFeature,
  secondaryPanel,
}: {
  mainFeature: React.ReactNode;
  secondaryPanel?: React.ReactNode;
}) {
  if (!secondaryPanel) {
    return <div>{mainFeature}</div>; // Fills 100% width if no panel
  }

  return (
    <div className={styles.dashboardGrid}>
      <div>{mainFeature}</div>
      <div>{secondaryPanel}</div>
    </div>
  );
}
