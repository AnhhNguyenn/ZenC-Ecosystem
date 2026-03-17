import React, { useState } from "react";
import { useVoiceSocket } from "../hooks/useVoiceSocket";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

export function VoicePracticeSession({ lessonId }: { lessonId: string }) {
  const { status, messages, sendAudio, sendTextMessage, triggerFallback } =
    useVoiceSocket(lessonId);
  const [textInput, setTextInput] = useState("");
  const [isRecording, setIsRecording] = useState(false);

  const handleStartRecording = () => {
    // MediaRecorder API implementation goes here
    // Ex: navigator.mediaDevices.getUserMedia({ audio: true })
    // For V14, we mock the trigger and fail gracefully if no mic.
    if (!navigator.mediaDevices) {
      alert("Microphone not supported. Falling back to text mode.");
      triggerFallback();
      return;
    }
    setIsRecording(true);
    // ... record ...
  };

  const handleStopRecording = () => {
    setIsRecording(false);
    // Simulate blob payload
    const mockBlob = new Blob(["audio data"], { type: "audio/webm" });
    sendAudio(mockBlob);
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!textInput.trim()) return;
    sendTextMessage(textInput);
    setTextInput("");
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Live AI Practice{" "}
          <span style={{ fontSize: "12px", color: status === "connected" ? "var(--color-success)" : status === "fallback" ? "var(--color-warning)" : "var(--color-danger)" }}>
            ({status.toUpperCase()})
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-md)" }}>
        
        {/* Chat Feed */}
        <div style={{ height: "300px", overflowY: "auto", border: "1px solid var(--color-neutral-200)", padding: "var(--spacing-md)", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ alignSelf: msg.role === "user" ? "flex-end" : "flex-start", backgroundColor: msg.role === "user" ? "var(--color-primary)" : "var(--color-neutral-100)", color: msg.role === "user" ? "white" : "var(--color-neutral-900)", padding: "var(--spacing-sm) var(--spacing-md)", borderRadius: "var(--radius-lg)", maxWidth: "80%" }}>
              {msg.content}
            </div>
          ))}
          {messages.length === 0 && (
            <div style={{ color: "var(--color-neutral-500)", textAlign: "center", marginTop: "auto", marginBottom: "auto" }}>
              Start speaking to interact with the AI...
            </div>
          )}
        </div>

        {/* Input Controls */}
        {status === "fallback" ? (
          <form onSubmit={handleSendText} style={{ display: "flex", gap: "var(--spacing-sm)" }}>
            <div style={{ flex: 1 }}>
              <Input
                placeholder="Microphone unavailable. Type here..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
              />
            </div>
            <Button type="submit">Send</Button>
          </form>
        ) : (
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Button
              variant={isRecording ? "danger" : "primary"}
              onClick={isRecording ? handleStopRecording : handleStartRecording}
              style={{ width: "200px", borderRadius: "99px" }} 
            >
              {isRecording ? "Stop Recording" : "Hold to Speak"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={triggerFallback}
              style={{ marginLeft: "var(--spacing-sm)" }}
            >
              Switch to Text
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
