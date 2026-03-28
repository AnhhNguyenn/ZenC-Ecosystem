"use client";

import { useState } from "react";
import { CanAccess } from "../../components/ui/CanAccess";

export function ScenarioMatrix() {
  const [selectedScenario, setSelectedScenario] = useState("interview");
  const [promptContent, setPromptContent] = useState("Bạn là giám đốc nhân sự khó tính đang phỏng vấn ứng viên vị trí Frontend Developer. Bạn sử dụng ngữ pháp CEFR B1. Thỉnh thoảng hãy tỏ ra bực bội nếu ứng viên trả lời sai.");

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <h1 className="text-2xl font-bold">Ma trận Kịch bản AI (Role-play CMS)</h1>
      <p className="text-gray-600 text-sm">Nơi cấu hình System Prompt và tham số cho từng tình huống giao tiếp cụ thể (Nhà hàng, Sân bay, Phỏng vấn).</p>

      <div className="grid grid-cols-3 gap-6">
        {/* DANH SÁCH SCENARIO */}
        <div className="col-span-1 border rounded p-4 bg-gray-50 h-96 overflow-y-auto">
          <h3 className="font-bold mb-4">Các Tình Huống Kịch Bản</h3>
          <ul className="space-y-2">
            {["Phỏng Vấn (Interview)", "Nhà Hàng (Restaurant)", "Sân Bay (Airport)", "Tranh Luận (Debate)"].map((s, idx) => (
              <li
                key={idx}
                className={`p-2 rounded cursor-pointer ${idx === 0 ? "bg-blue-100 border-blue-500 font-bold text-blue-700" : "hover:bg-gray-200"}`}
                onClick={() => setSelectedScenario(s)}
              >
                {s}
              </li>
            ))}
          </ul>
          <CanAccess permission="write:content">
            <button className="mt-4 w-full bg-green-500 text-white py-2 rounded font-bold hover:bg-green-600">
              + Tạo Tình Huống Mới
            </button>
          </CanAccess>
        </div>

        {/* CẤU HÌNH SYSTEM PROMPT & PARAMETERS */}
        <div className="col-span-2 border rounded p-6 bg-white shadow-inner">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg text-blue-800">Cấu hình: {selectedScenario}</h3>
            <span className="text-xs font-bold text-gray-500">Mã: SCENARIO_INTERVIEW_01</span>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2">Độ khó CEFR Level (Giới hạn Từ Vựng)</label>
            <select className="w-full border p-2 rounded bg-gray-50">
              <option value="A1">A1 - Sơ Cấp</option>
              <option value="A2">A2 - Cơ Bản</option>
              <option value="B1" selected>B1 - Trung Cấp</option>
              <option value="B2">B2 - Nâng Cao</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-bold mb-2">Temperature (Độ sáng tạo 0.1 - 1.0)</label>
              <input type="range" min="1" max="10" defaultValue="4" className="w-full" />
              <p className="text-xs text-gray-500 text-center">0.4 (Ổn định, ít ảo giác)</p>
            </div>
            <div>
              <label className="block text-sm font-bold mb-2">Giọng điệu (Tone)</label>
              <select className="w-full border p-2 rounded bg-gray-50">
                <option value="friendly">Thân Thiện & Cởi Mở</option>
                <option value="strict" selected>Nghiêm Khắc & Chuyên Nghiệp</option>
                <option value="humorous">Hài Hước</option>
              </select>
            </div>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-bold mb-2 text-red-600">
              Chỉ thị Hệ thống (System Prompt) - Áp dụng Toàn Server
            </label>
            <textarea
              className="w-full border border-red-300 p-4 rounded h-32 text-sm font-mono focus:border-red-500"
              value={promptContent}
              onChange={(e) => setPromptContent(e.target.value)}
            />
            <p className="text-xs text-gray-500 mt-1">Gõ nội dung hướng dẫn để nhúng thẳng vào não LLM. Cẩn thận vì nó ảnh hưởng trải nghiệm khách hàng ngay lập tức.</p>
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <button className="bg-gray-200 text-gray-700 px-4 py-2 rounded font-bold hover:bg-gray-300">
              Khôi phục (Rollback) bản V1.9
            </button>
            <CanAccess permission="write:content">
              <button className="bg-blue-600 text-white px-4 py-2 rounded font-bold hover:bg-blue-700 shadow">
                💾 Lưu Config (Hot Reload)
              </button>
            </CanAccess>
          </div>
        </div>
      </div>
    </div>
  );
}