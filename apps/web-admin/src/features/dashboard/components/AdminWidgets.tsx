import React from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// 1. STATS: 4-Card System Rule Enforced Here
export function AdminStats({
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
          <CardTitle>MRR</CardTitle>
          <CardDescription>Monthly Recurring</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>
            ${data?.revenueMRR?.toLocaleString() || "0"}
          </div>
        </CardContent>
      </Card>
      
      <Card hoverable>
        <CardHeader>
          <CardTitle>Total Users</CardTitle>
          <CardDescription>Registered accounts</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>
            {data?.totalUsers?.toLocaleString() || 0}
          </div>
        </CardContent>
      </Card>

      <Card hoverable>
        <CardHeader>
          <CardTitle>Active Users (24h)</CardTitle>
          <CardDescription>Currently engaged</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: "24px", fontWeight: 700 }}>
            {data?.activeUsers24h?.toLocaleString() || 0}
          </div>
        </CardContent>
      </Card>

      <Card hoverable>
        <CardHeader>
          <CardTitle>Growth</CardTitle>
          <CardDescription>MoM increase</CardDescription>
        </CardHeader>
        <CardContent>
          <div style={{ fontSize: "24px", fontWeight: 700, color: "var(--color-success)" }}>
            +{data?.growthPercentage || 0}%
          </div>
        </CardContent>
      </Card>
    </>
  );
}

// 2. MAIN FEATURE: 70% Layout Focus Component (Using Recharts)
const mockChartData = [
  { name: "Mon", users: 4000, revenue: 2400 },
  { name: "Tue", users: 3000, revenue: 1398 },
  { name: "Wed", users: 2000, revenue: 9800 },
  { name: "Thu", users: 2780, revenue: 3908 },
  { name: "Fri", users: 1890, revenue: 4800 },
  { name: "Sat", users: 2390, revenue: 3800 },
  { name: "Sun", users: 3490, revenue: 4300 },
];

export function RevenueChart({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton style={{ height: "400px" }} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Growth</CardTitle>
        <CardDescription>Weekly active users and revenue</CardDescription>
      </CardHeader>
      <CardContent>
        <div style={{ height: "300px", width: "100%" }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockChartData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-neutral-200)" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "var(--color-neutral-500)", fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--color-neutral-500)", fontSize: 12 }} />
              <Tooltip 
                contentStyle={{ borderRadius: '8px', border: '1px solid var(--color-neutral-200)', boxShadow: 'var(--shadow-md)' }} 
              />
              <Line type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="users" stroke="var(--color-neutral-400)" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

// 3. SECONDARY PANEL: 30% Panel Layout Component
export function SystemAlerts({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return <Skeleton style={{ height: "400px" }} />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Health</CardTitle>
      </CardHeader>
      <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
        <div style={{ fontSize: "var(--font-size-meta)", color: "var(--color-warning)" }}>
          <strong>Spike in API Errors:</strong> Voice Module - 10m ago
        </div>
        <div style={{ borderTop: "1px solid var(--color-neutral-200)", paddingTop: "var(--spacing-sm)", fontSize: "var(--font-size-meta)", color: "var(--color-success)" }}>
          <strong>Database Backup:</strong> Completed - 2h ago
        </div>
      </CardContent>
    </Card>
  );
}
