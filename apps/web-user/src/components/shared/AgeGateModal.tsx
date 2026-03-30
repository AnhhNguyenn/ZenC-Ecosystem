"use client";

import React, { useState, useEffect } from 'react';
import styles from './AgeGateModal.module.scss';
import { ShieldCheck } from 'lucide-react';
import { socketService } from '@/lib/socket';

export function AgeGateModal() {
  const [isVisible, setIsVisible] = useState(false);
  const [hasVerified, setHasVerified] = useState(true);

  useEffect(() => {
    // Check local storage for existing verification
    const verified = localStorage.getItem('zenc_age_verified');
    if (!verified) {
      setIsVisible(true);
      setHasVerified(false);
    }
  }, []);

  const handleVerification = (isMinor: boolean) => {
    // Store locally to prevent re-asking
    localStorage.setItem('zenc_age_verified', 'true');
    localStorage.setItem('zenc_is_minor', isMinor.toString());

    // Set UI state
    setIsVisible(false);
    setHasVerified(true);

    // IMPORTANT: If user is < 13, inform backend to enforce Ephemeral Mode for COPPA compliance.
    // In a real flow, this would be an API call `POST /users/me/age-status` or passed in the socket auth token.
    if (isMinor) {
       console.warn('[COPPA] Minor user detected. Ephemeral mode enabled.');
       socketService.emit('client_coppa_status', { isMinor: true });
    }
  };

  if (!isVisible && hasVerified) return null;

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.iconWrapper}>
          <ShieldCheck size={40} />
        </div>

        <h2 className={styles.title}>Chào mừng bạn đến với ZenC!</h2>

        <p className={styles.subtitle}>
          Để cung cấp trải nghiệm học tập an toàn và cá nhân hóa nhất, chúng tôi cần biết độ tuổi của bạn.
        </p>

        <div className={styles.buttonGroup}>
          <button
            className={`${styles.btn} ${styles.btnOver13}`}
            onClick={() => handleVerification(false)}
          >
            Tôi 13 tuổi trở lên
          </button>

          <button
            className={`${styles.btn} ${styles.btnUnder13}`}
            onClick={() => handleVerification(true)}
          >
            Tôi dưới 13 tuổi
          </button>
        </div>

        <p className={styles.privacyText}>
          Bằng việc tiếp tục, bạn đồng ý với <a href="/privacy">Chính sách Quyền riêng tư</a> của chúng tôi.
        </p>
      </div>
    </div>
  );
}
