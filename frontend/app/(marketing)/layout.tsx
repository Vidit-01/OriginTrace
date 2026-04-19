import type { Metadata } from "next";
import { Inter_Tight, JetBrains_Mono } from "next/font/google";

const landingDisplay = Inter_Tight({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-landing-display",
});

const landingMono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-landing-mono",
});

export const metadata: Metadata = {
  title: "Synergy — Multi-tier supply chain intelligence",
  description:
    "Reconstruct Tier-N supply networks from open trade data: entity resolution, HSN anchors, recursive graph traversal, and risk-aware visualization.",
};

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div
      className={`${landingDisplay.variable} ${landingMono.variable} fixed inset-0 z-[100] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#030306] font-sans text-zinc-100 antialiased [text-rendering:optimizeLegibility]`}
    >
      {children}
    </div>
  );
}
