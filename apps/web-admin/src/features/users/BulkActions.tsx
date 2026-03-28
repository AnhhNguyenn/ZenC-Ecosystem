"use client";

import { useState } from "react";
import { CanAccess } from "../../components/ui/CanAccess";

export function BulkActions() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = async () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);

    // Mock API Call - Push task to RabbitMQ for Bulk Upload
    // Gateway responds with 202 ACCEPTED and a JobID
    const jobId = "job-" + Date.now();
    console.log(`Dispatched Job ID ${jobId} to RabbitMQ Worker...`);

    // Mock Polling Progress via WebSockets or React Query RefetchInterval
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          alert("Import thành công 5,000 users!");
          return 100;
        }
        return p + 25; // simulate 4 steps
      });
    }, 1000);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <h1 className="text-2xl font-bold">Thao Tác Hàng Loạt (Cửu Vạn Ops)</h1>
      <p className="text-gray-600">Dành cho việc Đền bù Token hoặc Import danh sách User với quy mô hàng ngàn tài khoản.</p>

      <div className="border p-4 bg-gray-50 rounded">
        <h3 className="font-bold mb-2">Import File Excel/CSV Nạp Token Hàng Loạt</h3>
        <p className="text-sm text-gray-500 mb-4">Cột A: Email khách hàng | Cột B: Số Token cần cộng (Bắt buộc dùng file mẫu)</p>

        <input
          type="file"
          accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          disabled={isProcessing}
        />

        <div className="mt-4">
          <CanAccess permission="write:billing">
            <button
              onClick={handleUpload}
              disabled={!file || isProcessing}
              className="bg-purple-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-purple-700 disabled:opacity-50"
            >
              🚀 Chạy Tiến Trình Import Hàng Loạt
            </button>
          </CanAccess>
        </div>

        {/* PROGRESS BAR - ASYNC JOB TRACKING */}
        {isProcessing && (
          <div className="mt-4">
            <p className="text-sm font-bold text-blue-600 mb-1">Đang xử lý Job (Background Queue)...</p>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div
                className="bg-blue-600 h-4 transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 text-right mt-1">{progress}% Hoàn thành</p>
          </div>
        )}
      </div>
    </div>
  );
}