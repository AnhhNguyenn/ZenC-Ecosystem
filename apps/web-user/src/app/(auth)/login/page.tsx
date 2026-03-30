"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./page.module.scss";
import { useLoginMutation } from "@/hooks/useAuth";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { AuthButtons } from "../AuthButtons";

export default function LoginPage() {
  const router = useRouter();
  const loginMutation = useLoginMutation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    try {
      // Calling our abstracted React Query mutation
      await loginMutation.mutateAsync({ email, password });
      router.push("/dashboard");
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || "Invalid credentials.");
    }
  };

  const handleSocialLogin = (provider: 'google' | 'apple') => {
    // Implement real OAuth redirect here
    console.log(`Initiating ${provider} login...`);
    // Example: window.location.href = `${process.env.NEXT_PUBLIC_API_URL}/auth/${provider}`;
  };

  return (
    <div className={styles.pageContainer}>
      <div className={styles.leftPanel}>
        <div className={styles.brand}>
          <h1>ZenC</h1>
        </div>

        <Card className={styles.loginCard}>
          <CardHeader>
            <CardTitle>Welcome back</CardTitle>
            <CardDescription>
              Sign in to your account to continue your learning journey.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthButtons onSocialLogin={handleSocialLogin} />

            <div className={styles.divider}>
              <span>or sign in with email</span>
            </div>

            <form onSubmit={handleLogin} className={styles.formGrid}>
              <Input
                label="Email address"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {errorMsg && (
                <div style={{ color: "var(--color-danger)", fontSize: "14px" }}>
                  {errorMsg}
                </div>
              )}

              <Button
                type="submit"
                variant="primary"
                size="md"
                className={styles.submitButton}
                isLoading={loginMutation.isPending}
              >
                Sign in
              </Button>
            </form>
            <p className={styles.registerPrompt}>
              Don't have an account? <a href="/register">Sign up</a>
            </p>
          </CardContent>
        </Card>
      </div>

      <div className={styles.rightPanel}>
        <h2 className={styles.marketingTitle}>Master your communication.</h2>
        <p className={styles.marketingSubtitle}>
          Practice with AI-native companions natively integrated into your
          workflow.
        </p>
      </div>
    </div>
  );
}
