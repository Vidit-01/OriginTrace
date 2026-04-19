import Link from "next/link";

import { LandingMapSection } from "@/components/landing/landing-map-section";
import { LandingHero } from "@/components/landing/landing-hero";

export default function LandingPage() {
  return (
    <div className="relative min-h-full">
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-[#030306]/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-16 sm:px-6">
          <Link
            href="/"
            className="text-sm font-semibold tracking-[-0.02em] text-white"
            style={{ fontFamily: "var(--font-landing-display), ui-sans-serif" }}
          >
            Synergy
          </Link>
          <Link
            href="/dashboard"
            className="rounded-xl bg-sky-400 px-5 py-2.5 text-sm font-semibold text-zinc-950 shadow-[0_0_40px_-12px_rgba(56,189,248,0.65)] transition hover:bg-sky-300"
            style={{ fontFamily: "var(--font-landing-display), ui-sans-serif" }}
          >
            Get started
          </Link>
        </div>
      </header>

      <main>
        <LandingHero />
        <LandingMapSection />
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] py-8 text-center">
        <p
          className="font-mono text-[0.65rem] text-white/30"
          style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
        >
          <Link
            href="/dashboard"
            className="text-white/45 underline-offset-4 hover:text-white/70"
          >
            Dashboard
          </Link>
          <span className="mx-2 text-white/20">·</span>
          <span className="text-white/35">Supply chain trace</span>
        </p>
      </footer>
    </div>
  );
}
