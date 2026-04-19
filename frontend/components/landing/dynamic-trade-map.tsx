"use client";

import gsap from "gsap";
import DottedMap from "dotted-map";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

function randomPair() {
  let a = Math.floor(Math.random() * HUBS.length);
  let b = Math.floor(Math.random() * HUBS.length);
  while (b === a) b = Math.floor(Math.random() * HUBS.length);
  return [HUBS[a], HUBS[b]] as const;
}

function projectPoint(lat: number, lng: number) {
  const x = (lng + 180) * (800 / 360);
  const y = (90 - lat) * (400 / 180);
  return { x, y };
}

function curvedPath(
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const midX = (start.x + end.x) / 2;
  const midY = Math.min(start.y, end.y) - 48 - Math.random() * 22;
  return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
}

type Arc = { id: number; s: (typeof HUBS)[number]; e: (typeof HUBS)[number] };

function AnimatedArc({
  arc,
  gradId,
  glowId,
  onDone,
}: {
  arc: Arc;
  gradId: string;
  glowId: string;
  onDone: (id: number) => void;
}) {
  const pathRef = useRef<SVGPathElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;

  const d = useMemo(() => {
    const p0 = projectPoint(arc.s.lat, arc.s.lng);
    const p1 = projectPoint(arc.e.lat, arc.e.lng);
    return curvedPath(p0, p1);
  }, [arc]);

  useLayoutEffect(() => {
    const path = pathRef.current;
    if (!path) return;
    const len = Math.max(path.getTotalLength(), 120);
    gsap.killTweensOf(path);

    gsap.fromTo(
      path,
      { strokeDasharray: len, strokeDashoffset: len, opacity: 0 },
      {
        strokeDashoffset: 0,
        opacity: 1,
        duration: 1.05 + Math.random() * 0.35,
        ease: "power2.out",
      }
    );

    const tl = gsap.timeline({
      onComplete: () => doneRef.current(arc.id),
    });
    tl.to(path, { opacity: 0, duration: 0.75, ease: "power2.in", delay: 2.15 });
    return () => {
      tl.kill();
      gsap.killTweensOf(path);
    };
  }, [arc.id, d]);

  return (
    <path
      ref={pathRef}
      d={d}
      fill="none"
      stroke={`url(#${gradId})`}
      strokeWidth={1.35}
      strokeLinecap="round"
      filter={`url(#${glowId})`}
      opacity={0}
    />
  );
}

export function DynamicTradeMap() {
  const reactId = useId();
  const rootId = `dtm-${reactId.replace(/:/g, "")}`;
  const gradId = `${rootId}-stroke`;
  const glowId = `${rootId}-glow`;

  const map = useMemo(() => new DottedMap({ height: 100, grid: "diagonal" }), []);
  const svgMap = useMemo(
    () =>
      map.getSVG({
        radius: 0.3,
        color: "rgba(255,255,255,0.42)",
        shape: "circle",
        backgroundColor: "transparent",
      }),
    [map]
  );

  const [arcs, setArcs] = useState<Arc[]>([]);
  const nextId = useRef(0);

  const removeArc = useCallback((id: number) => {
    setArcs((prev) => prev.filter((a) => a.id !== id));
  }, []);

  useEffect(() => {
    const tick = () => {
      nextId.current += 1;
      const id = nextId.current;
      const [s, e] = randomPair();
      setArcs((prev) => [...prev.slice(-9), { id, s, e }]);
    };
    tick();
    const interval = window.setInterval(tick, 1900 + Math.random() * 2200);
    return () => window.clearInterval(interval);
  }, []);

  const driftRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = driftRef.current;
    if (!el) return;
    const tween = gsap.to(el, {
      y: 6,
      duration: 10 + Math.random() * 4,
      repeat: -1,
      yoyo: true,
      ease: "sine.inOut",
    });
    return () => {
      tween.kill();
    };
  }, []);

  return (
    <div className="relative mx-auto w-full max-w-6xl">
      <div
        ref={driftRef}
        className="relative overflow-hidden rounded-[2rem] border border-white/15 bg-[#030306]/80 shadow-[0_0_120px_-28px_rgba(56,189,248,0.45)] backdrop-blur-[2px]"
      >
        <div className="relative aspect-[2.05/1] min-h-[280px] w-full sm:min-h-[340px]">
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
            className="pointer-events-none absolute inset-0 h-full w-full scale-[1.08] object-cover opacity-[0.98] [mask-image:linear-gradient(to_bottom,transparent,black_12%,black_78%,transparent)]"
            alt=""
            draggable={false}
          />
          <svg
            viewBox="0 0 800 400"
            className="absolute inset-0 h-full w-full"
            aria-hidden
          >
            <defs>
              <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="15%" stopColor="#38bdf8" stopOpacity="1" />
                <stop offset="85%" stopColor="#22d3ee" stopOpacity="1" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <filter id={glowId} x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="1.8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            {arcs.map((arc) => (
              <AnimatedArc
                key={arc.id}
                arc={arc}
                gradId={gradId}
                glowId={glowId}
                onDone={removeArc}
              />
            ))}
          </svg>
        </div>
      </div>
      <p
        className="mt-6 text-center font-mono text-[0.65rem] uppercase tracking-[0.28em] text-white/35"
        style={{ fontFamily: "var(--font-landing-mono), ui-monospace" }}
      >
        Illustrative corridors · regenerating
      </p>
    </div>
  );
}
