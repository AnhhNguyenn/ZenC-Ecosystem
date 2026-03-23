import React, { useMemo } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  ColumnDef,
} from "@tanstack/react-table";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";

interface UserData {
  id: string;
  email: string;
  fullName: string;
  role: string;
  createdAt: string;
}

export function UserTableView({
  data,
  globalFilter,
}: {
  data: UserData[];
  globalFilter: string;
}) {
  const columns = useMemo<ColumnDef<UserData>[]>(
    () => [
      { accessorKey: "fullName", header: "Full Name" },
      { accessorKey: "email", header: "Email Address" },
      { accessorKey: "role", header: "Role" },
      {
        accessorKey: "createdAt",
        header: "Joined Date",
        cell: (info) =>
          new Date(info.getValue() as string).toLocaleDateString(),
      },
      {
        id: "actions",
        header: "Actions",
        cell: () => (
          <Button variant="ghost" size="sm">
            View Details
          </Button>
        ),
      },
    ],
    []
  );

  const table = useReactTable({
    data,
    columns,
    state: { globalFilter },
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <Card>
      <div style={{ width: "100%", overflowX: "auto" }}>
        <table
          style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}
        >
          <thead
            style={{
              backgroundColor: "var(--color-neutral-50)",
              borderBottom: "1px solid var(--color-neutral-200)",
            }}
          >
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      padding: "var(--spacing-md)",
                      fontSize: "var(--font-size-meta)",
                      fontWeight: 600,
                      color: "var(--color-neutral-500)",
                      textTransform: "uppercase",
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                style={{
                  borderBottom: "1px solid var(--color-neutral-100)",
                  transition: "background-color 0.15s ease",
                }}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      padding: "var(--spacing-md)",
                      fontSize: "var(--font-size-body)",
                      color: "var(--color-neutral-900)",
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CardContent
        style={{
          borderTop: "1px solid var(--color-neutral-200)",
          paddingTop: "var(--spacing-md)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <span
          style={{
            fontSize: "var(--font-size-meta)",
            color: "var(--color-neutral-500)",
          }}
        >
          Page {table.getState().pagination.pageIndex + 1} of{" "}
          {table.getPageCount()}
        </span>
        <div style={{ display: "flex", gap: "var(--spacing-sm)" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            Previous
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
