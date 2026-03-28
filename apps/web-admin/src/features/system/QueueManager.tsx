"use client";

import { useState } from "react";
import { CanAccess } from "../../components/ui/CanAccess";

export function QueueManager() {
  const [retryStatus, setRetryStatus] = useState<string | null>(null);

  const handleRetryDlq = () => {
    setRetryStatus("Đang kéo 1,452 tasks từ Sọt Rác (DLQ) vào hàng chờ chính...");
    setTimeout(() => {
      setRetryStatus("Hoàn tất! Hệ thống đang xử lý lại các task lỗi.");
    }, 2000);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-2xl font-bold">Quản Trị Hàng Đợi (Queue & DLQ Ops)</h1>
        <CanAccess permission="write:system">
          <button
            onClick={handleRetryDlq}
            className="bg-red-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-red-700"
          >
            🚑 Cấp Cứu Sọt Rác (Retry Failed Tasks)
          </button>
        </CanAccess>
      </div>

      <p className="text-gray-600 text-sm">
        SRE Dashboard theo dõi RabbitMQ (Deep Brain Tasks, Emails, Scoring). Bất cứ task nào lỗi quá 3 lần sẽ bị tống vào DLQ (Sọt Rác).
      </p>

      {retryStatus && (
        <div className="bg-yellow-100 text-yellow-800 p-3 rounded font-bold border border-yellow-400">
          {retryStatus}
        </div>
      )}

      <div className="grid grid-cols-3 gap-6">
        <div className="border p-6 rounded bg-green-50 shadow-inner flex flex-col items-center">
          <h3 className="font-bold text-gray-500 mb-2 uppercase text-xs tracking-wider">Active Messages</h3>
          <span className="text-4xl font-mono font-bold text-green-700">42</span>
          <span className="text-xs text-gray-400 mt-2">Đang được xử lý mượt mà</span>
        </div>

        <div className="border p-6 rounded bg-blue-50 shadow-inner flex flex-col items-center">
          <h3 className="font-bold text-gray-500 mb-2 uppercase text-xs tracking-wider">Unacknowledged</h3>
          <span className="text-4xl font-mono font-bold text-blue-700">8</span>
          <span className="text-xs text-gray-400 mt-2">Worker đang ngâm cứu</span>
        </div>

        <div className="border p-6 rounded bg-red-50 shadow-inner flex flex-col items-center">
          <h3 className="font-bold text-gray-500 mb-2 uppercase text-xs tracking-wider">Dead-Letter (DLQ)</h3>
          <span className="text-4xl font-mono font-bold text-red-700">1,452</span>
          <span className="text-xs text-red-400 font-bold mt-2">⚠️ Lỗi: ElevenLabs Timeout</span>
        </div>
      </div>

      <div className="border rounded mt-6">
        <div className="bg-gray-100 p-3 border-b font-bold text-sm text-gray-700">Log Lỗi Gần Nhất (Top 5 DLQ)</div>
        <ul className="text-xs font-mono p-4 space-y-3">
          <li className="border-b pb-2">
            <span className="text-red-500 font-bold">[2026-04-15 23:01 UTC]</span> Task: <span className="text-blue-600">post_session_eval</span> | Lỗi: AI Worker Connection Refused (Port 8000)
          </li>
          <li className="border-b pb-2">
            <span className="text-red-500 font-bold">[2026-04-15 23:00 UTC]</span> Task: <span className="text-blue-600">post_session_eval</span> | Lỗi: API Provider Timeout sau 15s
          </li>
          <li className="border-b pb-2">
            <span className="text-red-500 font-bold">[2026-04-15 22:58 UTC]</span> Task: <span className="text-purple-600">SEND_OTP_EMAIL</span> | Lỗi: SendGrid Rate Limit Exceeded
          </li>
          <li className="text-gray-400 italic">... 1,449 lỗi khác tương tự</li>
        </ul>
      </div>
    </div>
  );
}