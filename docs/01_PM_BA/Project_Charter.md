# TÀI LIỆU ĐIỀU LỆ DỰ ÁN (PROJECT CHARTER)

## 1. Tổng Quan Dự Án (Project Overview)
**Tên dự án:** ZenC AI Ecosystem - Enterprise Edition
**Mô tả:** ZenC là nền tảng học tiếng Anh giao tiếp AI thời gian thực (Real-time AI English Tutoring) cấp độ Enterprise, kết hợp cơ chế Gamification và Spaced Repetition.
**Mục tiêu (Goals):**
- Xây dựng hệ thống học tiếng Anh tương tác giọng nói với AI đạt độ trễ siêu thấp (<500ms).
- Sẵn sàng chịu tải quy mô lớn, lên tới 10.000+ CCU.
- Đem lại trải nghiệm học tập gắn kết (engaging) thông qua hệ thống Gamification.

## 2. Phạm Vi Dự Án (Scope)
### In-Scope (Trong phạm vi):
- Hệ thống Web User (Frontend) cho học viên: Giao diện luyện nói, bảng xếp hạng, quản lý tiến độ.
- Hệ thống Web Admin (Frontend) cho người quản trị: Quản lý học viên, khóa học, dữ liệu hệ thống.
- Gateway Server (Reflex Brain): Xử lý WebSocket, WebRTC, thanh toán, token, Rate Limiting.
- AI Worker (Deep Brain): Phân tích ngữ pháp, phát âm (Azure Speech), Spaced Repetition (SM-2), RAG với Qdrant.

### Out-of-Scope (Ngoài phạm vi):
- Native Mobile App (iOS/Android) trong giai đoạn V14 hiện tại (chỉ hỗ trợ Web/PWA).

## 3. Các Bên Liên Quan (Stakeholders)
- **Project Sponsor:** Ban Giám đốc ZenC Holdings.
- **Project Manager:** Quản lý ngân sách, tiến độ và rủi ro.
- **Product Owner / Business Analyst:** Định hình tính năng, yêu cầu nghiệp vụ.
- **Tech Lead / System Architect:** Đảm bảo hiệu suất kiến trúc, xử lý vấn đề kỹ thuật lớn.
- **Development Team:** Nhóm Frontend (Next.js), Nhóm Backend (NestJS, Python FastAPI).
- **QA/QC Team:** Đảm bảo chất lượng phần mềm trước khi release.

## 4. Tiến Trình Tổng Quan (Roadmap & Milestones)
- **Giai đoạn 1:** Xây dựng Core System, Dual Brain Model (Gateway + Worker).
- **Giai đoạn 2:** Phát triển Web User tích hợp WebRTC và Gamification.
- **Giai đoạn 3:** Xây dựng hệ thống CMS Web Admin.
- **Giai đoạn 4:** Load Testing (10,000 CCU) và Security Audit.
- **Giai đoạn 5:** Go-live và bảo trì hệ thống.
