import { Metadata } from "next";
import { defaultSeoConfig } from "./defaultSeo";

export function getSeoMetadata(customConfig?: Partial<Metadata>): Metadata {
  return {
    ...defaultSeoConfig,
    ...customConfig,
    openGraph: {
      ...defaultSeoConfig.openGraph,
      ...customConfig?.openGraph,
    },
    twitter: {
      ...defaultSeoConfig.twitter,
      ...customConfig?.twitter,
    },
    // Ensure that if a page passes robots override (e.g., noindex), it applies.
    robots: customConfig?.robots || defaultSeoConfig.robots,
  };
}
