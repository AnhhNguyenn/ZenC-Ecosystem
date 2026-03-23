"use client";

import React, { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import styles from "./AppShell.module.scss";
import { Menu, X } from "lucide-react";

export interface AppShellProps {
  sidebar?: React.ReactNode;
  header?: React.ReactNode;
  children: React.ReactNode;
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
        {header && <div className={styles.desktopHeader}>{header}</div>}
        
        <main className={styles.scrollArea}>{children}</main>
      </div>
    </div>
  );
}
