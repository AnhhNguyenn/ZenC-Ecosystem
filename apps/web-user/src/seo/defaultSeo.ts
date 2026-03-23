import { Metadata } from "next";

// V14 Architecture: Centralized Public SEO Configuration
// Private routes will explicitly override this with robots: noindex.

export const defaultSeoConfig: Metadata = {
  title: {
    default: "ZenC | Master Your Communication",
    template: "%s | ZenC",
  },
  description:
    "Accelerate your learning curve with AI-native roleplay companions and perfectly crafted lessons.",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://zenc.example.com",
    siteName: "ZenC Ecosystem",
    description:
      "Accelerate your learning curve with AI-native roleplay companions and perfectly crafted lessons.",
    images: [
      {
        url: "https://zenc.example.com/og-image.png",
        width: 1200,
        height: 630,
        alt: "ZenC Ecosystem",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: "@zencecosystem",
    creator: "@zencecosystem",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};
