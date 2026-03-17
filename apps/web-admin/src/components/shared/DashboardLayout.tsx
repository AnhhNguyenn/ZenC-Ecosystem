import React from "react";
import { AppShell } from "../layouts/AppShell";
import { Sidebar } from "../layouts/Sidebar";
import { Activity, Users, Settings, FolderOpen, Shield } from "lucide-react";

// Rule Enforcement: Max 3 Sections in Sidebar
const adminSections = [
  {
    title: "Workspace",
    items: [
      { label: "Overview", href: "/dashboard", icon: <Activity size={18} /> },
      { label: "User Management", href: "/users", icon: <Users size={18} /> },
      { label: "Content", href: "/content", icon: <FolderOpen size={18} /> },
    ],
  },
  {
    title: "System",
    items: [
      { label: "Access Control", href: "/roles", icon: <Shield size={18} /> },
      { label: "Settings", href: "/settings", icon: <Settings size={18} /> },
    ],
  },
];

export function DashboardLayout({ children }: { children: React.ReactNode }) {
  const sidebar = (
    <Sidebar
      sections={adminSections}
      header={
        <div style={{ fontWeight: 800, fontSize: "20px", color: "var(--color-primary)" }}>
          ZenC Admin.
        </div>
      }
    />
  );

  return <AppShell sidebar={sidebar}>{children}</AppShell>;
}
