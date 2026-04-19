"use client";

import { CircleDot, GitBranch, Hexagon } from "lucide-react";
import { useCallback, useRef, useState } from "react";

/**
 * Hover the phrase: a radial “flashlight” follows the cursor and reveals
 * gradient text plus small sub-node icons behind it.
 */
export function BlindSpotFlashlight() {
  const wrapRef = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [active, setActive] = useState(false);

  const onMove = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
  }, []);

  const onEnter = useCallback((e: React.PointerEvent<HTMLSpanElement>) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: e.clientX - r.left, y: e.clientY - r.top });
    setActive(true);
  }, []);

  return (
    <span
      ref={wrapRef}
      className="relative inline-block cursor-crosshair align-baseline"
      onPointerEnter={onEnter}
      onPointerLeave={() => setActive(false)}
      onPointerMove={onMove}
    >
      {/* Baseline phrase — low contrast */}
      <span className="relative z-[1] font-bold text-white/[0.16]">
        without the blind spot
      </span>

      {/* Revealed layer: icons + gradient copy, masked by flashlight */}
      <span
        className="pointer-events-none absolute left-0 top-0 z-[2] inline-block whitespace-nowrap"
        style={{
          opacity: active ? 1 : 0,
          transition: "opacity 0.15s ease",
          maskImage: active
            ? `radial-gradient(circle 92px at ${pos.x}px ${pos.y}px, #000 16%, transparent 68%)`
            : "none",
          WebkitMaskImage: active
            ? `radial-gradient(circle 92px at ${pos.x}px ${pos.y}px, #000 16%, transparent 68%)`
            : "none",
        }}
      >
        <GitBranch
          className="pointer-events-none absolute -left-2 top-1/2 size-[1.05em] -translate-y-1/2 text-sky-400"
          strokeWidth={1.35}
          aria-hidden
        />
        <CircleDot
          className="pointer-events-none absolute left-[38%] -top-1 size-[0.65em] text-cyan-300"
          aria-hidden
        />
        <Hexagon
          className="pointer-events-none absolute -right-1 bottom-0 size-[0.7em] text-violet-400"
          strokeWidth={1.35}
          aria-hidden
        />
        <span className="relative bg-gradient-to-r from-sky-200 via-white to-cyan-200 bg-clip-text font-bold text-transparent">
          without the blind spot
        </span>
      </span>
    </span>
  );
}
