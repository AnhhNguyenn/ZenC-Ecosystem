import React, { useState } from 'react';
import styles from './SettingsModal.module.scss';
import { X } from 'lucide-react';

interface SettingsModalProps {
  onClose: () => void;
  onSave: (settings: { vnSupportEnabled: boolean; speakingSpeed: number }) => void;
  initialSettings: { vnSupportEnabled: boolean; speakingSpeed: number };
}

export function SettingsModal({ onClose, onSave, initialSettings }: SettingsModalProps) {
  const [vnSupportEnabled, setVnSupportEnabled] = useState(initialSettings.vnSupportEnabled);
  const [speakingSpeed, setSpeakingSpeed] = useState(initialSettings.speakingSpeed);

  const handleSave = () => {
    onSave({ vnSupportEnabled, speakingSpeed });
    onClose();
  };

  return (
    <div className={styles.overlay}>
      <div className={styles.modal}>
        <div className={styles.header}>
          <h2>Cài đặt Trợ giảng AI</h2>
          <button onClick={onClose}><X size={24} /></button>
        </div>

        <div className={styles.settingGroup}>
          <label>
            <span>Dịch gợi ý tiếng Việt</span>
            <div className={styles.toggleSwitch}>
              <input
                type="checkbox"
                checked={vnSupportEnabled}
                onChange={(e) => setVnSupportEnabled(e.target.checked)}
              />
              <span className={styles.slider}></span>
            </div>
          </label>
          <p style={{ fontSize: '12px', color: 'var(--color-neutral-500)', marginTop: '4px' }}>
            AI sẽ chèn thêm tiếng Việt nếu nhận thấy bạn ngập ngừng.
          </p>
        </div>

        <div className={styles.settingGroup}>
          <label>Tốc độ nói của AI: {speakingSpeed}x</label>
          <input
            type="range"
            min="0.8" max="1.2" step="0.1"
            value={speakingSpeed}
            onChange={(e) => setSpeakingSpeed(parseFloat(e.target.value))}
            className={styles.rangeInput}
          />
          <div className={styles.rangeLabels}>
            <span>Chậm (0.8x)</span>
            <span>Chuẩn (1.0x)</span>
            <span>Nhanh (1.2x)</span>
          </div>
        </div>

        <button className={styles.saveBtn} onClick={handleSave}>Lưu cài đặt</button>
      </div>
    </div>
  );
}
