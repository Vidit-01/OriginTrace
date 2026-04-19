"use client";

import { motion } from "motion/react";

import { DynamicTradeMap } from "./dynamic-trade-map";

export function LandingMapSection() {
  return (
    <motion.section
      className="relative z-10 mx-auto max-w-6xl px-4 pb-24 pt-16 sm:px-6 sm:pb-32 sm:pt-24"
      initial={{ opacity: 0, y: 48 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <DynamicTradeMap />
    </motion.section>
  );
}
