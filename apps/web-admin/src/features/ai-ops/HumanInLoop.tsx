"use client";

import { useState } from "react";
import { CanAccess } from "../../components/ui/CanAccess";

export function HumanInLoop() {
  const [mistakes, setMistakes] = useState([
    { id: "M1", email: "user@zenc.ai", word: "Schedule", userAudio: "/mock-audio-1.mp3", aiScore: 40, status: "PENDING" },
    { id: "M2", email: "vip@zenc.ai", word: "Comfortable", userAudio: "/mock-audio-2.mp3", aiScore: 35, status: "PENDING" },
  ]);

  const handleLabel = (id: string, label: "CORRECT_AI" | "FALSE_POSITIVE") => {
    setMistakes((prev) => prev.filter((m) => m.id !== id));
    console.log(`Gắn nhãn ${label} cho lỗi ${id}. Đã lưu vào DB.`);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <h1 className="text-2xl font-bold">Trạm Kiểm Duyệt AI (Human-in-the-loop)</h1>
        <button className="bg-purple-600 text-white font-bold px-4 py-2 rounded shadow hover:bg-purple-700">
          📥 Export CSV Label Data (Train Model)
        </button>
      </div>

      <p className="text-gray-600 text-sm">
        Nơi các chuyên gia ngôn ngữ nghe lại những từ bị AI chấm sai phát âm. Giúp tinh chỉnh mô hình nhận diện giọng nói (Speech-to-Text) chống "ảo giác".
      </p>

      <div className="border rounded">
        {mistakes.map((m) => (
          <div key={m.id} className="flex justify-between items-center p-4 border-b hover:bg-gray-50">
            <div>
              <p className="font-bold text-lg text-blue-800">{m.word}</p>
              <p className="text-xs text-gray-500">Khách hàng: {m.email} | Điểm AI chấm: <span className="text-red-600 font-bold">{m.aiScore}/100</span></p>
              <div className="mt-2 flex gap-2 items-center">
                <button className="bg-gray-200 text-sm px-3 py-1 rounded hover:bg-gray-300">▶️ Nghe Ghi Âm User</button>
                <button className="bg-gray-200 text-sm px-3 py-1 rounded hover:bg-gray-300">▶️ Mẫu Chuẩn (ElevenLabs)</button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-bold text-center mb-1">Chuyên gia dán nhãn:</span>
              <div className="flex gap-2">
                <CanAccess permission="write:content">
                  <button
                    onClick={() => handleLabel(m.id, "CORRECT_AI")}
                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 font-bold"
                  >
                    ✅ Khách Đọc Sai Thật
                  </button>
                </CanAccess>
                <CanAccess permission="write:content">
                  <button
                    onClick={() => handleLabel(m.id, "FALSE_POSITIVE")}
                    className="bg-red-500 text-white px-3 py-1 rounded text-sm hover:bg-red-600 font-bold"
                  >
                    ❌ AI Chấm Láo (Khách Đúng)
                  </button>
                </CanAccess>
              </div>
            </div>
          </div>
        ))}
        {mistakes.length === 0 && (
          <p className="p-8 text-center text-gray-500">Không còn lỗi nghi ngờ nào cần duyệt hôm nay! 🎉</p>
        )}
      </div>
    </div>
  );
}