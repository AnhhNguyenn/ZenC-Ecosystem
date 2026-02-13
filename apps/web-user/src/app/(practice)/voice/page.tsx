"use client";

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { useVoiceSession } from '@/hooks/useVoiceSession';
import { VoiceVisualizer } from '@/features/voice/VoiceVisualizer';
import { Button } from '@/components/ui/Button';
import { Mic, MicOff, PhoneOff, Settings2 } from 'lucide-react';
import styles from './page.module.scss';
import { Card } from '@/components/ui/Card';

import { useAuth } from '@/features/auth/AuthContext';

export default function VoicePracticePage() {
  const { token } = useAuth();
  const { connect, disconnect, state, transcript, isConnected } = useVoiceSession({ token });
  const [isMuted, setIsMuted] = useState(false);

  const toggleSession = () => {
    if (state === 'idle') {
      connect();
    } else {
      disconnect();
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
    // TODO: Implement mute logic in hook
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
        <Button variant="ghost" size="icon">
          <Settings2 size={24} />
        </Button>
      </header>

      <main className={styles.main}>
        <VoiceVisualizer state={state} audioLevel={0.5} />
        
        <Card className={styles.transcriptCard}>
          {transcript.ai && (
            <p className={styles.aiText}>AI: {transcript.ai}</p>
          )}
          {transcript.user && (
            <p className={styles.userText}>You: {transcript.user}</p>
          )}
          {!transcript.ai && !transcript.user && (
             <p className={styles.placeholderText}>Conversation will appear here...</p>
          )}
        </Card>
      </main>

      <footer className={styles.controls}>
        <Button 
          variant={isMuted ? 'danger' : 'secondary'} 
          size="icon" 
          className={styles.controlBtn}
          onClick={toggleMute}
        >
          {isMuted ? <MicOff size={24} /> : <Mic size={24} />}
        </Button>

        <Button 
          variant={state === 'idle' ? 'primary' : 'danger'} 
          size="lg"
          className={styles.actionBtn}
          onClick={toggleSession}
        >
          {state === 'idle' ? 'Start Conversation' : <PhoneOff size={24} />}
        </Button>
      </footer>
    </div>
  );
}
