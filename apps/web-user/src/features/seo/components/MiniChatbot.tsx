"use client";

import React, { useState } from 'react';
import { Mic, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import styles from './MiniChatbot.module.scss';
import { motion, AnimatePresence } from 'framer-motion';

export default function MiniChatbot({ word }: { word: string }) {
  const router = useRouter();
  const [isRecording, setIsRecording] = useState(false);

  const handleFakeRecord = () => {
    setIsRecording(true);
    // Fake processing for 2 seconds, then prompt user to sign up
    setTimeout(() => {
      setIsRecording(false);
      const wantToCreateAcc = window.confirm(`Giọng bạn rất hay! Bạn có muốn đăng ký tài khoản miễn phí để luyện nói "${word}" với Sarah AI không?`);
      if (wantToCreateAcc) {
        router.push('/register');
      }
    }, 2000);
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
        {!isRecording ? (
          <motion.div
            key="idle"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className={styles.messageBox}
          >
            Chào bạn! Bạn vừa học từ <strong>{word}</strong> xong phải không? Bấm nút Micro bên dưới, thử đặt một câu ví dụ với từ này nhé, mình sẽ sửa lỗi ngữ pháp giúp bạn!
          </motion.div>
        ) : (
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
        )}
      </AnimatePresence>

      <div className={styles.actions}>
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
      </div>
    </div>
  );
}
