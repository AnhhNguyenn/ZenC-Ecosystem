import { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '@/lib/socket';
import { addWavHeader } from '@/lib/audio-utils';

export interface UseVoiceSessionProps {
  token: string | null;
}

export type VoiceState = 'idle' | 'listening' | 'thinking' | 'speaking';

/**
 * useVoiceSession – Core hook managing the real-time voice conversation.
 *
 * Audio pipeline:
 * 1. getUserMedia → real Microphone stream
 * 2. AudioContext (at device's native sample rate, e.g. 48kHz) → OfflineAudioContext for resampling to 16kHz
 * 3. ScriptProcessorNode: Float32 → Int16 PCM → emit('audio_chunk') over Socket.io /voice namespace
 *
 * Playback pipeline:
 * 1. Receive 'ai_audio_chunk' ArrayBuffer (Int16 PCM at 24kHz from Gemini)
 * 2. addWavHeader() → decodeAudioData → play via AudioContext
 *
 * State machine: idle → listening ↔ thinking ↔ speaking → idle
 */
export function useVoiceSession({ token }: UseVoiceSessionProps) {
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<{ ai: string; user: string }>({ ai: '', user: '' });
  const [isConnected, setIsConnected] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [latestCorrection, setLatestCorrection] = useState<string | null>(null);

  // Audio refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Mute ref for use inside the audio processor callback (closure-safe)
  const isMutedRef = useRef(false);

  // Keep isMutedRef in sync with state
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // ── Audio Playback ─────────────────────────────────────────────

  const playNextChunk = useCallback(async () => {
    if (audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setState('listening');
      return;
    }

    isPlayingRef.current = true;
    setState('speaking');

    if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioContextRef.current = new AudioCtx();
    }

    const ctx = audioContextRef.current;

    // Resume context if suspended (browser autoplay policy)
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }

    const chunk = audioQueueRef.current.shift()!;

    try {
      // Gemini sends Int16 PCM at 24kHz (OpenAI: 24kHz). Wrap in WAV header.
      const int16Data = new Int16Array(chunk);
      const wavBuffer = addWavHeader(int16Data, 24000, 1, 16);
      const audioBuffer = await ctx.decodeAudioData(wavBuffer);

      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
      source.onended = () => playNextChunk();
    } catch (e) {
      console.error('[Voice] Audio playback error:', e);
      playNextChunk(); // Skip bad chunk, play next
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Microphone Recording ───────────────────────────────────────

  /**
   * Resample Float32 audio from native device sample rate → 16kHz using
   * pure mathematical linear interpolation. NO OfflineAudioContext needed.
   *
   * Previous implementation created a new OfflineAudioContext per call (~20/sec),
   * causing severe memory leaks and browser tab crashes after minutes of use.
   */
  const resampleTo16kHz = (
    inputBuffer: Float32Array,
    fromSampleRate: number,
  ): Int16Array => {
    if (fromSampleRate === 16000) {
      return floatTo16BitPCM(inputBuffer);
    }

    const ratio = fromSampleRate / 16000;
    const outputLength = Math.round(inputBuffer.length / ratio);
    const output = new Float32Array(outputLength);

    for (let i = 0; i < outputLength; i++) {
      const srcIndex = i * ratio;
      const srcFloor = Math.floor(srcIndex);
      const srcCeil = Math.min(srcFloor + 1, inputBuffer.length - 1);
      const frac = srcIndex - srcFloor;
      // Linear interpolation between two nearest samples
      output[i] = inputBuffer[srcFloor] * (1 - frac) + inputBuffer[srcCeil] * frac;
    }

    return floatTo16BitPCM(output);
  };

  const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  };

  const startRecording = useCallback(async (config: { sampleRate: number; channels: number; bytesPerSample: number; settings?: any }) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
        audioContextRef.current = new AudioCtx();
      }

      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') await ctx.resume();

      const nativeSampleRate = ctx.sampleRate;
      socketService.emit('audio_config', {
        sampleRate: 16000,
        channels: 1,
        bytesPerSample: 2,
        ...config.settings
      });

      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Buffer size 4096 gives ~85ms chunks at 48kHz – good tradeoff for latency
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        // Skip if muted or AI is speaking (simple echo-cancellation guard)
        if (isMutedRef.current || state === 'speaking') return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Synchronous linear interpolation resampler (no OfflineAudioContext)
        const pcm16 = resampleTo16kHz(new Float32Array(inputData).slice(), nativeSampleRate);
        socketService.emit('audio_chunk', pcm16.buffer);
      };

      source.connect(processor);
      // ScriptProcessor requires connection to destination to run
      processor.connect(ctx.destination);
      processorRef.current = processor;

      console.log('[Voice] Microphone started, native rate:', nativeSampleRate);
    } catch (err) {
      console.error('[Voice] Microphone access error:', err);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reNegotiateAudio = useCallback(async () => {
    console.log('[Voice] Re-negotiating audio due to device change or unpause');
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    // Attempt to grab the stream again
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: { ideal: 16000 },
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = stream;

      if (sourceNodeRef.current && audioContextRef.current) {
         sourceNodeRef.current.disconnect();
         const newSource = audioContextRef.current.createMediaStreamSource(stream);
         sourceNodeRef.current = newSource;

         if (processorRef.current) {
           newSource.connect(processorRef.current);
         }
      }
    } catch (err) {
      console.error('[Voice] Failed to re-negotiate audio', err);
    }
  }, []);

  // ── Browser Physics Defense ────────────────────────────────────

  // Background Tab Defense
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.warn('[Voice] Tab hidden. Pausing session.');
        setIsPaused(true);
        // Instruct backend to pause AI processing
        socketService.emit('client_paused', { reason: 'background_tab' });

        // Disconnect audio source to stop recording processing
        if (sourceNodeRef.current) {
           sourceNodeRef.current.disconnect();
        }
      }
      // Note: We don't auto-resume when visible. User must click "Resume".
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Hardware Swap Defense
  useEffect(() => {
    const handleDeviceChange = () => {
       console.warn('[Voice] Hardware swap detected.');
       // Optionally show a toast here, or rely on UI to react to `isPaused` or general state
       // Silent re-negotiation:
       reNegotiateAudio();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [reNegotiateAudio]);

  const resumeSession = useCallback(async () => {
    console.log('[Voice] Resuming session');

    // Ensure Context is awake
    if (audioContextRef.current && audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }

    // Re-grab microphone and connect
    await reNegotiateAudio();

    // Instruct backend to resume
    socketService.emit('client_resumed', {});
    setIsPaused(false);
  }, [reNegotiateAudio]);


  // ── Socket Event Handler Setup ─────────────────────────────────

  const connect = useCallback((settings?: { vnSupportEnabled: boolean; speakingSpeed: number }) => {
    if (!token) return;

    socketService.connect(token);
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('connect', () => setIsConnected(true));
    socket.on('disconnect', () => {
      setIsConnected(false);
      setState('idle');
    });

    // Gateway sends session_started immediately after auth + setup
    socket.on('session_started', () => {
      setState('listening');
      startRecording({ sampleRate: 16000, channels: 1, bytesPerSample: 2, settings });
    });

    socket.on('ai_transcript', (data: { text: string }) => {
      setState('thinking');
      setTranscript((prev) => ({ ...prev, ai: data.text }));
    });

    // AI audio arrives → queue it
    socket.on('ai_audio_chunk', (chunk: ArrayBuffer) => {
      audioQueueRef.current.push(chunk);
      if (!isPlayingRef.current) {
        playNextChunk();
      }
    });

    // Turn complete: AI done speaking, back to listening
    socket.on('turn_complete', () => {
      if (!isPlayingRef.current) {
        setState('listening');
      }
    });

    socket.on('user_transcript', (data: { text: string }) => {
      setState('thinking');
      setTranscript((prev) => ({ ...prev, user: data.text }));
    });

    // Grammar correction feedback
    socket.on('grammar_correction', (data: { hasMistake: boolean; correction: string }) => {
      if (data.hasMistake) {
        console.log('[Grammar]', data.correction);
        setLatestCorrection(data.correction);
        // Auto-dismiss correction after 5 seconds
        setTimeout(() => setLatestCorrection(null), 5000);
      }
    });

    socket.on('force_disconnect', (data: { reason: string }) => {
      console.warn('[Voice] Forced disconnect:', data.reason);
      disconnect();
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, startRecording, playNextChunk]);

  const disconnect = useCallback(() => {
    // Tell gateway to end session (triggers conversation scoring)
    socketService.emit('end_session', null);
    socketService.disconnect();

    // Stop microphone
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    processorRef.current?.disconnect();
    sourceNodeRef.current?.disconnect();
    audioContextRef.current?.close();

    // Reset state
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setIsConnected(false);
    setState('idle');
    setTranscript({ ai: '', user: '' });
    setLatestCorrection(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMute = useCallback(() => {
    const newMuted = !isMutedRef.current;
    isMutedRef.current = newMuted;
    setIsMuted(newMuted);

    // Physically disable microphone tracks for hardware mute
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !newMuted;
      });
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    connect,
    disconnect,
    toggleMute,
    resumeSession,
    state,
    transcript,
    isConnected,
    isMuted,
    isPaused,
    latestCorrection,
  };
}
