"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CanAccess } from "../../components/ui/CanAccess";

// Mock API Call
async function fetchUserDetail(id: string) {
  return {
    id,
    email: "vip@zenc.ai",
    tier: "PRO",
    tokenBalance: 85000,
    status: "ACTIVE",
    createdAt: "2026-04-15T23:00:00.000Z", // DB always saves UTC
    profile: {
      currentLevel: "B1",
      confidenceScore: 0.8,
      streak: 15,
      totalXp: 5400,
    },
  };
}

async function grantTokens(id: string, amount: number, reason: string) {
  // Simulates Gateway PATCH /admin/users/:id/grant
  console.log(`Granted ${amount} tokens to ${id}. Reason: ${reason}`);
  return { success: true };
}

export function UserDetail360({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [isUtc, setIsUtc] = useState(true);

  // God mode states
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [grantAmount, setGrantAmount] = useState(5000);
  const [grantReason, setGrantReason] = useState("");

  const { data: user, isLoading } = useQuery({
    queryKey: ["admin_user_detail", userId],
    queryFn: () => fetchUserDetail(userId),
    staleTime: 0, // ALWAYS FETCH LATEST FOR BILLING/TOKENS
    refetchOnWindowFocus: true,
  });

  const grantMutation = useMutation({
    mutationFn: () => grantTokens(userId, grantAmount, grantReason),
    onSuccess: () => {
      // Optimistic update or refetch
      queryClient.invalidateQueries({ queryKey: ["admin_user_detail", userId] });
      setShowGrantModal(false);
      setGrantReason("");
    },
  });

  if (isLoading) return <div>Loading User 360 View...</div>;
  if (!user) return <div>User not found</div>;

  const displayDate = isUtc
    ? `${new Date(user.createdAt).toUTCString()} (UTC)`
    : `${new Date(user.createdAt).toLocaleString()} (Local)`;

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-2xl font-bold">Chi tiết khách hàng (360° View)</h1>
        <button
          onClick={() => setIsUtc(!isUtc)}
          className="text-sm bg-gray-200 px-3 py-1 rounded"
        >
          Múi giờ: {isUtc ? "UTC (Chuẩn)" : "Local (Máy tính của bạn)"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* CỘT TRÁI: THÔNG TIN CƠ BẢN */}
        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="font-bold text-lg mb-2">Hồ sơ Cơ bản</h3>
          <p><strong>Email:</strong> {user.email}</p>
          <p><strong>Ngày đăng ký:</strong> {displayDate}</p>
          <p><strong>Trạng thái:</strong> <span className="text-green-600 font-bold">{user.status}</span></p>
          <p><strong>Gói cước hiện tại:</strong> {user.tier}</p>
        </div>

        {/* CỘT PHẢI: TÀI CHÍNH & TÓM TẮT HỌC TẬP */}
        <div className="bg-blue-50 p-4 rounded border">
          <h3 className="font-bold text-lg mb-2">Tài chính & Học tập</h3>
          <p>
            <strong>Số dư Token:</strong>
            <span className="text-2xl font-mono text-blue-600 block">{user.tokenBalance.toLocaleString()}</span>
          </p>
          <p><strong>Chuỗi ngày học (Streak):</strong> 🔥 {user.profile.streak} ngày</p>
          <p><strong>Level CEFR:</strong> {user.profile.currentLevel}</p>
        </div>
      </div>

      {/* GOD MODE OPERATIONS */}
      <div className="border-t pt-4">
        <h3 className="font-bold text-red-600 mb-2">God Mode Operations (Khu vực nhạy cảm)</h3>
        <div className="flex gap-4">
          <CanAccess permission="write:billing">
            <button
              onClick={() => setShowGrantModal(true)}
              className="bg-yellow-500 text-white font-bold px-4 py-2 rounded shadow hover:bg-yellow-600"
            >
              + Bơm Token Đền bù
            </button>
          </CanAccess>

          <CanAccess permission="write:users">
            <button className="bg-blue-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-blue-700">
              ⬆️ Nâng cấp PRO (Manual)
            </button>
          </CanAccess>

          <CanAccess permission="delete:users">
            <button className="bg-red-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-red-700">
              🚫 Khóa Tài khoản (Ban)
            </button>
          </CanAccess>
        </div>
      </div>

      {/* MODAL BƠM TOKEN */}
      {showGrantModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-6 rounded shadow-lg w-96">
            <h3 className="font-bold text-xl mb-4">Bơm Token cho {user.email}</h3>

            <div className="mb-4">
              <label className="block text-sm mb-1">Số lượng Token</label>
              <input
                type="number"
                value={grantAmount}
                onChange={(e) => setGrantAmount(Number(e.target.value))}
                className="w-full border p-2 rounded"
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm mb-1 text-red-600 font-bold">
                Lý do thực hiện (Bắt buộc nhập - Sẽ lưu vào Audit Log) *
              </label>
              <textarea
                value={grantReason}
                onChange={(e) => setGrantReason(e.target.value)}
                placeholder="Ví dụ: Đền bù lỗi sập server ElevenLabs ticket #1024"
                className="w-full border p-2 rounded h-24"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setShowGrantModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Hủy
              </button>
              <button
                onClick={() => grantMutation.mutate()}
                disabled={!grantReason || grantMutation.isPending}
                className="px-4 py-2 bg-yellow-500 text-white font-bold rounded disabled:opacity-50"
              >
                {grantMutation.isPending ? "Đang xử lý..." : "Xác nhận Bơm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}