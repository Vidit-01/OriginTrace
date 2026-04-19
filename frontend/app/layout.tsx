import type { Metadata } from "next";
import { Geist_Mono } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/** Plus Jakarta Sans is loaded via Google Fonts in <head> (variable 200–800 + italics) — see globals.css `--font-plus-jakarta`. */

export const metadata: Metadata = {
  title: "Synergy — Supply chain trace",
  description:
    "Multi-tier supply chain reconstruction from open trade data — HSN-anchored graph (Tier 0–6).",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistMono.variable} dark h-full overflow-hidden antialiased`}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,200..800;1,200..800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex h-full min-h-0 flex-col overflow-hidden bg-[#030306] text-zinc-100 antialiased [text-rendering:optimizeLegibility]">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
