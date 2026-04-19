"use client";

import Link from "next/link";
import { motion } from "motion/react";

export function GlobalTraceHeader() {
  return (
    <motion.header
      className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#05070A]/75 backdrop-blur-xl"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:h-[3.75rem] sm:px-6">
        <Link href="/" className="flex items-center gap-2.5 outline-none">
          <span className="relative grid size-8 place-items-center rounded-full border border-[#00F2FF]/35 bg-[#0a1018] shadow-[0_0_24px_-6px_rgba(0,242,255,0.45)]">
            <GlobalTraceGlyph className="size-[18px] text-[#00F2FF]" />
          </span>
          <span className="font-melodrama text-[0.875rem] font-medium tracking-[0.2em] text-white">
            GLOBALTRACE
          </span>
        </Link>

        <nav className="flex items-center gap-6 sm:gap-8">
          <Link
            href="/docs"
            className="hidden font-sans text-[0.8125rem] font-medium tracking-wide text-[#a0a0a0] transition hover:text-white sm:inline"
          >
            Documentation
          </Link>
          <Link
            href="/api-docs"
            className="hidden font-sans text-[0.8125rem] font-medium tracking-wide text-[#a0a0a0] transition hover:text-white sm:inline"
          >
            API
          </Link>
        </nav>
      </div>
    </motion.header>
  );
}

function GlobalTraceGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden fill="none">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeOpacity="0.35" strokeWidth="1" />
      <path
        d="M16 7c3 5 9 9 9 14a9 9 0 11-18 0c0-5 6-9 9-14z"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path
        d="M16 25c-2.5-4-6-7.5-6-11a6 6 0 0112 0c0 3.5-3.5 7-6 11"
        stroke="currentColor"
        strokeWidth="1"
        strokeOpacity="0.75"
      />
    </svg>
  );
}
