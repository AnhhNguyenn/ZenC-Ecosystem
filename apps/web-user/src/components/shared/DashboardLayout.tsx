import React from "react";
import { AppShell } from "../layouts/AppShell";
import { Sidebar } from "../layouts/Sidebar";
import { Home, BookOpen, Trophy, Settings } from "lucide-react";

const userSections = [
  {
    title: "Main Menu",
    items: [
      { label: "Dashboard", href: "/dashboard", icon: <Home size={18} /> },
      { label: "Lessons", href: "/lessons", icon: <BookOpen size={18} /> },
      {
        label: "Leaderboard",
        href: "/leaderboard",
        icon: <Trophy size={18} />,
      },
    ],
  },
  {
    title: "Account",
    items: [
      { label: "Settings", href: "/settings", icon: <Settings size={18} /> },
    ],
  },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebar = (
    <Sidebar
      sections={userSections}
      header={
        <div style={{ fontWeight: 800, fontSize: "20px", color: "var(--color-primary)" }}>
          ZenC.
        </div>
      }
    />
  );

  return <AppShell sidebar={sidebar}>{children}</AppShell>;
}
