import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState/EmptyState";
import { Flame } from "lucide-react";

// 1. STATS: 4-Card System Rule Enforced Here
export function DashboardStats({
  isLoading,
  data,
}: {
  isLoading: boolean;
  data?: any;
}) {
  if (isLoading) {
    return (
      <>
        <Skeleton style={{ height: "120px" }} />
        <Skeleton style={{ height: "120px" }} />
        <Skeleton style={{ height: "120px" }} />
        <Skeleton style={{ height: "120px" }} />
      </>
    );
  }

  return (
    <>
      <Card hoverable>
        <CardHeader>
          <CardTitle>Total XP</CardTitle>
          <CardDescription>All-time points</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>
            {data?.totalXp || 0}
          </div>
        </CardContent>
      </Card>
      
      <Card hoverable>
        <CardHeader>
          <CardTitle>Current Streak</CardTitle>
          <CardDescription>Consecutive days</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: "24px", fontWeight: 700, display: "flex", alignItems: "center", gap: "4px" }}>
            {data?.currentStreak || 0}
            <Flame size={24} color="#f97316" />
          </div>
        </CardContent>
      </Card>

      <Card hoverable>
        <CardHeader>
          <CardTitle>Accuracy</CardTitle>
          <CardDescription>Average performance</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>
            {data?.accuracy || 0}%
          </div>
        </CardContent>
      </Card>

      <Card hoverable>
        <CardHeader>
          <CardTitle>Lessons Done</CardTitle>
          <CardDescription>Total completed</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>
            {data?.lessonsCompleted || 0}
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// 2. MAIN FEATURE: 70% Layout Focus Component
export function LearningProgress({ isLoading, data }: { isLoading: boolean; data?: any }) {
  if (isLoading) {
    return <Skeleton style={{ height: "400px" }} />;
  }

  // Check if it's a new user with no lessons/XP
  const isNewUser = !data?.totalXp && !data?.lessonsCompleted;

  if (isNewUser) {
    return <EmptyState />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Learning Journey</CardTitle>
        <CardDescription>Your weekly progress trajectory</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--color-neutral-400)" }}>
          [ Chart Graphic Placeholder ]
        </div>
      </CardContent>
    </Card>
  );
}

// 3. SECONDARY PANEL: 30% Panel Layout Component
export function ActivityFeed({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton style={{ height: "400px" }} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
        <div style={{ fontSize: "var(--font-size-meta)", color: "var(--color-neutral-600)" }}>
          <strong>Completed Lesson:</strong> Basics of APIs - 2 hours ago
        </div>
        <div style={{ borderTop: "1px solid var(--color-neutral-200)", paddingTop: "var(--spacing-sm)", fontSize: "var(--font-size-meta)", color: "var(--color-neutral-600)" }}>
          <strong>Earned Badge:</strong> 3-day Streak - Yesterday
        </div>
      </CardContent>
    </Card>
  );
}
