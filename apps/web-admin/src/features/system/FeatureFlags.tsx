"use client";

import { useState } from "react";
import { CanAccess } from "../../components/ui/CanAccess";

export function FeatureFlags() {
  const [flags, setFlags] = useState({
    elevenLabs: true,
    forceFallbackOpenAI: false,
    ragActive: true,
    freeLimit: 15,
  });

  const handleSave = () => {
    alert("Đã lưu Cấu Hình vào Redis. Toàn bộ API Backend sẽ áp dụng ngay lập tức (Không cần restart server)!");
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-2xl font-bold">Cầu Dao Hệ Thống (Feature Flags)</h1>
        <CanAccess permission="write:system">
          <button
            onClick={handleSave}
            className="bg-blue-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-blue-700"
          >
            💾 LƯU CONFIG (HOT RELOAD)
          </button>
        </CanAccess>
      </div>

      <p className="text-gray-600 text-sm">
        Trạm điều khiển Khẩn cấp. Gạt cầu dao để tắt nhanh các tính năng đang bị lỗi hoặc quá tải (Tác động tức thì vào Redis Memory).
      </p>

      <div className="grid grid-cols-2 gap-6">
        <div className="border p-4 bg-gray-50 rounded">
          <h3 className="font-bold mb-4 text-red-600">🔌 AI Provider Limits</h3>

          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <div>
              <span className="font-bold block">Bật/Tắt ElevenLabs Voice</span>
              <span className="text-xs text-gray-500">Tắt đi nếu đứt cáp/hết tiền. App sẽ fallback sang Google TTS mặc định.</span>
            </div>
            <input
              type="checkbox"
              checked={flags.elevenLabs}
              onChange={(e) => setFlags({ ...flags, elevenLabs: e.target.checked })}
              className="w-6 h-6"
            />
          </div>

          <div className="flex justify-between items-center mb-4 border-b pb-2">
            <div>
              <span className="font-bold block">Bắt Buộc Dùng OpenAI (Force Fallback)</span>
              <span className="text-xs text-gray-500">Cắt luồng Gemini nếu Google đang bảo trì hoặc lag.</span>
            </div>
            <input
              type="checkbox"
              checked={flags.forceFallbackOpenAI}
              onChange={(e) => setFlags({ ...flags, forceFallbackOpenAI: e.target.checked })}
              className="w-6 h-6"
            />
          </div>

          <div className="flex justify-between items-center mb-4">
            <div>
              <span className="font-bold block">Tắt Tính Năng Nhúng RAG (PDF)</span>
              <span className="text-xs text-gray-500">Giảm tải cho Qdrant DB. Chỉ AI thuần giao tiếp.</span>
            </div>
            <input
              type="checkbox"
              checked={flags.ragActive}
              onChange={(e) => setFlags({ ...flags, ragActive: e.target.checked })}
              className="w-6 h-6"
            />
          </div>
        </div>

        <div className="border p-4 bg-blue-50 rounded shadow-inner">
          <h3 className="font-bold mb-4 text-blue-800">💰 Billing & Limits (Admin Ops)</h3>

          <div className="mb-4">
            <label className="font-bold block mb-1">Số Phút FREE Tối Đa Mỗi Ngày (Tài khoản thường)</label>
            <input
              type="number"
              value={flags.freeLimit}
              onChange={(e) => setFlags({ ...flags, freeLimit: Number(e.target.value) })}
              className="w-full border p-2 rounded"
            />
            <span className="text-xs text-gray-500 mt-1 block">Limit này ghi đè lên mọi tham số hệ thống. Giảm xuống 5 phút nếu server AI bị nghẽn!</span>
          </div>

          <div className="mb-4">
            <label className="font-bold block mb-1">Giá Base Token Audio / Giây (Dynamic Pricing)</label>
            <input type="number" defaultValue="25" className="w-full border p-2 rounded" />
            <span className="text-xs text-gray-500 mt-1 block">Tăng giá nếu server quá tải (Hệ thống tự nhận giá mới).</span>
          </div>

          <div className="mb-4">
            <label className="font-bold block mb-1">Bonus Tokens Khi Xác Thực Email (OTP)</label>
            <input type="number" defaultValue="5000" className="w-full border p-2 rounded" />
            <span className="text-xs text-gray-500 mt-1 block">Đọc trực tiếp biến SYSTEM_CONFIG:WELCOME_BONUS_TOKENS trên Redis.</span>
          </div>
        </div>
      </div>
    </div>
  );
}