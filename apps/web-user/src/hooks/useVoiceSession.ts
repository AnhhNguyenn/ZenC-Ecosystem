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
   * OfflineAudioContext. The Gateway expects PCM 16-bit / 16kHz / Mono.
   */
  const resampleTo16kHz = async (
    inputBuffer: Float32Array,
    fromSampleRate: number,
  ): Promise<Int16Array> => {
    if (fromSampleRate === 16000) {
      // No resampling needed
      return floatTo16BitPCM(inputBuffer);
    }

    const frameCount = Math.round(inputBuffer.length * (16000 / fromSampleRate));
    const offlineCtx = new OfflineAudioContext(1, frameCount, 16000);

    const audioBuf = offlineCtx.createBuffer(1, inputBuffer.length, fromSampleRate);
    // copyToChannel requires Float32Array<ArrayBuffer>; create explicit copy to satisfy TypeScript
    const plainBuffer = new Float32Array(inputBuffer.length);
    plainBuffer.set(inputBuffer);
    audioBuf.copyToChannel(plainBuffer, 0);

    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuf;
    source.connect(offlineCtx.destination);
    source.start();

    const rendered = await offlineCtx.startRendering();
    return floatTo16BitPCM(rendered.getChannelData(0));
  };

  const floatTo16BitPCM = (input: Float32Array): Int16Array => {
    const output = new Int16Array(input.length);
    for (let i = 0; i < input.length; i++) {
      const s = Math.max(-1, Math.min(1, input[i]));
      output[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
    return output;
  };

  const startRecording = useCallback(async () => {
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
      const source = ctx.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      // Buffer size 4096 gives ~85ms chunks at 48kHz – good tradeoff for latency
      const processor = ctx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = async (e) => {
        // Skip if muted or AI is speaking (simple echo-cancellation guard)
        if (isMutedRef.current || state === 'speaking') return;

        const inputData = e.inputBuffer.getChannelData(0);
        // Slice to create a plain Float32Array<ArrayBuffer> copy (avoids SharedArrayBuffer type ambiguity)
        const pcm16 = await resampleTo16kHz(new Float32Array(inputData).slice(), nativeSampleRate);
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

  // ── Socket Event Handler Setup ─────────────────────────────────

  const connect = useCallback(() => {
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
      startRecording();
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
        // TODO: Surface this in UI as a subtle correction bubble
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
    state,
    transcript,
    isConnected,
    isMuted,
  };
}
