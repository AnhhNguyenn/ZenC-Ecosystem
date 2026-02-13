import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Google Font for premium look
import "@/styles/globals.scss";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZenC AI - Conversational English Mastery",
  description: "Master English with real-time AI conversation practice.",
  metadataBase: new URL('https://zenc.ai'),
};

import { AuthProvider } from '@/features/auth/AuthContext';

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
