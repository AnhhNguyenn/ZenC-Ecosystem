# QUY CHUẨN LẬP TRÌNH VÀ HƯỚNG DẪN (CODING CONVENTION & GUIDELINES)

Tất cả các kỹ sư tham gia dự án ZenC bắt buộc phải tuân thủ 10 quy tắc vàng (The 10 Golden Rules) để bảo vệ hệ thống cấp doanh nghiệp.

## 1. Mười Quy Tắc Vàng (The 10 Golden Rules of Execution)

1. **Progressive Complexity Rollout:** Chỉ thêm tính năng phức tạp (Feature flags, rate-limited analytics queues) khi thực sự cần thiết.
2. **Quy ước Naming & Structure chặt chẽ:**
   - Files: `user.api.ts`, `user.service.ts`, `useUser.ts`, `UserCard.tsx`.
   - Folders theo dạng Feature-sliced: `feature-name/components/`, `hooks/`, `services/`.
3. **Quy tắc State 80/15/5 (Frontend):**
   - 80% Local State (Components)
   - 15% Server State (React Query qua `queryKeys.ts`)
   - 5% Global UI State (Zustand cho Sidebar toggles, Theme). Tuyệt đối không lạm dụng Zustand.
4. **Early Error Logging:** Phải khởi tạo Sentry/LogRocket từ sớm để bắt ngay lỗi API/UI.
5. **Strict Bundle Size Control:** Mọi thư viện nặng bắt buộc phải được lazy-loaded thông qua `next/dynamic`.
6. **Max Component Size Limit:** Nếu file `.tsx` vượt quá 300 dòng, bắt buộc phải refactor và tách file.
7. **UX Consistency > UI Beauty:** Giao diện có thể dự đoán là một giao diện nhanh. Dùng chung thiết kế nút, padding (20px), và skeleton patterns.
8. **Real SEO Content Strategy:** Chỉ áp dụng SEO cho các public path như `/blog`, `/guides`, `/lessons`.
9. **Graceful Voice Degradation:** Nếu microphone hoặc kết nối WebSocket gặp sự cố, hệ thống phải tự động fallback về text-chat ngay lập tức.
10. **Docs as Code:** Ghi lại mọi pattern cốt lõi vào thư mục `docs/`.

## 2. API Layer & Sự Cô Lập
- Luồng code bắt buộc: `Component` -> `Hook` -> `Service` -> `API`. Việc component gọi `axios.get` trực tiếp (trừ các mảng nhỏ như `/health`) là không thể chấp nhận.
- **Layered Error Boundaries:** Đặt Error Boundaries phân tầng (`AppErrorBoundary` -> `LayoutErrorBoundary` -> `FeatureErrorBoundary`) để tránh sập toàn trang.

## 3. Quản Lý Tính Toán Số Liệu & Token (Backend)
- **Atomic Operations:** Mọi thao tác trừ tiền (Token), cộng điểm kinh nghiệm (XP) bắt buộc phải sử dụng `increment()` trong TypeORM hoặc `INCRBY` trên Redis. KHÔNG ĐƯỢC DÙNG read-modify-write pattern.
- Không sử dụng các thao tác đồng bộ lớn (như tính toán `JSON.stringify().length` của payload lớn) bên trong Interceptors/Middleware.

## 4. Quản lý Môi trường
- File `.env` chứa mật khẩu/key API không bao giờ được commit.
- Trên production, dùng cú pháp `${ENV_VAR?must be set}` trong file Docker Compose để ngăn hệ thống chạy khi cấu hình bị rỗng.
