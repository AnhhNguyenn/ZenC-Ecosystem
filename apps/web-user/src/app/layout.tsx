import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Google Font for premium look
import "@/styles/globals.scss";
import { AuthProvider } from '@/features/auth/AuthContext';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZenC AI - Conversational English Mastery",
  description: "Master English with real-time AI conversation practice.",
  metadataBase: new URL('https://zenc.ai'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <ReactQueryProvider>
            {children}
          </ReactQueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
