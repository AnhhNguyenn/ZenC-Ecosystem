"use client";

import React from 'react';
import { clsx } from 'clsx';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import { VoiceVisualizer } from '@/features/voice/VoiceVisualizer';
import { Button } from '@/components/ui/Button';
import { Mic, MicOff, PhoneOff, PhoneCall, Settings2 } from 'lucide-react';
import styles from './page.module.scss';
import { Card } from '@/components/ui/Card';
import { useAuth } from '@/features/auth/AuthContext';

export default function VoicePracticePage() {
  const { token } = useAuth();
  const {
    connect,
    disconnect,
    toggleMute,
    state,
    transcript,
    isConnected,
    isMuted,
  } = useVoiceSession({ token });

  const isActive = state !== 'idle';

  const handleToggleSession = () => {
    if (isActive) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div className={styles.sessionInfo}>
          <h1 className={styles.title}>Free Talk Session</h1>
          <span className={clsx(styles.statusBadge, isConnected ? styles.online : styles.offline)}>
            {isConnected ? 'Online' : 'Offline'}
          </span>
        </div>
        <Button variant="ghost" size="icon" aria-label="Settings">
          <Settings2 size={24} />
        </Button>
      </header>

      <main className={styles.main}>
        <VoiceVisualizer state={state} audioLevel={0.5} />

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
          aria-label={isActive ? 'End conversation' : 'Start conversation'}
        >
          {isActive ? <PhoneOff size={24} /> : (
            <>
              <PhoneCall size={20} style={{ marginRight: '8px' }} />
              Start Conversation
            </>
          )}
        </Button>
      </footer>
    </div>
  );
}
