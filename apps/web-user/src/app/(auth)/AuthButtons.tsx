"use client";

import React from "react";
import { Button } from "@/components/ui/Button";
import styles from "./AuthButtons.module.scss";

interface AuthButtonsProps {
  onSocialLogin: (provider: "google" | "apple") => void;
}

export function AuthButtons({ onSocialLogin }: AuthButtonsProps) {
  return (
    <div className={styles.socialAuthContainer}>
      <Button
        variant="outline"
        className={styles.socialButton}
        onClick={() => onSocialLogin("google")}
        type="button"
      >
        <img
          src="https://www.svgrepo.com/show/475656/google-color.svg"
          alt="Google"
          width={20}
          height={20}
          className={styles.icon}
        />
        Tiếp tục với Google
      </Button>
      <Button
        variant="outline"
        className={styles.socialButton}
        onClick={() => onSocialLogin("apple")}
        type="button"
      >
        <img
          src="https://www.svgrepo.com/show/511330/apple-173.svg"
          alt="Apple"
          width={20}
          height={20}
          className={styles.icon}
        />
        Tiếp tục với Apple
      </Button>
    </div>
  );
}
