import React from "react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function UserTableToolbar({
  globalFilter,
  setGlobalFilter,
}: {
  globalFilter: string;
  setGlobalFilter: (val: string) => void;
}) {
  return (
    <div style={{ display: "flex", gap: "var(--spacing-md)", marginBottom: "var(--spacing-md)", alignItems: "center" }}>
      <div style={{ flex: 1, maxWidth: "300px" }}>
        <Input
          placeholder="Search by name or email..."
          value={globalFilter ?? ""}
          onChange={(e) => setGlobalFilter(String(e.target.value))}
        />
      </div>
      <Button variant="secondary">Filter by Role</Button>
      <div style={{ flex: 1 }} />
      <Button variant="primary">Add User</Button>
    </div>
  );
}
