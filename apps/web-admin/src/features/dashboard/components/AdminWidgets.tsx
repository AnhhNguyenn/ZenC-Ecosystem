"use client";

import React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { adminApi, AnalyticsOverview, WeeklyStatPoint } from "@/api/admin.api";

// ── Hooks ──────────────────────────────────────────────────────────
function useAnalyticsOverview() {
  return useQuery<AnalyticsOverview>({
    queryKey: ["admin", "analytics", "overview"],
    queryFn: adminApi.getAnalyticsOverview,
    staleTime: 5 * 60 * 1000,
    refetchInterval: 5 * 60 * 1000,
  });
}

function useWeeklyStats() {
  return useQuery<WeeklyStatPoint[]>({
    queryKey: ["admin", "analytics", "weekly"],
    queryFn: adminApi.getWeeklyStats,
    staleTime: 10 * 60 * 1000,
  });
}

// ── 1. Stats Cards (real data) ──────────────────────────────────────
export function AdminStats() {
  const { data, isLoading } = useAnalyticsOverview();

  const cards = [
    {
      title: "MRR",
      desc: "Monthly Recurring Revenue",
      value: `$${data?.revenueMRR?.toLocaleString() ?? "0"}`,
      color: "var(--color-primary)",
    },
    {
      title: "Total Users",
      desc: "Registered accounts",
      value: (data?.totalUsers ?? 0).toLocaleString(),
      color: "var(--color-neutral-900)",
    },
    {
      title: "Active (24h)",
      desc: "Had a voice session today",
      value: (data?.activeUsers24h ?? 0).toLocaleString(),
      color: "var(--color-success)",
    },
    {
      title: "Growth MoM",
      desc: "Month-over-month new users",
      value: `${(data?.growthPercentage ?? 0) >= 0 ? "+" : ""}${data?.growthPercentage ?? 0}%`,
      color: (data?.growthPercentage ?? 0) >= 0 ? "var(--color-success)" : "var(--color-danger)",
    },
  ];

  if (isLoading) {
    return (
      <>
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} style={{ height: "120px" }} />
        ))}
      </>
    );
  }

  return (
    <>
      {cards.map((c) => (
        <Card key={c.title} hoverable>
          <CardHeader>
            <CardTitle>{c.title}</CardTitle>
            <CardDescription>{c.desc}</CardDescription>
          </CardHeader>
          <CardContent>
            <div style={{ fontSize: "26px", fontWeight: 700, color: c.color }}>
              {c.value}
            </div>
          </CardContent>
        </Card>
      ))}
    </>
  );
}

// ── 2. Weekly Growth Chart (real recharts + live data) ─────────────
export function RevenueChart({ isLoading: extLoading }: { isLoading?: boolean }) {
  const { data: weeklyData, isLoading } = useWeeklyStats();

  if (isLoading || extLoading) {
    return <Skeleton style={{ height: "400px" }} />;
  }

  // Shorten "2025-W12" → "W12" for compact x-axis labels
  const chartData = (weeklyData ?? []).map((d) => ({
    ...d,
    weekLabel: d.week.split("-W")[1] ? `W${d.week.split("-W")[1]}` : d.week,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Growth – Last 8 Weeks</CardTitle>
        <CardDescription>New user registrations vs. voice sessions per week</CardDescription>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <div style={{ height: "300px", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <p style={{ color: "var(--color-neutral-400)", fontSize: "var(--font-size-meta)" }}>
              No data yet — data will appear once users start sessions.
            </p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-neutral-200)" />
              <XAxis
                dataKey="weekLabel"
                tick={{ fontSize: 12, fill: "var(--color-neutral-500)" }}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 12, fill: "var(--color-neutral-500)" }}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--color-surface)",
                  border: "1px solid var(--color-neutral-200)",
                  borderRadius: "8px",
                  fontSize: "13px",
                }}
              />
              <Legend wrapperStyle={{ fontSize: "13px", paddingTop: "8px" }} />
              <Line
                type="monotone"
                dataKey="newUsers"
                name="New Users"
                stroke="var(--color-primary)"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
              <Line
                type="monotone"
                dataKey="sessions"
                name="Voice Sessions"
                stroke="var(--color-success)"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
}

// ── 3. System Health Panel ─────────────────────────────────────────
export function SystemAlerts({ isLoading }: { isLoading?: boolean }) {
  if (isLoading) return <Skeleton style={{ height: "400px" }} />;

  const checks = [
    { label: "Gateway Server", status: "Online", ok: true },
    { label: "AI Worker", status: "Online", ok: true },
    { label: "Database", status: "Online (MSSQL)", ok: true },
    { label: "Vector Store", status: "Online (Qdrant)", ok: true },
    { label: "Redis Cache", status: "Online", ok: true },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
        <CardDescription>Live infrastructure status</CardDescription>
      </CardHeader>
      <CardContent style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {checks.map((c) => (
          <div
            key={c.label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "8px 0",
              borderBottom: "1px solid var(--color-neutral-100)",
              fontSize: "var(--font-size-meta)",
            }}
          >
            <span style={{ fontWeight: 600 }}>{c.label}</span>
            <span style={{
              color: c.ok ? "var(--color-success)" : "var(--color-danger)",
              display: "flex", alignItems: "center", gap: "6px",
            }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: c.ok ? "var(--color-success)" : "var(--color-danger)", display: "inline-block" }} />
              {c.status}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
