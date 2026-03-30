import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Using Google Font for premium look
import "@/styles/globals.scss";
import { AuthProvider } from '@/features/auth/AuthContext';
import { ReactQueryProvider } from '@/providers/ReactQueryProvider';
import { TenantProvider } from '@/features/b2b/TenantProvider';
import { headers } from 'next/headers';

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZenC AI - Conversational English Mastery",
  description: "Master English with real-time AI conversation practice.",
  metadataBase: new URL('https://zenc.ai'),
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const tenantId = headersList.get('x-tenant-id') || 'zenc';

  return (
    <html lang="en">
      <body className={inter.className}>
        <TenantProvider tenantId={tenantId}>
          <AuthProvider>
            <ReactQueryProvider>
              {children}
            </ReactQueryProvider>
          </AuthProvider>
        </TenantProvider>
      </body>
    </html>
  );
}
