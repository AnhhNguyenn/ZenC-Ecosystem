import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "@/styles/globals.scss";
import { ReactQueryProvider } from '@/providers/ReactQueryProvider'; // V14: Global React Query Hydration

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ZenC Admin | Dashboard",
  description: "ZenC System Administration",
  metadataBase: new URL('https://admin.zenc.ai'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ReactQueryProvider>
          {children}
        </ReactQueryProvider>
      </body>
    </html>
  );
}
