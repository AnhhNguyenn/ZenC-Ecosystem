# Kế Hoạch Nâng Cấp Hạ Tầng Voice (WebSocket → WebRTC)

**Trạng thái hiện tại:** Hệ thống đang sử dụng kiến trúc TCP/WebSocket. Đã được tối ưu toán học (Resampling) chạm nóc giới hạn của TCP. Đủ để tung ra thị trường (Go-to-Market).
**Mục tiêu tương lai:** Đạt độ trễ siêu thấp (< 100ms) trong mọi điều kiện mạng (3G/4G chập chờn, packet loss cao) cho quy mô hàng trăm ngàn CCU (Concurrent Users).

---

## 1. Nút Thắt Vật Lý Của WebSocket (Head-of-Line Blocking)

Mọi giao thức chạy trên nền **TCP** (bao gồm WebSocket) đều phải tuân thủ nguyên tắc: *Đảm bảo 100% gói tin đến đích theo đúng thứ tự*.
*   **Vấn đề:** Khi User lướt app trên xe khách hoặc vùng 3G yếu, nếu một gói tin âm thanh 20ms bị rớt, TCP sẽ bắt **toàn bộ luồng âm thanh phía sau phải dừng lại** để chờ gửi lại gói 20ms đó. 
*   **Hệ quả:** Gây ra hiện tượng khựng, lag, delay cộng dồn (ví dụ delay tăng dần từ 0.5s lên 2s) và vỡ tiếng AI.

## 2. Giải Pháp Chuẩn Xác Nhất: Giao Thức WebRTC (UDP)

Để giải quyết, bắt buộc phải đổi sang giao thức **UDP (WebRTC)**.
*   **Đặc điểm UDP:** "Fire and Forget" (Bắn và Quên). Nếu rớt 1 gói tin 20ms âm thanh, nó sẽ **BỎ QUA LUÔN** và phát tiếp gói tin hiện tại. 
*   **Kết quả:** Tai người nghe không thể nhận ra mất 20ms âm thanh, nhưng luồng hội thoại sẽ mượt mà tuyệt đối, y hệt như đang gọi Zalo hay dùng Google Meet. 

---

## 3. Lựa Chọn Công Nghệ (Media Server / SFU)

Để triển khai WebRTC cho hệ sinh thái AI Voice đa nền tảng, kiến trúc chuẩn hiện nay là sử dụng **SFU (Selective Forwarding Unit)**.

**GIẢI PHÁP TỐI ƯU NHẤT: LIVEKIT (https://livekit.io/)**
*   **Ngôn ngữ:** Viết bằng Go (Siêu nhẹ, siêu chịu tải).
*   **Đặc quyền AI:** LiveKit là nền tảng duy nhất hiện nay support Native AI Agents (OpenAI Realtime, Gemini) ở level hạ tầng. Nó có sẵn SDK cho Python Worker.
*   **SDK đa nền tảng:** Có sẵn UI Components cho React (Web), React Native, Flutter, Swift, Kotlin.

---

## 4. Lộ Trình Triển Khai (3 Bước Rạch Ròi)

Nhờ việc hệ thống hiện tại đã dọn dẹp sạch sẽ kiến trúc (Chia rõ Gateway, AI Worker, TypeORM PostgreSQL, Redis Billing), việc nâng cấp lên WebRTC sẽ **không phải đập đi xây lại Database hay Logic Trừ Tiền**.

### Bước 1: Frontend (App / Web) - Vứt Bỏ AudioWorklet
*   **Xóa toàn bộ:** Các đoạn code thao tác thủ công với `AudioContext`, `AudioWorklet`, ArrayBuffer PCM16.
*   **Thay thế bằng:** Cài đặt SDK `livekit-client`. Dùng component `<LiveKitRoom>` để tự động thu âm và stream thẳng lên mạng (Giảm 90% code lỗi phía Client).

### Bước 2: Gateway Server (Node.js) - Chuyển Vai Trò Sang "Bảo Mật & Bán Vé"
*   **Xóa:** File `voice.gateway.ts` (Không còn stream Audio qua Socket.io của Node.js nữa).
*   **Thêm mới:** Viết một REST API `/api/voice/join-room`.
*   **Logic:** Lúc này Node.js chỉ làm nhiệm vụ: `Check JWT Token của User` ➔ `Kiểm tra số dư Token trong Database` ➔ Nếu đủ tiền, Node.js sẽ ký một tấm vé (LiveKit Access Token) và trả về cho Client.
*   Client cầm vé đó kết nối đâm thẳng vào Server LiveKit.

### Bước 3: AI Worker (Python) - Trở Thành Một "Người Gọi Zalo" Thứ 2
*   Khi User join vào phòng LiveKit, AI Worker (Python) sẽ tự động nhận được tín hiệu qua Redis/Webhook.
*   AI Worker **cũng join vào chính căn phòng đó** (sử dụng `livekit-agents` SDK của Python).
*   Cơ chế: User nói ➔ LiveKit Server ➔ AI Worker nghe trực tiếp ➔ Đẩy cho OpenAI/Gemini xử lý ➔ Trả âm thanh lại vào phòng LiveKit. 
*   **Toàn bộ hệ thống lúc này y hệt một cuộc gọi nhóm.**

---

## 5. Tại Sao Nền Tảng Của Chúng Ta Sẵn Sàng 100% Cho Việc Này?

Vì trong quá trình Fix Bug và Scale-up vừa qua, chúng ta đã tách bạch hoàn toàn:
1.  **Quản lý ví tiền (Billing):** Chạy độc lập hoàn toàn bằng Redis HINCRBY. Dù xài WebRTC hay WebSocket, logic trừ tiền không đổi một dòng code.
2.  **Sự trọn vẹn của Session:** Tính điểm, lưu Transcript đều đã phi trạng thái (Stateless). Worker nhả kết quả cuối về Redis Streams (`XADD`) nên hệ thống cũ hay mới đều hứng được.
3.  **Hạ tầng Database:** PostgreSQL và CQRS Replication dư sức hứng hàng triệu bản ghi sau khi kết thúc cuộc gọi.

**CHỐT ĐỊNH HƯỚNG TƯỚNG LAI:** Cứ tập trung Marketing và kiếm tiền. Ngay khi đạt ngưỡng giới hạn 100.000 User, ném tài liệu này cho Team Tech để thay "Lốp xe" (Từ Socket.io sang LiveKit) ngay trên cao tốc mà không cần tắt động cơ.
