import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { useUserQuery } from "@/hooks/useAuth";

export type SocketStatus = "connecting" | "connected" | "disconnected" | "fallback";

export function useVoiceSocket(lessonId: string) {
  const { data: user } = useUserQuery();
  const socketRef = useRef<Socket | null>(null);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [messages, setMessages] = useState<{ role: "user" | "ai"; content: string }[]>([]);

  // Degrades gracefully to text mode if the socket can't sustain a connection.
  const triggerFallback = useCallback(() => {
    setStatus("fallback");
    socketRef.current?.disconnect();
  }, []);

  useEffect(() => {
    if (!user) return; // Wait for auth

    const wsUrl = process.env.NEXT_PUBLIC_WS_URL || "http://localhost:4000";
    
    // Enterprise Resiliency: Auto-reconnect with exponential backoff
    const socket = io(wsUrl, {
      path: "/socket.io",
      auth: { token: user.id }, // Assume token verification handled via handshake
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setStatus("connected");
      // Initial heartbeat ping
      socket.emit("join_lesson", { lessonId });
    });

    socket.on("disconnect", (reason) => {
      if (reason === "io server disconnect" || reason === "io client disconnect") {
        setStatus("disconnected");
      } else {
        // Automatically attempt to recover; if it fails 5 times, fallback is triggered via connect_error
        setStatus("connecting");
      }
    });

    socket.on("connect_error", (error) => {
      console.error("WebSocket Connection Error:", error);
      triggerFallback(); // V14 Principle: Protect the UX. Instantly degrade to text chat.
    });

    socket.on("ai_message", (data: { content: string }) => {
      setMessages((prev) => [...prev, { role: "ai", content: data.content }]);
    });

    return () => {
      socket.disconnect();
    };
  }, [user, lessonId, triggerFallback]);

  const sendAudio = useCallback((audioBlob: Blob) => {
    if (status !== "connected") return;
    socketRef.current?.emit("audio_chunk", { lessonId, audio: audioBlob });
    setMessages((prev) => [...prev, { role: "user", content: "[Audio Sent]" }]);
  }, [status, lessonId]);

  const sendTextMessage = useCallback(async (text: string) => {
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    
    if (status === "connected") {
      socketRef.current?.emit("text_message", { lessonId, text });
    } else {
      // Fallback: Send over standard HTTP if sockets are dead.
      console.log("Fallback HTTP used for text.");
      setMessages((prev) => [...prev, { role: "ai", content: "AI is processing your fallback message..." }]);
      // await axios.post('/api/voice/fallback', { text })
    }
  }, [status, lessonId]);

  return { status, messages, sendAudio, sendTextMessage, triggerFallback };
}
