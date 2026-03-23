"use client";

import React, { useState } from "react";
import { PageHeader } from "@/components/layouts/PageLayout";
import { useUsersListQuery } from "@/features/users/hooks/useUsers";
import { UserTableToolbar } from "@/features/users/components/UserTableToolbar";
import { UserTableView } from "@/features/users/components/UserTableView";
import { Skeleton } from "@/components/ui/Skeleton";

export default function UsersManagementPage() {
  const { data: users, isLoading, isError } = useUsersListQuery();
  const [globalFilter, setGlobalFilter] = useState("");

  return (
    <div>
      <PageHeader
        title="User Management"
        subtitle="View and manage all registered platform users."
      />

      <UserTableToolbar
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
      />

      {isLoading ? (
        <Skeleton style={{ height: "400px", width: "100%" }} />
      ) : isError ? (
        <div style={{ padding: "var(--spacing-lg)", color: "var(--color-danger)" }}>
          Failed to load users. Please check your connection.
        </div>
      ) : (
        <UserTableView data={users || []} globalFilter={globalFilter} />
      )}
    </div>
  );
}
