"use client";

import { useState } from "react";
import { CanAccess } from "../../components/ui/CanAccess";

interface Lesson {
  id: string;
  title: string;
  status: "DRAFT" | "LIVE";
  lockedBy?: string; // Tên Admin đang sửa để chống Conflict
}

// Giả lập Mock API
const initialLessons: Lesson[] = [
  { id: "L1", title: "Thì Hiện Tại Đơn", status: "LIVE" },
  { id: "L2", title: "Thì Quá Khứ (Bản nháp)", status: "DRAFT", lockedBy: "Học Thuật A" },
];

export function CourseBuilder() {
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons);
  const currentUser = "Học Thuật B"; // Lấy từ useAuth()

  const handleEdit = (lesson: Lesson) => {
    // Pessimistic UI Locking Check
    if (lesson.lockedBy && lesson.lockedBy !== currentUser) {
      alert(`⚠️ CẢNH BÁO: Admin "${lesson.lockedBy}" đang chỉnh sửa bài học này.\nBạn chỉ được phép XEM, không được SỬA (Chống ghi đè dữ liệu).`);
      return;
    }

    if (lesson.status === "LIVE") {
      alert("❌ NGHIÊM CẤM sửa trực tiếp bài học đang LIVE (Tránh sập học viên đang học dở).\nHệ thống sẽ tự động Clone ra bản DRAFT để bạn sửa.");
      // Logic: API Clone Lesson -> Đổi URL sang trang sửa bản DRAFT mới.
      setLessons((prev) => [
        ...prev,
        {
          id: `L${crypto.randomUUID()}`,
          title: `${lesson.title} (Clone)`,
          status: "DRAFT",
          lockedBy: currentUser,
        },
      ]);
      return;
    }

    console.log("Đang mở trình Editor cho bài học:", lesson.id);
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-6">
      <div className="flex justify-between">
        <h1 className="text-2xl font-bold">Quản lý Giáo trình (Cỗ Máy Thời Gian)</h1>
        <CanAccess permission="write:content">
          <button className="bg-green-600 text-white font-bold px-4 py-2 rounded">
            + Thêm Khóa Học Mới
          </button>
        </CanAccess>
      </div>

      <p className="text-gray-600 text-sm">
        Quy tắc: Tuyệt đối không sửa đè nội dung đang LIVE. Phải Clone ra bản Nháp, sửa xong mới Publish thành Version mới.
      </p>

      <div className="border rounded">
        {lessons.map((lesson) => (
          <div key={lesson.id} className="flex justify-between items-center p-4 border-b hover:bg-gray-50">
            <div>
              <span className="font-bold">{lesson.title}</span>
              <span className={`ml-3 text-xs font-bold px-2 py-1 rounded ${lesson.status === "LIVE" ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-700"}`}>
                {lesson.status}
              </span>
              {lesson.lockedBy && (
                <span className="ml-3 text-xs font-bold bg-red-100 text-red-600 px-2 py-1 rounded">
                  🔒 Bị khóa bởi {lesson.lockedBy}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => handleEdit(lesson)}
                className="bg-blue-500 text-white px-3 py-1 rounded text-sm hover:bg-blue-600"
              >
                Sửa Nội Dung
              </button>

              {lesson.status === "DRAFT" && lesson.lockedBy === currentUser && (
                <button className="bg-purple-600 text-white px-3 py-1 rounded text-sm hover:bg-purple-700">
                  🚀 Publish (Phát hành)
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}