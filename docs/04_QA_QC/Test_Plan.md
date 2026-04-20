# KẾ HOẠCH KIỂM THỬ (TEST PLAN)

## 1. Giới Thiệu
Tài liệu cung cấp kế hoạch triển khai kiểm thử chi tiết cho phiên bản ZenC Enterprise (V14). Kế hoạch này áp dụng cho toàn bộ đội ngũ QA, QC và đội phát triển.

## 2. Tiêu Chí Vào / Ra (Entry & Exit Criteria)
**Entry Criteria (Điều kiện Bắt đầu Test):**
- Mã nguồn đã được Dev kiểm tra Unit Test với độ bao phủ (Coverage) >= 70%.
- Ứng dụng đã được deploy thành công lên môi trường Staging qua CI/CD Pipeline (K8s).

**Exit Criteria (Điều kiện Dừng Test):**
- 100% các Test Case mức độ Critical (Đăng nhập, Nạp tiền, Voice Chat) vượt qua.
- Không có lỗi mức độ "Blocker" hoặc "Critical" nào còn mở.
- Báo cáo chịu tải (Load test report) chứng minh hệ thống chịu được 10.000 CCU không có downtime.

## 3. Các Giai Đoạn Kiểm Thử (Phases)
### Phase 1: Sprint Testing (Trong lúc phát triển)
- Thực hiện kiểm thử API bằng Postman.
- Chạy tự động (Automated) Unit Tests và Integration Tests.

### Phase 2: System Integration Testing (SIT)
- Kiểm tra toàn trình (End-to-End) từ khi Web-User ghi âm -> Gateway nhận -> Worker tính điểm -> Gateway trả kết quả về Web-User.
- Chạy các kịch bản lỗi hệ thống (Tắt DB, ngắt mạng) để kiểm tra Fallback.

### Phase 3: User Acceptance Testing (UAT) & Performance Testing
- Sử dụng K6 tạo tải ảo qua WebSockets.
- Khách hàng nội bộ (ZenC Holdings) đánh giá tính thân thiện và UX của sản phẩm.

## 4. Quản Lý Rủi Ro
- Rủi ro đối tác thứ 3 (Gemini/OpenAI sập): Đảm bảo Circuit Breaker hoạt động.
- Rủi ro trễ tiến độ: Cắt giảm (Scope out) các tính năng Animation nhẹ trên Frontend để tập trung vào kiểm tra luồng tiền/token.
