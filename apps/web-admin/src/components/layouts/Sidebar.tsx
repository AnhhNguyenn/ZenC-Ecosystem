import React from "react";
import clsx from "clsx";
import styles from "./Sidebar.module.scss";
import Link from "next/link";
import { usePathname } from "next/navigation";

export interface SidebarSection {
  title: string;
  items: { label: string; href: string; icon?: React.ReactNode }[];
}

export interface SidebarProps {
  sections: SidebarSection[];
  header?: React.ReactNode;
}

export function Sidebar({ sections, header }: SidebarProps) {
  const pathname = usePathname();

  // Rule Enforcement: Max 3 sections allowed in V14 Architecture
  if (sections.length > 3) {
    console.warn("Sidebar Anti-Pattern: More than 3 sections provided.");
  }

  return (
    <aside className={styles.sidebar}>
      {header && <div className={styles.header}>{header}</div>}
      <div className={styles.content}>
        {sections.slice(0, 3).map((section, idx) => (
          <div key={idx} className={styles.section}>
            <h4 className={styles.sectionTitle}>{section.title}</h4>
            <nav>
              {/* Rule Enforcement: Max 7 items per section */}
              {section.items.slice(0, 7).map((item, i) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={i}
                    href={item.href}
                    className={clsx(styles.navItem, isActive && styles.active)}
                  >
                    {item.icon && <span>{item.icon}</span>}
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        ))}
      </div>
    </aside>
  );
}
