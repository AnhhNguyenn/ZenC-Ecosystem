"use client";

import { useState } from "react";
import { CanAccess } from "../../components/ui/CanAccess";

export function RagPipeline() {
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleUpload = () => {
    if (!file) return;

    setIsProcessing(true);
    setProgress(0);

    // Mock API Call - Push task to RabbitMQ for Vectorizing
    // Polling or WebSocket simulation
    const interval = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          alert("Nhúng tài liệu (Vectorize) vào Qdrant thành công!");
          return 100;
        }
        return p + 15; // simulate chunks processing
      });
    }, 800);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <h1 className="text-2xl font-bold">Trạm Nhúng Tri Thức (RAG Pipeline)</h1>
      <p className="text-gray-600">Upload sách giáo khoa, hướng dẫn ngữ pháp (PDF/TXT) vào não AI (Qdrant Database).</p>

      <div className="grid grid-cols-2 gap-6">
        <div className="border p-4 bg-gray-50 rounded">
          <h3 className="font-bold mb-4">📤 Upload Tài Liệu Mới</h3>

          <input
            type="file"
            accept=".pdf, .txt"
            onChange={(e) => setFile(e.target.files?.[0] || null)}
            disabled={isProcessing}
            className="mb-4 block w-full"
          />

          <CanAccess permission="write:content">
            <button
              onClick={handleUpload}
              disabled={!file || isProcessing}
              className="w-full bg-blue-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-blue-700 disabled:opacity-50"
            >
              Cắt & Nhúng Vector (Bơm vào Qdrant)
            </button>
          </CanAccess>

          {isProcessing && (
            <div className="mt-4">
              <div className="flex justify-between mb-1">
                <span className="text-sm font-bold text-blue-600">Đang gọi Worker Python...</span>
                <span className="text-xs text-gray-500">{progress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                <div className="bg-blue-600 h-4 transition-all duration-500 ease-out" style={{ width: `${progress}%` }}></div>
              </div>
              <p className="text-xs text-gray-500 mt-2">Giai đoạn: Chunking document into 500-token pieces...</p>
            </div>
          )}
        </div>

        <div className="border p-4 bg-white rounded shadow-inner">
          <h3 className="font-bold mb-4 text-purple-700">🔍 Tra Cứu Hộp Đen (RAG Tester)</h3>
          <p className="text-xs text-gray-500 mb-2">Nhập 1 câu hỏi để xem AI sẽ bốc nội dung nào từ PDF ra trả lời.</p>
          <div className="flex gap-2">
            <input type="text" placeholder="Thì hiện tại hoàn thành dùng khi nào?" className="w-full border p-2 rounded text-sm" />
            <button className="bg-purple-600 text-white px-4 rounded text-sm font-bold">Query</button>
          </div>
          <div className="mt-4 p-3 bg-gray-100 rounded border h-32 overflow-y-auto text-xs font-mono">
            <span className="text-gray-400">Kết quả trích xuất vector (Top 3) sẽ hiển thị ở đây...</span>
          </div>
        </div>
      </div>
    </div>
  );
}