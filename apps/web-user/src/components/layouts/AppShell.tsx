"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.scss";
import { Menu, X, Flame, Gem, Medal } from "lucide-react";
import { AgeGateModal } from "@/components/shared/AgeGateModal";

export interface AppShellProps {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
}

function HookHeader() {
  // TODO: Fetch real user stats from global store or React Query
  const streak = 12;
  const coins = 3450;

  return (
    <div className={styles.hookHeader}>
      <div className={styles.hookAsset}>
        <Flame size={20} className={styles.flameIcon} />
        <span>{streak}</span>
      </div>
      <div className={styles.hookAsset}>
        <Gem size={20} className={styles.gemIcon} />
        <span>{coins}</span>
      </div>
      <div className={styles.hookAsset}>
        <Medal size={20} className={styles.medalIcon} />
      </div>
    </div>
  );
}

export function AppShell({ sidebar, header, children }: AppShellProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  // Close mobile menu on route change
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isMobileMenuOpen]);

  return (
    <div className={styles.appShell}>
      <AgeGateModal />
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className={styles.mobileOverlay} 
          onClick={() => setIsMobileMenuOpen(false)} 
        />
      )}

      {/* Sidebar Container */}
      <div className={`${styles.sidebarContainer} ${isMobileMenuOpen ? styles.sidebarOpen : ""}`}>
        {sidebar}
      </div>

      <div className={styles.mainWrapper}>
        {/* Mobile Header Toggle */}
        <div className={styles.mobileHeader}>
          <button className={styles.menuButton} onClick={() => setIsMobileMenuOpen(true)}>
            <Menu size={24} />
          </button>
          <span className={styles.mobileTitle}>ZenC.</span>
        </div>
        
        {/* Desktop Optional Header (Usually injected by God-page wrappers) */}
        {header ? <div className={styles.desktopHeader}>{header}</div> : <div className={styles.desktopHeader}><HookHeader /></div>}
        
        <main className={styles.scrollArea}>{children}</main>
      </div>
    </div>
  );
}
