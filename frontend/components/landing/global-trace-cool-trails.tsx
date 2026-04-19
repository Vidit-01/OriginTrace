"use client";

import gsap from "gsap";
import DottedMap from "dotted-map";
import { useId, useLayoutEffect, useMemo, useRef } from "react";

/** Neon “cool” palette — cyan, magenta, purple, lime, amber */
export const COOL_TRAIL_COLORS = [
  "#00F2FF",
  "#FF00E5",
  "#9D00FF",
  "#00FF41",
  "#FFB800",
] as const;

const HUBS = [
  { lat: 37.77, lng: -122.42 },
  { lat: 40.71, lng: -74.01 },
  { lat: 51.51, lng: -0.13 },
  { lat: 52.52, lng: 13.41 },
  { lat: 35.68, lng: 139.76 },
  { lat: 31.23, lng: 121.47 },
  { lat: 1.35, lng: 103.82 },
  { lat: -33.87, lng: 151.21 },
  { lat: -23.55, lng: -46.63 },
  { lat: 28.61, lng: 77.21 },
  { lat: 55.76, lng: 37.62 },
  { lat: 25.2, lng: 55.27 },
  { lat: 48.86, lng: 2.35 },
  { lat: 19.43, lng: -99.13 },
  { lat: -34.6, lng: -58.38 },
] as const;

/** Deterministic hub pick so trails scatter consistently (hydration-safe). */
function hubIndex(seed: number, salt: number) {
  return Math.abs((seed * 9301 + salt * 49297 + salt * seed) % HUBS.length);
}

function pairForIndex(i: number) {
  let a = hubIndex(i, 1);
  let b = hubIndex(i, 7);
  if (a === b) b = (b + 1 + (i % 5)) % HUBS.length;
  return [HUBS[a], HUBS[b]] as const;
}

function projectPoint(lat: number, lng: number) {
  const x = (lng + 180) * (800 / 360);
  const y = (90 - lat) * (400 / 180);
  return { x, y };
}

function curvedPathForIndex(
  start: { x: number; y: number },
  end: { x: number; y: number },
  i: number
) {
  const midX = (start.x + end.x) / 2;
  const lift = 38 + (i * 17) % 52 + ((i * 13) % 24);
  const midY = Math.min(start.y, end.y) - lift;
  return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
}

const TRAIL_COUNT = 44;

type TrailDef = {
  id: number;
  d: string;
  color: string;
  /** Stroke opacity — semitransparent */
  strokeOpacity: number;
  /** Seconds for one full dash-offset loop (slow, steady) */
  flowDuration: number;
  /** Gentle opacity breathing period (seconds) */
  breatheDuration: number;
};

function buildTrailDefs(): TrailDef[] {
  const out: TrailDef[] = [];
  for (let i = 0; i < TRAIL_COUNT; i++) {
    const [s, e] = pairForIndex(i);
    const p0 = projectPoint(s.lat, s.lng);
    const p1 = projectPoint(e.lat, e.lng);
    const d = curvedPathForIndex(p0, p1, i);
    const color =
      COOL_TRAIL_COLORS[i % COOL_TRAIL_COLORS.length] ?? COOL_TRAIL_COLORS[0];
    const strokeOpacity = 0.22 + ((i * 37) % 28) / 100;
    const flowDuration = 22 + (i % 19) * 1.15;
    const breatheDuration = 6 + (i % 11) * 0.55;
    out.push({ id: i, d, color, strokeOpacity, flowDuration, breatheDuration });
  }
  return out;
}

function FluidTrail({
  trail,
  filterId,
}: {
  trail: TrailDef;
  filterId: string;
}) {
  const pathRef = useRef<SVGPathElement>(null);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = Math.max(path.getTotalLength(), 80);

    /** Short dashes + wide gaps keep motion reading as fine threads, never chunky. */
    const dashSeg = Math.min(10, Math.max(3.5, len * 0.015));
    const gap = Math.max(22, len * 0.072);
    path.setAttribute("stroke-dasharray", `${dashSeg} ${gap}`);
    path.setAttribute("stroke-dashoffset", "0");

    const flow = gsap.to(path, {
      strokeDashoffset: -len,
      duration: trail.flowDuration,
      repeat: -1,
      ease: "none",
    });

    /** Narrow opacity swing so glow never reads as a thickening pulse. */
    const lo = trail.strokeOpacity * 0.78;
    const hi = Math.min(0.42, trail.strokeOpacity * 0.98);
    gsap.set(path, { opacity: lo });
    const breathe = gsap.to(path, {
      opacity: hi,
      duration: trail.breatheDuration / 2,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });

    return () => {
      flow.kill();
      breathe.kill();
      gsap.killTweensOf(path);
    };
  }, [trail.d, trail.flowDuration, trail.breatheDuration, trail.strokeOpacity]);

  return (
    <path
      ref={pathRef}
      d={trail.d}
      fill="none"
      stroke={trail.color}
      strokeWidth={0.55}
      strokeLinecap="round"
      filter={`url(#${filterId})`}
    />
  );
}

export function GlobalTraceCoolTrails() {
  const reactId = useId();
  const root = `gt-${reactId.replace(/:/g, "")}`;
  const filterId = `${root}-glow`;

  const trails = useMemo(() => buildTrailDefs(), []);

  const map = useMemo(() => new DottedMap({ height: 100, grid: "diagonal" }), []);
  const svgMap = useMemo(
    () =>
      map.getSVG({
        radius: 0.28,
        /** Muted mustard / dull gold — reads as yellow without blowing out contrast */
        color: "rgba(188, 162, 72, 0.26)",
        shape: "circle",
        backgroundColor: "transparent",
      }),
    [map]
  );

  const driftRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = driftRef.current;
    if (!el) return;
    const tween = gsap.to(el, {
      y: 4,
      duration: 22,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div
      ref={driftRef}
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <img
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="absolute inset-0 h-full w-full scale-[1.08] object-cover opacity-[0.97] [mask-image:radial-gradient(ellipse_92%_85%_at_50%_48%,black_12%,black_72%,transparent_96%)]"
        alt=""
      />
      <svg
        viewBox="0 0 800 400"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id={filterId} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="0.38" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {trails.map((t) => (
          <FluidTrail key={t.id} trail={t} filterId={filterId} />
        ))}
      </svg>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_95%_75%_at_50%_42%,transparent_18%,rgba(5,7,10,0.38)_58%,rgba(5,7,10,0.72)_88%)]" />
    </div>
  );
}
