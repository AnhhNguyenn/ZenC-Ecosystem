"use client";

import { useMemo } from "react";

interface CanAccessProps {
  permission: string | string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

// Giả lập hook lấy quyền từ hệ thống (sẽ được thay thế bằng real useAuth)
function usePermissions() {
  // TODO: Decode from actual JWT token
  return {
    permissions: ["read:users", "write:billing", "read:content"],
    role: "CSKH"
  };
}

export function CanAccess({ permission, children, fallback = null }: CanAccessProps) {
  const { permissions, role } = usePermissions();

  const hasAccess = useMemo(() => {
    // Super Admin có toàn quyền
    if (role === "SUPER_ADMIN") return true;

    if (Array.isArray(permission)) {
      return permission.some(p => permissions.includes(p));
    }
    return permissions.includes(permission);
  }, [permission, permissions, role]);

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
