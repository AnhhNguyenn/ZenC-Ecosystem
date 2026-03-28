# 🚀 MASTER WEB-USER BLUEPRINT (Kiến Trúc Tổng Hợp)

Tài liệu này là kim chỉ nam cho việc xây dựng và nâng cấp `apps/web-user` của hệ sinh thái ZenC, giải quyết triệt để các lỗ hổng UX/Logic vật lý của trình duyệt, đồng thời thiết kế hệ thống tương tác gây nghiện (Gamification) và chuẩn bị cho việc mở rộng B2B, SEO, và pháp lý (COPPA).

## 🛡️ PHASE 1: SURVIVAL MODE (Đảm bảo Lõi chạy không sập)
*Mục tiêu: Xử lý các "Huyệt tử" về âm thanh, kết nối mạng và bảo mật cơ bản trước khi user kịp chửi rủa.*

1. **Browser Physics Defense (Phòng thủ Vật lý Trình duyệt):**
   - **Bóng ma Background Tab:** Bắt sự kiện `document.addEventListener("visibilitychange")`. Khi `document.hidden === true` (khách chuyển qua app khác/tắt màn hình), Frontend tự động gửi lệnh `PAUSE` qua socket cho Backend, ngắt thu âm tạm thời, hiện Overlay phủ mờ "Buổi học đang tạm dừng". Khi quay lại, khách phải bấm [Tiếp tục] để nối lại luồng WebRTC/Socket.
   - **Địa ngục "Rút phích cắm" (Hardware Swap):** Bắt sự kiện `navigator.mediaDevices.ondevicechange`. Khi phát hiện tai nghe hết pin hoặc đổi mic, UI hiện Toast thông báo "Đã đổi thiết bị âm thanh" và ngầm re-negotiate lại `getUserMedia()` để không làm đứt luồng hội thoại.

2. **Zero-Trust Client (Chống Hacker Cày Top):**
   - **TUYỆT ĐỐI KHÔNG** nhận điểm số (XP/Score) từ Frontend.
   - Flow chuẩn: User trả lời -> API `POST /api/progress/submit-answer` (kèm Hash/Timestamp) -> Backend chấm điểm, cập nhật DB -> Backend trả về mảng XP để UI chạy hiệu ứng.

3. **Zero-Friction Entry (Onboarding Không Ma Sát):**
   - Đăng nhập 1-click (Google/SSO).
   - Bỏ qua mọi form điền thông tin dài dòng. User mới vào chỉ thấy đúng 1 nút khổng lồ: `[BẮT ĐẦU TRÒ CHUYỆN VỚI SARAH]`.
   - AI sẽ tự động hỏi tên, mục tiêu qua giọng nói trong buổi test đầu tiên.

---

## 🎰 PHASE 2: ADDICTION ENGINE (Gây nghiện & Giữ chân)
*Mục tiêu: Áp dụng Hook Model của Duolingo, biến việc học thành một trải nghiệm 도 Dopamine cao.*

1. **The Hook UI (Tâm lý học Hành vi):**
   - **Tài sản đập vào mắt:** Gim cứng 3 chỉ số (Lửa Streak, ZenC Coin, Huy Hiệu) trên Header màn hình. Khi Streak sắp mất, chuyển icon sang màu xám tro để kích hoạt tâm lý "Sợ mất mát" (Loss Aversion).
   - **Phần thưởng ngẫu nhiên (Variable Reward):** Hoàn thành bài học -> Mở rương báu (Loot box) -> Hiệu ứng pháo hoa (`canvas-confetti`) -> XP nhảy số ngẫu nhiên trước khi chốt.

2. **Aesthetic Usability (Thị giác Sư phạm & Micro-interactions):**
   - **Cứu rỗi Empty State:** Dashboard của user mới (XP=0) sẽ là một Illustration truyền cảm hứng (VD: Mascot cầm ngọn đuốc) kèm nút Pulse Effect gọi hành động làm test đầu vào.
   - **Micro-interactions Đỉnh cao:**
     - Sai lầm không bị trừng phạt: Không dùng màn hình đỏ. Chỉ bôi đỏ chữ cái sai và rung nhẹ (Shake animation).
     - Bấm Mic: Vang lên tiếng "Ting!" (dùng base64 audio ngầm).
     - Trả lời đúng: Điện thoại rung nhẹ (`navigator.vibrate` haptic feedback).
   - **Quy tắc 70/30:** Khi luyện Speaking, 70% màn hình dành cho Voice Visualizer và Subtitle. Xóa bỏ mọi nút thừa/menu sidebar.

---

## 🏢 PHASE 3: ENTERPRISE EXPANSION (Đại nhảy vọt)
*Mục tiêu: Đem tiền về cho công ty mà không tốn chi phí Marketing, sẵn sàng bán B2B và tuân thủ luật Quốc tế.*

1. **Programmatic SEO Machine (Tăng trưởng Tự động):**
   - Gateway Server mở cổng `API public/seo/:slug` không dính Auth Guard.
   - Web User dùng Next.js Server Components tại `app/(seo)/tu-vung/[slug]/page.tsx`.
   - Auto-generate 10.000 Landing Page SEO từ vựng với cấu trúc chuẩn: Định nghĩa, Ví dụ, và một khung Chatbot AI mini để luyện phát âm trực tiếp ngay trên kết quả search Google.

2. **B2B Multi-tenancy (White-labeling qua Subdomain):**
   - Next.js Middleware chặn subdomain (vd: `vus.zenc.ai`).
   - Tự động fetch config của Tenant (Logo, CSS Variables `--color-primary`) và tiêm vào gốc ứng dụng trước khi Render, tạo cảm giác App độc quyền cho doanh nghiệp.

3. **Child-Safety Mode (Quả bom pháp lý COPPA):**
   - Bắt buộc có màn hình **Age Gate** lúc đăng ký/onboarding.
   - Nếu `isMinor = true` (dưới 13 tuổi): UI không hiển thị chức năng MXH (nếu có). Backend tự động ngắt ghi disk (Ephemeral mode), cấm dùng data huấn luyện AI, và bỏ qua việc vector hóa (Embed) vào Qdrant.
