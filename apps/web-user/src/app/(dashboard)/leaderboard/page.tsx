"use client";

import React from "react";
import { PageHeader } from "@/components/layouts/PageLayout";
import { Card, CardContent } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLeaderboardQuery } from "@/features/leaderboard/hooks/useLeaderboard";

export default function LeaderboardPage() {
  // Logic attached: Pulling real data via React Query
  const { data: leaderboardData, isLoading, isError } = useLeaderboardQuery();
  return (
    <div style={{ maxWidth: "800px", margin: "0 auto" }}>
      <PageHeader
        title="Global Leaderboard"
        subtitle="Compete with peers to maintain your streak and earn maximum XP."
      />

      {isLoading ? (
        <Card style={{ marginTop: "var(--spacing-md)", padding: "var(--spacing-lg)" }}>
          <Skeleton style={{ height: "40px", marginBottom: "var(--spacing-sm)" }} />
          <Skeleton style={{ height: "40px", marginBottom: "var(--spacing-sm)" }} />
          <Skeleton style={{ height: "40px", marginBottom: "var(--spacing-sm)" }} />
        </Card>
      ) : isError || !leaderboardData ? (
        <div style={{ color: "var(--color-danger)", marginTop: "var(--spacing-md)" }}>Failed to load leaderboard data.</div>
      ) : (
        <Card style={{ marginTop: "var(--spacing-md)" }}>
        <div style={{ width: "100%", overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead style={{ backgroundColor: "var(--color-neutral-50)", borderBottom: "1px solid var(--color-neutral-200)" }}>
              <tr>
                <th style={{ padding: "var(--spacing-md)", color: "var(--color-neutral-500)", fontSize: "var(--font-size-meta)", textTransform: "uppercase" }}>Rank</th>
                <th style={{ padding: "var(--spacing-md)", color: "var(--color-neutral-500)", fontSize: "var(--font-size-meta)", textTransform: "uppercase" }}>Student</th>
                <th style={{ padding: "var(--spacing-md)", color: "var(--color-neutral-500)", fontSize: "var(--font-size-meta)", textTransform: "uppercase" }}>Total XP</th>
                <th style={{ padding: "var(--spacing-md)", color: "var(--color-neutral-500)", fontSize: "var(--font-size-meta)", textTransform: "uppercase" }}>Current Streak</th>
              </tr>
            </thead>
            <tbody>
              {leaderboardData.map((user) => (
                <tr key={user.rank} style={{ 
                  borderBottom: "0.5px solid var(--color-neutral-200)", 
                  backgroundColor: user.isCurrentUser ? "var(--color-primary-light)" : "transparent",
                  transition: "background-color 0.2s ease"
                }}>
                  <td style={{ padding: "var(--spacing-md)", fontWeight: 700, color: user.rank === 1 ? "#FFCC00" : user.rank === 2 ? "#8E8E93" : user.rank === 3 ? "#C67D3D" : "var(--color-neutral-900)" }}>
                    {user.rank}
                  </td>
                  <td style={{ padding: "var(--spacing-md)", fontWeight: user.isCurrentUser ? 700 : 500 }}>
                    {user.name} {user.isCurrentUser && "(You)"}
                  </td>
                  <td style={{ padding: "var(--spacing-md)", color: "var(--color-neutral-900)", fontWeight: 600 }}>
                    {user.xp.toLocaleString()} <span style={{ color: "var(--color-neutral-500)", fontWeight: 400, fontSize: "12px" }}>XP</span>
                  </td>
                  <td style={{ padding: "var(--spacing-md)", fontSize: "16px" }}>
                    {user.streak}🔥
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      )}
    </div>
  );
}
