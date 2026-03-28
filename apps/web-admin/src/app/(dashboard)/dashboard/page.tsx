"use client";

import React, { useState, useEffect } from "react";
import {
  PageHeader,
  StatsSection,
  DashboardGrid,
} from "@/components/layouts/PageLayout";
import {
  AdminStats,
  RevenueChart,
  SystemAlerts,
} from "@/features/dashboard/components/AdminWidgets";

export default function AdminDashboardPage() {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Mocking an API load to demonstrate skeleton swapping
    const timer = setTimeout(() => setIsLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  const mockMetrics = {
    totalUsers: 14250,
    activeUsers24h: 3102,
    revenueMRR: 125400,
    growthPercentage: 14.5,
  };

  // 1. The God-Page Anti-Pattern resolved: pure assembly file.
  return (
    <div>
      <PageHeader
        title="Command Center"
        subtitle="Platform vitals and revenue overview."
      />

      {/* Extreme Discipline: 4-Cards Maximum */}
      <StatsSection>
        <AdminStats />
      </StatsSection>

      {/* 70/30 UI Layout Pattern */}
      <DashboardGrid
        mainFeature={<RevenueChart isLoading={isLoading} />}
        secondaryPanel={<SystemAlerts isLoading={isLoading} />}
      />
    </div>
  );
}
