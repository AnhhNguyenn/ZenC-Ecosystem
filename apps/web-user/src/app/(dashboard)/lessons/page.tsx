"use client";

import React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layouts/PageLayout";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useLessonsPathQuery } from "@/features/lessons/hooks/useLessons";

export default function LessonsPage() {
  // Logic attached: Pulling real data via React Query and Axios interceptors
  const { data: lessons, isLoading, isError } = useLessonsPathQuery();

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Curriculum & Practice" subtitle="Loading your learning path..." />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--spacing-lg)", marginTop: "var(--spacing-md)" }}>
          {[1,2,3,4].map((i) => <Skeleton key={i} style={{ height: "200px" }} />)}
        </div>
      </div>
    );
  }

  if (isError || !lessons) {
    return (
      <div>
        <PageHeader title="Curriculum & Practice" subtitle="Unable to fetch lessons." />
        <div style={{ color: "var(--color-danger)" }}>Please check your connection and try again.</div>
      </div>
    );
  }
  return (
    <div>
      <PageHeader
        title="Curriculum & Practice"
        subtitle="Select a scenario to begin your real-time AI voice session."
      />
      
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "var(--spacing-lg)", marginTop: "var(--spacing-md)" }}>
        {lessons.map((lesson) => (
          <Card key={lesson.id} hoverable>
            <CardHeader>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <CardTitle>{lesson.title}</CardTitle>
                <div style={{ 
                  padding: "4px 10px", 
                  backgroundColor: "var(--color-primary-light)", 
                  color: "var(--color-primary)", 
                  borderRadius: "var(--radius-pill)", 
                  fontSize: "12px", 
                  fontWeight: 700,
                  backdropFilter: "blur(4px)"
                }}>
                  {lesson.level}
                </div>
              </div>
              <CardDescription style={{ marginTop: "var(--spacing-sm)" }}>
                {lesson.description}
              </CardDescription>
            </CardHeader>
            <CardContent style={{ borderTop: "0.5px solid var(--color-neutral-200)", paddingTop: "var(--spacing-md)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "var(--font-size-meta)", color: lesson.isCompleted ? "var(--color-success)" : "var(--color-neutral-500)", fontWeight: 600 }}>
                {lesson.isCompleted ? "● Completed" : "● In Progress"}
              </span>
              <Link href={`/lessons/${lesson.id}/practice`}>
                <Button variant={lesson.isCompleted ? "secondary" : "primary"} size="sm">
                  {lesson.isCompleted ? "Review" : "Start Live"}
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
