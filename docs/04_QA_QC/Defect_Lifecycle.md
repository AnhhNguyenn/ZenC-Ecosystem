# QUY TRÌNH XỬ LÝ LỖI (DEFECT LIFECYCLE)

## 1. Mẫu Báo Cáo Lỗi (Bug Report Template)
Bất kỳ lỗi nào (Bug) được ghi nhận (trên Jira hoặc Github Issues) phải tuân theo cấu trúc sau:

**Tiêu đề (Title):** [Module] - Mô tả ngắn (Ví dụ: [Billing] Lỗi nhân đôi XP khi gửi cùng lúc 2 requests)
**Môi trường (Environment):** Staging / Production (Kèm Version / Commit ID).
**Mức độ ưu tiên (Priority):** Blocker / Critical / Major / Minor.
**Các bước tái hiện (Steps to Reproduce):**
1. Đăng nhập với tư cách User A.
2. Mở 2 tab trên trình duyệt.
3. Click "Nhận Thưởng" trên cả 2 tab cùng lúc.
**Kết quả thực tế (Actual Result):** User nhận được 2 lần thưởng.
**Kết quả mong muốn (Expected Result):** Hệ thống chặn request thứ 2, trả về lỗi "Đã nhận thưởng" (Sử dụng Redis Lock).
**Bằng chứng (Attachments):** Ảnh chụp màn hình lỗi, Log file (Sentry / Kibana), hoặc File ghi âm (nếu lỗi liên quan AI Voice).

## 2. Vòng Đời Của Một Lỗi (Defect Lifecycle)
- **New (Mới):** Tester tạo báo cáo lỗi.
- **Assigned (Đã giao):** Quản lý (PM) phân công cho Developer chịu trách nhiệm.
- **In Progress / Fixing (Đang sửa):** Developer đang tìm nguyên nhân và viết code sửa chữa.
- **Resolved / Ready for Test (Đã sửa):** Code đã merge vào nhánh Staging.
- **Re-testing / Verifying (Đang test lại):** Tester xác minh lỗi trên Staging.
  - Nếu test thất bại (Fail): Chuyển trạng thái về **Reopened** (Mở lại) trả về cho Dev.
  - Nếu test thành công (Pass): Chuyển trạng thái sang **Closed** (Đóng).
- **Deferred (Hoãn):** Lỗi không cấp thiết, quyết định đẩy sang Sprint tiếp theo.
