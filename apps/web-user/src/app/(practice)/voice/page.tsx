"use client";

import React from 'react';
import { clsx } from 'clsx';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/Button';
import { Mic, MicOff, PhoneOff, PhoneCall, Settings2, Play, Lock, Lightbulb } from 'lucide-react';
import styles from './page.module.scss';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/AuthContext';
import { RewardScreen } from '@/features/voice/RewardScreen';
import { SettingsModal } from '@/features/voice/SettingsModal';
import { useState, memo } from 'react';

// TẦNG 2: GIẢM CÂN APP (Bundle Size) - BẰNG DYNAMIC IMPORTS
const VoiceVisualizer = dynamic(() => import('@/features/voice/VoiceVisualizer'), { ssr: false });

// TẦNG 3: CÁCH LY TRẠNG THÁI (State Isolation) - CHỐNG NÓNG CPU
// Bọc Component Transcript bằng React.memo để ngăn re-render khi sóng âm hoặc thời gian thay đổi
const TranscriptView = memo(({ transcript, isActive }: { transcript: { ai: string; user: string }, isActive: boolean }) => (
  <Card className={styles.transcriptCard}>
    {transcript.ai && (
      <p className={styles.aiText}>
        <strong>AI:</strong> {transcript.ai}
      </p>
    )}
    {transcript.user && (
      <p className={styles.userText}>
        <strong>You:</strong> {transcript.user}
      </p>
    )}
    {!transcript.ai && !transcript.user && (
      <p className={styles.placeholderText}>
        {isActive
          ? 'Conversation will appear here...'
          : 'Tap "Start Conversation" to begin speaking with the AI tutor.'}
      </p>
    )}
  </Card>
));
TranscriptView.displayName = 'TranscriptView';

export default function VoicePracticePage() {
  const { token } = useAuth();
  const [showReward, setShowReward] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [voiceSettings, setVoiceSettings] = useState({
    vnSupportEnabled: true,
    speakingSpeed: 1.0,
  });
  const {
    connect,
    disconnect,
    toggleMute,
    state,
    transcript,
    isConnected,
    isMuted,
    isPaused,
    resumeSession,
    latestCorrection,
    permissionDenied,
  } = useVoiceSession({ token });

  const isActive = state !== 'idle';

  const [isPending, setIsPending] = useState(false);

  const handleToggleSession = async () => {
    if (isPending) return;
    setIsPending(true);

    try {
      if (isActive) {
        await disconnect();
        // Show reward screen immediately upon ending session
        setShowReward(true);
      } else {
        await connect(voiceSettings);
      }
    } finally {
      // Small debounce before allowing another click
      setTimeout(() => setIsPending(false), 500);
    }
  };

  if (showReward) {
    return <RewardScreen xpEarned={50} coinsEarned={15} onClose={() => setShowReward(false)} />;
  }

  return (
    <div className={styles.container}>
      {permissionDenied && (
        <div className={styles.pausedOverlay}>
          <div className={styles.pausedContent}>
            <h2 style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              Mic Permission Denied <Lock size={24} />
            </h2>
            <p>
              Trình duyệt đã chặn quyền truy cập Micro. Bạn cần bấm vào biểu tượng <strong style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>Ổ Khóa <Lock size={16} /></strong> trên thanh địa chỉ, chọn "Cho phép Micro", sau đó tải lại trang!
            </p>
            <Button size="lg" onClick={() => window.location.reload()} className={styles.resumeBtn} variant="primary">
              Đã mở quyền, Tải lại trang
            </Button>
          </div>
        </div>
      )}

      {isPaused && (
        <div className={styles.pausedOverlay}>
          <div className={styles.pausedContent}>
            <h2>Buổi học đang tạm dừng</h2>
            <p>Trình duyệt đã tạm ngắt kết nối âm thanh để tiết kiệm pin.</p>
            <Button size="lg" onClick={resumeSession} className={styles.resumeBtn}>
              <Play size={20} style={{ marginRight: '8px' }} />
              Bấm để tiếp tục
            </Button>
          </div>
        </div>
      )}

      <header className={styles.header}>
        <div className={styles.sessionInfo}>
          <h1 className={styles.title}>Free Talk Session</h1>
          <span className={clsx(styles.statusBadge, isConnected ? styles.online : styles.offline)}>
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Settings"
          onClick={() => setShowSettings(true)}
          disabled={isActive}
          title={isActive ? "Không thể đổi cài đặt khi đang trong buổi học" : "Cài đặt"}
        >
          <Settings2 size={24} />
        </Button>
      </header>

      {showSettings && (
        <SettingsModal
          initialSettings={voiceSettings}
          onClose={() => setShowSettings(false)}
          onSave={(settings) => setVoiceSettings(settings)}
        />
      )}

      <main className={styles.main}>
        {isActive ? (
          <VoiceVisualizer state={state} audioLevel={0.5} />
        ) : (
          <div className={clsx(styles.visualizerPlaceholder, "pulse-placeholder")}>
             <div className={styles.statusText}>Tap "Start Conversation" below to activate AI</div>
          </div>
        )}

        {latestCorrection && (
          <div className={styles.grammarBubble}>
            <span className={styles.correctionLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <Lightbulb size={16} color="var(--color-primary)" /> Sửa lỗi:
            </span> {latestCorrection}
          </div>
        )}

        <TranscriptView transcript={transcript} isActive={isActive} />
      </main>

      <footer className={styles.controls}>
        {/* Mute button – only relevant when session is active */}
        <Button
          variant={isMuted ? 'danger' : 'secondary'}
          size="icon"
          className={styles.controlBtn}
          onClick={toggleMute}
          disabled={!isActive}
          aria-label={isMuted ? 'Unmute microphone' : 'Mute microphone'}
          title={isMuted ? 'Click to unmute' : 'Click to mute'}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </Button>

        {/* Start / End session button */}
        <Button
          variant={isActive ? 'danger' : 'primary'}
          size="lg"
          className={styles.actionBtn}
          onClick={handleToggleSession}
          disabled={isPending}
          aria-label={isActive ? 'End conversation' : 'Start conversation'}
        >
          {isActive ? <PhoneOff size={24} /> : (
            <>
              <PhoneCall size={20} style={{ marginRight: '8px' }} />
              {isPending ? 'Connecting...' : 'Start Conversation'}
            </>
          )}
        </Button>
      </footer>
    </div>
  );
}
