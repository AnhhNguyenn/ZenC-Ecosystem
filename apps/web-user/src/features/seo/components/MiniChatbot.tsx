"use client";

import React, { useState } from 'react';
import { Mic, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './MiniChatbot.module.scss';
import { motion, AnimatePresence } from 'framer-motion';

export default function MiniChatbot({ word }: { word: string }) {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  const handleFakeRecord = () => {
    setIsRecording(true);
    // Fake processing for 3 seconds, then prompt user to sign up
    setTimeout(() => {
      setIsRecording(false);
      setIsCompleted(true);
    }, 3000);
  };

  return (
    <div className={styles.chatbotContainer}>
      <div className={styles.header}>
        <div className={styles.avatar}>👩🏼‍🏫</div>
        <div>
          <h3>Sarah AI</h3>
          <p>Trợ lý luyện nói tiếng Anh</p>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {!isRecording && !isCompleted ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={styles.messageBox}
          >
            Chào bạn! Bạn vừa học từ <strong>{word}</strong> xong phải không? Bấm nút Micro bên dưới, thử đặt một câu ví dụ với từ này nhé, mình sẽ sửa lỗi ngữ pháp giúp bạn!
          </motion.div>
        ) : isRecording ? (
          <motion.div
            key="recording"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className={styles.messageBox}
            style={{ textAlign: 'center', color: 'var(--color-primary)', fontWeight: 'bold' }}
          >
            <div className="flex justify-center items-center gap-2">
              <span className="animate-pulse">🔴</span> Đang nghe bạn nói...
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="completed"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className={styles.messageBox}
            style={{ textAlign: 'center', fontWeight: 'bold' }}
          >
            🎉 Phát âm tốt lắm, tạo tài khoản để học tiếp
          </motion.div>
        )}
      </AnimatePresence>

      <div className={styles.actions}>
        {!isCompleted ? (
          <>
            <motion.button
              className={styles.btnTry}
              onClick={handleFakeRecord}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              disabled={isRecording}
            >
              {isRecording ? <Mic size={20} className="animate-pulse" /> : <Mic size={20} />}
              {isRecording ? "Đang thu âm..." : `Thử đọc từ ${word}`}
              {!isRecording && <ArrowRight size={16} />}
            </motion.button>
            <span className={styles.hint}>100% Miễn phí • Không cần tải App</span>
          </>
        ) : (
          <motion.button
            className={`${styles.btnTry} ${styles.btnRegister}`}
            onClick={() => router.push('/register')}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{ fontSize: '1.2rem', padding: '16px 24px', background: '#e11d48' }} // Distinctive CTA styling
          >
            Đăng ký ngay Miễn Phí <ArrowRight size={20} style={{ marginLeft: '8px' }} />
          </motion.button>
        )}
      </div>
    </div>
  );
}
