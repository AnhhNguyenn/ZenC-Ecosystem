"use client";

import React from "react";
import {
  PageHeader,
  StatsSection,
  DashboardGrid,
} from "@/components/layouts/PageLayout";
import {
  DashboardStats,
  LearningProgress,
  ActivityFeed,
} from "@/features/dashboard/components/DashboardWidgets";
import { useUserQuery } from "@/hooks/useAuth"; // Reusing auth hook for profile payload which has stats

export default function DashboardPage() {
  // 1. Fetch data utilizing React Query Server State (15% State Rule)
  const { data: user, isLoading } = useUserQuery();
  
  // NOTE: In a real system the stats would be fetched from `useUserStatsQuery`. 
  // We mock the mapping here for V14 architectural demonstration.
  const mockStats = {
    totalXp: 1250,
    currentStreak: 4,
    accuracy: 94,
    lessonsCompleted: 12,
  };

  // 2. God-Page Anti-Pattern resolved: This file ONLY assembles components. No business logic.
  return (
    <div>
      <PageHeader
        title={`Welcome back, ${user?.fullName || "Learner"}`}
        subtitle="Here is your learning overview for today."
      />

      {/* 4 Cards Stats Segment */}
      <StatsSection>
        <DashboardStats isLoading={isLoading} data={mockStats} />
      </StatsSection>

      {/* 70/30 Split Layout Pattern Segment */}
      <DashboardGrid
        mainFeature={<LearningProgress isLoading={isLoading} />}
        secondaryPanel={<ActivityFeed isLoading={isLoading} />}
      />
    </div>
  );
}
