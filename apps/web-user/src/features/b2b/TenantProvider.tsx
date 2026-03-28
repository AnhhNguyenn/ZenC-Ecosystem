"use client";

import React, { createContext, useContext, useEffect } from "react";

interface TenantConfig {
  id: string;
  name: string;
  theme: {
    primaryColor: string;
    secondaryColor?: string;
    logoUrl?: string;
  };
}

const DEFAULT_TENANT: TenantConfig = {
  id: "zenc",
  name: "ZenC AI",
  theme: {
    primaryColor: "#4f46e5", // Indigo-600
    logoUrl: "/logo.png",
  },
};

// MOCK: Giả lập gọi API lấy cấu hình Tenant từ Backend
const MOCK_TENANTS: Record<string, TenantConfig> = {
  vus: {
    id: "vus",
    name: "VUS English",
    theme: {
      primaryColor: "#E31837", // Red
      secondaryColor: "#1a1a1a",
      logoUrl: "/vus-logo.png",
    },
  },
  apollo: {
    id: "apollo",
    name: "Apollo English",
    theme: {
      primaryColor: "#F58220", // Orange
      secondaryColor: "#00539F",
      logoUrl: "/apollo-logo.png",
    },
  },
};

const TenantContext = createContext<TenantConfig>(DEFAULT_TENANT);

export const useTenant = () => useContext(TenantContext);

export function TenantProvider({
  tenantId,
  children,
}: {
  tenantId: string;
  children: React.ReactNode;
}) {
  // Lấy config từ MOCK (Thực tế sẽ gọi API trên Server Component r truyền xuống)
  const config = MOCK_TENANTS[tenantId] || DEFAULT_TENANT;

  useEffect(() => {
    // Inject biến CSS toàn cục vào :root
    if (config.theme.primaryColor) {
      document.documentElement.style.setProperty(
        "--color-primary",
        config.theme.primaryColor
      );
    }
    if (config.theme.secondaryColor) {
      document.documentElement.style.setProperty(
        "--color-secondary",
        config.theme.secondaryColor
      );
    }
  }, [config]);

  return (
    <TenantContext.Provider value={config}>
      <div className={`tenant-theme-${config.id}`} style={{ display: 'contents' }}>
        {children}
      </div>
    </TenantContext.Provider>
  );
}
