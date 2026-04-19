"use client";

import Link from "next/link";
import { motion } from "motion/react";

import { BlindSpotFlashlight } from "./blind-spot-flashlight";

export function LandingHero() {
  return (
    <motion.section
      className="mx-auto max-w-4xl px-4 pb-8 pt-10 sm:px-6 sm:pb-12 sm:pt-16"
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.85, ease: [0.22, 1, 0.36, 1] }}
    >
      <motion.p
        className="font-mono text-[0.68rem] uppercase tracking-[0.28em] text-white/45"
        style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15, duration: 0.5 }}
      >
        Customs-scale data · Tier 0 → N
      </motion.p>

      <motion.h1
        className="mt-6 text-balance font-semibold tracking-[-0.02em] text-white sm:mt-8"
        style={{
          fontFamily: "var(--font-landing-display), ui-sans-serif",
          fontSize: "clamp(2.35rem, 6vw, 3.85rem)",
          lineHeight: 1.05,
        }}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      >
        <span className="font-extrabold text-white">Trace sub-suppliers</span>
        <br className="sm:hidden" />
        <span className="font-semibold text-white"> and raw inputs </span>
        <BlindSpotFlashlight />
      </motion.h1>

      <motion.p
        className="mt-8 max-w-xl text-pretty leading-relaxed text-white/[0.85] sm:mt-10 sm:text-lg"
        style={{ fontFamily: "var(--font-landing-display), ui-sans-serif" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.28, duration: 0.55 }}
      >
        Map product-specific supply networks from open trade records—past Tier-1
        into the chain that feeds production.
      </motion.p>

      <motion.div
        className="mt-12 sm:mt-14"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
          <Link
            href="/dashboard"
            className="inline-flex min-h-[60px] min-w-[min(100%,20rem)] items-center justify-center rounded-2xl bg-sky-400 px-12 py-4 text-center text-lg font-semibold tracking-tight text-zinc-950 shadow-[0_0_60px_-12px_rgba(56,189,248,0.75)] transition hover:bg-sky-300"
            style={{ fontFamily: "var(--font-landing-display), ui-sans-serif" }}
          >
            Get started
          </Link>
        </motion.div>
      </motion.div>

      <motion.dl
        className="mt-14 grid max-w-md grid-cols-3 gap-6 border-t border-white/10 pt-10 sm:mt-16"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.5 }}
      >
        <div>
          <dt
            className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.2em] text-white/40"
            style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
          >
            T0
          </dt>
          <dd
            className="mt-2 font-mono text-sm font-medium tabular-nums text-sky-300/95"
            style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
          >
            Anchor
          </dd>
        </div>
        <div>
          <dt
            className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.2em] text-white/40"
            style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
          >
            T1–T3
          </dt>
          <dd
            className="mt-2 font-mono text-sm font-medium tabular-nums text-cyan-300/90"
            style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
          >
            Direct → sub
          </dd>
        </div>
        <div>
          <dt
            className="font-mono text-[0.62rem] font-medium uppercase tracking-[0.2em] text-white/40"
            style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
          >
            T4+
          </dt>
          <dd
            className="mt-2 font-mono text-sm font-medium tabular-nums text-violet-300/85"
            style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
          >
            Raw inputs
          </dd>
        </div>
      </motion.dl>
    </motion.section>
  );
}
