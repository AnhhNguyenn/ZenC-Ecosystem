"use client";

import React from "react";
import { useParams } from "next/navigation";
import { PageHeader } from "@/components/layouts/PageLayout";
import { VoicePracticeSession } from "@/features/voice/components/VoiceSession";
import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function LessonPracticePage() {
  const params = useParams();
  const lessonId = params.id as string;

  return (
    <div>
      <div style={{ marginBottom: "var(--spacing-md)" }}>
        <Link href={`/lessons/${lessonId}`}>
          <Button variant="ghost" size="sm">
            ← Back to Lesson Data
          </Button>
        </Link>
      </div>

      <PageHeader
        title="Interactive Practice"
        subtitle="Conversational roleplay with your AI companion via WebSockets."
      />

      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <VoicePracticeSession lessonId={lessonId} />
      </div>
    </div>
  );
}
