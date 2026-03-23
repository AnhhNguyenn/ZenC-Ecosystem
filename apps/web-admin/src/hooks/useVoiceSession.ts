import { useEffect, useRef, useState, useCallback } from 'react';
import { socketService } from '@/lib/socket';
import { addWavHeader } from '@/lib/audio-utils';

export interface UseVoiceSessionProps {
    token: string | null;
}

export function useVoiceSession({ token }: UseVoiceSessionProps) {
    const [state, setState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
    const [transcript, setTranscript] = useState<{ ai: string, user: string }>({ ai: '', user: '' });
    const [isConnected, setIsConnected] = useState(false);
    
    // Audio Context & Media Recorder
    const audioContextRef = useRef<AudioContext | null>(null);
    const mediaStreamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const audioQueueRef = useRef<ArrayBuffer[]>([]);
    const isPlayingRef = useRef(false);

    const connect = useCallback(() => {
        if (!token) return;
        socketService.connect(token);
        
        const socket = socketService.getSocket();
        if(!socket) return;
        
        socket.on('connect', () => setIsConnected(true));
        socket.on('disconnect', () => setIsConnected(false));
        
        socket.on('session_started', () => {
            setState('listening');
            startRecording();
        });
        
        socket.on('ai_transcript', (data: { text: string }) => {
             setState('speaking');
             setTranscript(prev => ({ ...prev, ai: data.text }));
        });
        
        socket.on('ai_audio_chunk', (chunk: ArrayBuffer) => {
            // Queue audio to play
            audioQueueRef.current.push(chunk);
            if (!isPlayingRef.current) {
                playNextChunk();
            }
        });
        
        socket.on('user_transcript', (data: { text: string }) => { // Assuming backend sends this
             setTranscript(prev => ({ ...prev, user: data.text }));
        });

    }, [token]);



    const playNextChunk = async () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setState('listening'); 
            return;
        }
        
        isPlayingRef.current = true;
        setState('speaking');
        
        if (!audioContextRef.current) {
            const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
            audioContextRef.current = new AudioContext();
        }
        
        const ctx = audioContextRef.current;
        const chunk = audioQueueRef.current.shift()!;
        
        try {
            // Assume backend sends Int16 PCM at 24000Hz (Gemini default) or 16000Hz (OpenAI)
            // We need to wrap it in a WAV header to use decodeAudioData
            // Or use a custom processor. Let's try WAV header approach for simplicity.
            
            // Convert ArrayBuffer to Int16Array
            const int16Data = new Int16Array(chunk);
            
            // Create WAV with 24kHz (Gemini standard)
            // TODO: Make sampleRate dynamic based on provider config
            const wavBuffer = addWavHeader(int16Data, 24000, 1, 16);
            
            const audioBuffer = await ctx.decodeAudioData(wavBuffer);
            const source = ctx.createBufferSource();
            source.buffer = audioBuffer;
            source.connect(ctx.destination);
            source.start();
            
            source.onended = () => {
                playNextChunk();
            };

        } catch (e) {
            console.error("Error playing audio chunk:", e);
            playNextChunk();
        }
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaStreamRef.current = stream;
            
            if (!audioContextRef.current) {
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            
            const ctx = audioContextRef.current;
            const source = ctx.createMediaStreamSource(stream);
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            
            processor.onaudioprocess = (e) => {
                if (state === 'speaking') return; // Don't record while AI speaks (echo cancellation simple)
                
                const inputData = e.inputBuffer.getChannelData(0);
                // Convert Float32 to Int16 for backend
                const pcmData = floatTo16BitPCM(inputData);
                socketService.emit('audio_chunk', pcmData);
            };
            
            source.connect(processor);
            processor.connect(ctx.destination); // Needed for script processor to run
            
            processorRef.current = processor;
            
        } catch (err) {
            console.error('Microphone error:', err);
        }
    };
    
    const floatTo16BitPCM = (output: Float32Array) => {
        const buffer = new ArrayBuffer(output.length * 2);
        const view = new DataView(buffer);
        for (let i = 0; i < output.length; i++) {
            const s = Math.max(-1, Math.min(1, output[i]));
            view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }
        return buffer;
    };

    const disconnect = () => {
        socketService.disconnect();
        mediaStreamRef.current?.getTracks().forEach(track => track.stop());
        processorRef.current?.disconnect();
        audioContextRef.current?.close();
        setIsConnected(false);
        setState('idle');
    };

    return {
        connect,
        disconnect,
        state,
        transcript,
        isConnected
    };
}
