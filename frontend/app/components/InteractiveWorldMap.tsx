"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { motion } from "framer-motion";
import DottedMap from "dotted-map";

interface MapProps {
  dots?: Array<{
    start: { lat: number; lng: number; label?: string };
    end: { lat: number; lng: number; label?: string };
  }>;
}

const colorsList = ["#00f5d4", "#f5a623", "#ff4f7b", "#a855f7"];

export default function InteractiveWorldMap({ dots = [] }: MapProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Generate dotted map
  const map = useMemo(() => new DottedMap({ height: 100, grid: "diagonal" }), []);
  const svgMap = useMemo(() => map.getSVG({
    radius: 0.22,
    color: "#ffffff",
    shape: "circle",
    backgroundColor: "transparent",
  }), [map]);

  const projectPoint = (lat: number, lng: number) => {
    const x = (lng + 180) * (800 / 360);
    const y = (90 - lat) * (400 / 180);
    return { x, y };
  };

  const getQuadBezierPoint = (start: {x:number, y:number}, end: {x:number, y:number}, mid: {x:number, y:number}, t: number) => {
    const x = Math.pow(1 - t, 2) * start.x + 2 * (1 - t) * t * mid.x + Math.pow(t, 2) * end.x;
    const y = Math.pow(1 - t, 2) * start.y + 2 * (1 - t) * t * mid.y + Math.pow(t, 2) * end.y;
    return { x, y };
  };

  const createCurvedPath = (
    start: { x: number; y: number },
    end: { x: number; y: number },
    mid: { x: number; y: number }
  ) => {
    return `M ${start.x} ${start.y} Q ${mid.x} ${mid.y} ${end.x} ${end.y}`;
  };

  // Pre-calculate projections and curved midPoint
  const paths = useMemo(() => {
    return dots.map((dot, index) => {
      const startPoint = projectPoint(dot.start.lat, dot.start.lng);
      const endPoint = projectPoint(dot.end.lat, dot.end.lng);
      
      const dist = Math.hypot(endPoint.x - startPoint.x, endPoint.y - startPoint.y);
      const midPoint = {
        x: (startPoint.x + endPoint.x) / 2,
        y: Math.min(startPoint.y, endPoint.y) - Math.max(50, dist * 0.3)
      };
      
      // Randomize colors for lines
      const r_color = colorsList[index % colorsList.length];
      
      return { startPoint, endPoint, midPoint, color: r_color };
    });
  }, [dots]);

  const [hoverStates, setHoverStates] = useState<boolean[]>(new Array(dots.length).fill(false));

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const scaleX = 800 / rect.width;
      const scaleY = 400 / rect.height;
      
      const mouseX = (e.clientX - rect.left) * scaleX;
      const mouseY = (e.clientY - rect.top) * scaleY;
      
      const threshold = 120 * scaleX; 

      const newHoverStates = paths.map((p) => {
        let isHovered = false;
        for (let t = 0; t <= 1; t += 0.1) {
          const pt = getQuadBezierPoint(p.startPoint, p.endPoint, p.midPoint, t);
          const dist = Math.hypot(pt.x - mouseX, pt.y - mouseY);
          if (dist < threshold) {
            isHovered = true;
            break;
          }
        }
        return isHovered;
      });

      setHoverStates(prev => {
        if (prev.some((val, i) => val !== newHoverStates[i])) {
          return newHoverStates;
        }
        return prev;
      });
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [paths]);


  const riskNodes = [
    { lat: 40.7128, lng: -74.0060 },
    { lat: 1.3521, lng: 103.8198 },
    { lat: -23.5505, lng: -46.6333 },
  ];

  return (
    <div ref={containerRef} className="absolute inset-0 w-full h-full overflow-hidden font-sans bg-[#050810]">
      {/* Background map */}
      <motion.img
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.6 }}
        transition={{ duration: 2 }}
        src={`data:image/svg+xml;utf8,${encodeURIComponent(svgMap)}`}
        className="h-full w-full object-cover [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)] pointer-events-none select-none"
        alt="world map"
        draggable={false}
      />
      
      <svg
        ref={svgRef}
        viewBox="0 0 800 400"
        className="w-full h-full absolute inset-0 select-none z-0"
        style={{ pointerEvents: "none" }}
      >
        <defs>
          <filter id="static-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          <filter id="glow-3" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          <filter id="glow-6" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" />
          </filter>
          <filter id="glow-12" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="12" />
          </filter>
        </defs>

        {paths.map((p, i) => {
          const isHovered = hoverStates[i];
          const pathD = createCurvedPath(p.startPoint, p.endPoint, p.midPoint);
          
          return (
            <g key={`path-group-${i}`}>
              {/* Layer 4 (far color spill) */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={p.color}
                filter="url(#glow-12)"
                animate={{ 
                  strokeWidth: isHovered ? 32 : 18,
                  opacity: isHovered ? 0.12 : 0.05
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />

              {/* Layer 3 (outer bloom) */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={p.color}
                filter="url(#glow-6)"
                animate={{ 
                  strokeWidth: isHovered ? 16 : 8,
                  opacity: isHovered ? 0.3 : 0.15
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />

              {/* Layer 2 (mid glow) */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={p.color}
                filter="url(#glow-3)"
                animate={{ 
                  strokeWidth: isHovered ? 6 : 3,
                  opacity: isHovered ? 0.6 : 0.4
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />

              {/* Layer 1 (innermost sharp core) */}
              <motion.path
                d={pathD}
                fill="none"
                stroke={p.color}
                strokeDasharray="4 8"
                animate={{ 
                  strokeWidth: isHovered ? 1.0 : 0.5,
                  opacity: 1.0
                }}
                transition={{ duration: 0.2, ease: "easeOut" }}
              />

              {/* Traveling Pulse Dot */}
              <g>
                <circle r="10" fill={p.color} opacity="0.15" filter="url(#glow-6)" />
                <circle r="5" fill={p.color} opacity="0.4" filter="url(#glow-3)" />
                <circle r="2" fill={p.color} opacity="1.0" />
                <animateMotion 
                  dur="4s" 
                  repeatCount="indefinite" 
                  path={pathD} 
                />
              </g>
            </g>
          );
        })}

        {paths.map((p, i) => {
          return (
            <g key={`points-group-${i}`}>
              {/* Glow layer nodes */}
              <circle cx={p.startPoint.x} cy={p.startPoint.y} r="4" fill={p.color} filter="url(#static-glow)" />
              <circle cx={p.endPoint.x} cy={p.endPoint.y} r="4" fill={p.color} filter="url(#static-glow)" />
              
              {/* Solid white core nodes */}
              <circle cx={p.startPoint.x} cy={p.startPoint.y} r="1.5" fill="#ffffff" />
              <circle cx={p.endPoint.x} cy={p.endPoint.y} r="1.5" fill="#ffffff" />
            </g>
          );
        })}

        {riskNodes.map((n, i) => {
          const pt = projectPoint(n.lat, n.lng);
          const color = colorsList[i % colorsList.length];
          return (
            <g key={`risk-${i}`}>
              <circle cx={pt.x} cy={pt.y} r="4" fill={color} filter="url(#static-glow)" />
              <circle cx={pt.x} cy={pt.y} r="1.5" fill="#ffffff" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}
