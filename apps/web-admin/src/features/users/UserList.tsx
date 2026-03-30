"use client";

import { useQuery } from "@tanstack/react-query";
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState } from "react";
import { useDebounce } from "../../hooks/useDebounce"; // Will create this
import { CanAccess } from "../../components/ui/CanAccess";
import Link from "next/link";

// Mock API Call - Represents Server-Side Action
async function fetchUsers(_page: number, _search: string, _sortBy: string) {
  // In real app, this calls Gateway GET /admin/users?page=${page}&q=${search}&sort=${sortBy}
  return {
    data: [
      { id: "1", email: "user1@gmail.com", tier: "FREE", tokenBalance: 1500, status: "ACTIVE" },
      { id: "2", email: "vip@zenc.ai", tier: "PRO", tokenBalance: 85000, status: "ACTIVE" },
      { id: "3", email: "spammer@gmail.com", tier: "FREE", tokenBalance: 0, status: "BANNED" },
    ],
    total: 300,
  };
}

export function UserListFeature() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sortBy] = useState("createdAt_desc");

  const debouncedSearch = useDebounce(search, 500);

  const { data, isLoading } = useQuery({
    queryKey: ["admin_users", page, debouncedSearch, sortBy],
    queryFn: () => fetchUsers(page, debouncedSearch, sortBy),
    staleTime: 60 * 1000,
  });

  const columns = [
    { accessorKey: "email", header: "Email" },
    { accessorKey: "tier", header: "Gói cước" },
    {
      accessorKey: "tokenBalance",
      header: "Số dư Token",
      cell: (info: { getValue: () => number }) => (
        <span className="font-mono">{info.getValue().toLocaleString()}</span>
      )
    },
    {
      accessorKey: "status",
      header: "Trạng thái",
      cell: (info: { getValue: () => string }) => {
        const status = info.getValue();
        const color = status === "ACTIVE" ? "text-green-600" : "text-red-600";
        return <span className={`font-bold ${color}`}>{status}</span>;
      }
    },
    {
      id: "actions",
      header: "Hành động",
      cell: (info: { row: { original: { id: string } } }) => (
        <div className="flex gap-2">
          <Link href={`/users/${info.row.original.id}`} className="text-blue-500 hover:underline">
            Chi tiết 360°
          </Link>
          <CanAccess permission="write:billing">
            <button className="bg-yellow-500 text-white px-2 py-1 rounded text-sm hover:bg-yellow-600">
              Bơm Token
            </button>
          </CanAccess>
          <CanAccess permission="delete:users">
            <button className="bg-red-500 text-white px-2 py-1 rounded text-sm hover:bg-red-600">
              Ban
            </button>
          </CanAccess>
        </div>
      ),
    },
  ];

  const table = useReactTable({
    data: data?.data || [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    pageCount: Math.ceil((data?.total || 0) / 10), // Assuming 10 items per page
    manualPagination: true,
  });

  return (
    <div className="p-6 bg-white rounded-lg shadow">
      <div className="flex justify-between mb-4">
        <h2 className="text-xl font-bold">Danh sách Khách hàng (User List)</h2>
        <div className="flex gap-2">
          <CanAccess permission="write:users">
             <button className="bg-purple-600 text-white px-4 py-2 rounded">Import CSV (Bulk)</button>
          </CanAccess>
          <input
            type="text"
            placeholder="Tìm theo email, tên..."
            className="border p-2 rounded"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div>Đang tải danh sách từ server...</div>
      ) : (
        <table className="min-w-full text-left border-collapse">
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id} className="border-b">
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="p-2 bg-gray-50">
                    {flexRender(
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
              <tr key={row.id} className="border-b hover:bg-gray-50">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="p-2">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Server-side Pagination Controls */}
      <div className="flex items-center gap-2 mt-4">
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          className="px-3 py-1 border rounded disabled:opacity-50"
        >
          Trước
        </button>
        <span>Trang {page}</span>
        <button
          onClick={() => setPage(p => p + 1)}
          className="px-3 py-1 border rounded"
        >
          Sau
        </button>
      </div>
    </div>
  );
}
