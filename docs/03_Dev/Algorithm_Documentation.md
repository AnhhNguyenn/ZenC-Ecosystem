# TÀI LIỆU GIẢI THUẬT (ALGORITHM DOCUMENTATION)

## 1. Thuật toán Spaced Repetition (SuperMemo-2 / SM-2)
Hệ thống sử dụng phiên bản cải tiến của SM-2 để sắp xếp lịch ôn tập từ vựng, điểm ngữ pháp cho học viên dựa trên chất lượng các câu trả lời đàm thoại.

### 1.1 Nguyên lý hoạt động
Mỗi lần người dùng tương tác và học một từ mới, mô hình AI (Worker) sẽ chấm điểm sự hiểu biết hoặc phát âm trên thang điểm từ 0 (sai hoàn toàn) đến 5 (xuất sắc). Điểm này (Quality - Q) được đưa vào SM-2 để tính toán các hệ số:
- **Interval (I):** Số ngày tiếp theo phải ôn lại.
- **Easiness Factor (EF):** Yếu tố dễ dàng (bắt đầu bằng 2.5). Nếu trả lời đúng nhiều, EF tăng; sai nhiều EF giảm (nhưng không dưới 1.3).
- **Repetition (R):** Số lần trả lời đúng liên tiếp.

### 1.2 Pseudo-code
```python
def calculate_sm2(quality: int, interval: int, repetitions: int, easiness: float):
    if quality >= 3: # Correct answer
        if repetitions == 0:
            interval = 1
        elif repetitions == 1:
            interval = 6
        else:
            interval = int(round(interval * easiness))
        repetitions += 1
    else: # Incorrect answer
        repetitions = 0
        interval = 1

    # Cập nhật yếu tố dễ dàng (Easiness Factor)
    easiness = easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    if easiness < 1.3:
        easiness = 1.3

    return interval, repetitions, easiness
```

## 2. Sliding Window Summarization (Quản Lý Context Window Của LLM)
Để ngăn chi phí Token của LLM phình to do Context Window kéo dài, hệ thống áp dụng kỹ thuật Sliding Window Summarization kết hợp cùng Qdrant.

### 2.1 Giải thuật xử lý cửa sổ trượt (Sliding Window)
Khi người dùng chat, toàn bộ lịch sử (Transcript) được lưu vào MongoDB. Tuy nhiên, gửi toàn bộ mảng này cho LLM sẽ quá tốn kém. Gateway thực hiện cơ chế:
1. Giữ nguyên 5 turn hội thoại (10 messages) gần nhất.
2. Các turn hội thoại cũ hơn (từ message 11 trở lên) sẽ được đưa vào hàng đợi `RabbitMQ` để Deep Brain tổng hợp lại thành một đoạn Text tóm tắt ngắn (`summary_context`).
3. Payload gửi lên LLM gồm: `[System Prompt] + [Summary Context] + [5 Turns Gần Nhất]`.
