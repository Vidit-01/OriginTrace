"use client";

import { useId, useRef } from "react";
import { motion } from "motion/react";
import DottedMap from "dotted-map";

import { cn } from "@/lib/utils";

export type WorldMapDot = {
  start: { lat: number; lng: number; label?: string };
  end: { lat: number; lng: number; label?: string };
};

interface WorldMapProps {
  dots?: WorldMapDot[];
  lineColor?: string;
  /** Contained card (default) or full-bleed decorative layer. */
  variant?: "card" | "backdrop";
  className?: string;
}

export default function WorldMap({
  dots = [],
  lineColor = "#38bdf8",
  variant = "card",
  className,
}: WorldMapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const reactId = useId();
  const gradId = `wm-path-${reactId.replace(/:/g, "")}`;

  const map = new DottedMap({ height: 100, grid: "diagonal" });

  const svgMap = map.getSVG({
    radius: variant === "backdrop" ? 0.2 : 0.22,
    color: "rgba(255,255,255,0.22)",
    shape: "circle",
    backgroundColor: "transparent",
  });

  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    return { x, y };
  };

  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number }
  ) => {
    const midX = (start.x + end.x) / 2;
    const midY = Math.min(start.y, end.y) - 50;
    return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
  };

  return (
    <div
      className={cn(
        "relative font-sans",
        variant === "card" && "aspect-[2/1] w-full overflow-hidden rounded-2xl",
        variant === "backdrop" &&
          "pointer-events-none absolute inset-0 min-h-[100%] min-w-full overflow-hidden",
        className
      )}
    >
      <div
        className={cn(
          "relative h-full w-full",
          variant === "backdrop" &&
            "absolute left-1/2 top-1/2 min-h-[125%] min-w-[125%] -translate-x-1/2 -translate-y-1/2 scale-[1.12] sm:min-h-[135%] sm:min-w-[135%]"
        )}
      >
        <img
          src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
          className={cn(
            "pointer-events-none h-full w-full select-none object-cover opacity-90",
            variant === "backdrop" &&
              "[mask-image:radial-gradient(ellipse_85%_70%_at_50%_45%,black_20%,transparent_72%)]"
          )}
          alt=""
          height="495"
          width="1056"
          draggable={false}
        />
        <svg
          ref={svgRef}
          viewBox="0 0 800 400"
          className="pointer-events-none absolute inset-0 h-full w-full select-none"
          aria-hidden
        >
          <defs>
            <linearGradient id={gradId} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="white" stopOpacity="0" />
              <stop offset="5%" stopColor={lineColor} stopOpacity="1" />
              <stop offset="95%" stopColor={lineColor} stopOpacity="1" />
              <stop offset="100%" stopColor="white" stopOpacity="0" />
            </linearGradient>
          </defs>

          {dots.map((dot, i) => {
            const startPoint = projectPoint(dot.start.lat, dot.start.lng);
            const endPoint = projectPoint(dot.end.lat, dot.end.lng);
            return (
              <motion.path
                key={`path-${i}`}
                d={createCurvedPath(startPoint, endPoint)}
                fill="none"
                stroke={`url(#${gradId})`}
                strokeWidth="1"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{
                  duration: 1.1,
                  delay: 0.35 * i,
                  ease: "easeOut",
                }}
              />
            );
          })}

          {dots.map((dot, i) => (
            <g key={`pts-${i}`}>
              <g>
                <circle
                  cx={projectPoint(dot.start.lat, dot.start.lng).x}
                  cy={projectPoint(dot.start.lat, dot.start.lng).y}
                  r="2"
                  fill={lineColor}
                />
                <circle
                  cx={projectPoint(dot.start.lat, dot.start.lng).x}
                  cy={projectPoint(dot.start.lat, dot.start.lng).y}
                  r="2"
                  fill={lineColor}
                  opacity="0.45"
                >
                  <animate
                    attributeName="r"
                    from="2"
                    to="8"
                    dur="1.5s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.45"
                    to="0"
                    dur="1.5s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
              <g>
                <circle
                  cx={projectPoint(dot.end.lat, dot.end.lng).x}
                  cy={projectPoint(dot.end.lat, dot.end.lng).y}
                  r="2"
                  fill={lineColor}
                />
                <circle
                  cx={projectPoint(dot.end.lat, dot.end.lng).x}
                  cy={projectPoint(dot.end.lat, dot.end.lng).y}
                  r="2"
                  fill={lineColor}
                  opacity="0.45"
                >
                  <animate
                    attributeName="r"
                    from="2"
                    to="8"
                    dur="1.5s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                  <animate
                    attributeName="opacity"
                    from="0.45"
                    to="0"
                    dur="1.5s"
                    begin="0s"
                    repeatCount="indefinite"
                  />
                </circle>
              </g>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}
