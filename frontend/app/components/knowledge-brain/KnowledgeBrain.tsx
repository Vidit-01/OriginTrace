'use client';

import dynamic from 'next/dynamic';
import React, { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  type ReactFlowInstance,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import {
  BookOpen,
  Factory,
  Globe2,
  Hash,
  Layers,
  Map as MapIcon,
  MessageCircle,
  Network,
  Search,
  Settings,
  StickyNote,
  User,
  Video,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import {
  ANCHOR_COMPANY_NAME,
  ANCHOR_HSN,
  buildSupplyChainGraph,
  PRODUCT_ANCHOR,
  tierAccent,
  type SupplyNodeData,
  transformBackendDataToGraph,
} from './supply-chain-data';

const SupplyChainMapView = dynamic(
  () => import('./SupplyChainMapView'),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full w-full items-center justify-center bg-[#06080c] text-sm text-zinc-500">
        Loading map…
      </div>
    ),
  }
);

/** @deprecated Use ANCHOR_COMPANY_NAME — kept for imports expecting this name */
export const KNOWLEDGE_GRAPH_ROOT_NAME = ANCHOR_COMPANY_NAME;
export type KnowledgeNodeData = SupplyNodeData;

const CYAN = '#00E8FF';

/** Zooming out past this clears locked path focus (see onMoveEnd). */
const PATH_LOCK_CLEAR_ZOOM = 0.32;

const TIER_LABELS: Record<number, string> = {
  0: 'Company (anchor)',
  1: 'Direct suppliers',
  2: 'Sub-suppliers / shippers',
  3: 'Material producers',
  4: 'Raw material producers',
  5: 'Mining inputs & services',
  6: 'Terminal industrial inputs',
};

type KnowledgeFlowNode = Node<SupplyNodeData, 'knowledge'>;

function SidebarItem({
  icon: Icon,
  active = false,
}: {
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`flex cursor-pointer items-center justify-center rounded-xl p-2 transition-all ${
        active
          ? 'bg-[#00E8FF] text-black shadow-[0_0_20px_rgba(0,232,255,0.35)]'
          : 'text-zinc-500 hover:bg-white/[0.06] hover:text-white'
      }`}
    >
      <Icon size={20} strokeWidth={2.25} />
    </button>
  );
}

const KnowledgeNode = memo(function KnowledgeNode({
  data,
  selected,
}: NodeProps<KnowledgeFlowNode>) {
  const accent = data.accentColor || CYAN;
  const t = data.tier;
  const size =
    t === 0 ? 'size-[58px]' : t <= 2 ? 'size-12' : t <= 4 ? 'size-11' : 'size-[38px]';
  const ring = t === 0 ? 'ring-2 ring-[#00E8FF]/45 ring-offset-2 ring-offset-[#06080c]' : '';
  const pathGlow = data.pathHighlight;

  const haloOuter =
    pathGlow ? 0.92 : selected ? 0.52 : 0.34;
  const haloInner =
    pathGlow ? 0.72 : selected ? 0.38 : 0.22;

  return (
    <div className="group flex max-w-[180px] flex-col items-center gap-1.5">
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-0 !bg-transparent !opacity-0"
      />
      <div className="relative flex flex-col items-center overflow-visible">
        {/* Wide ambient halo — always visible so tiers read as luminous */}
        <div
          className="pointer-events-none absolute -inset-8 scale-110 rounded-full blur-3xl transition-opacity duration-300 ease-out motion-safe:group-hover:opacity-90"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${accent} 0%, transparent 68%)`,
            opacity: haloOuter,
          }}
        />
        <div
          className="pointer-events-none absolute -inset-3 rounded-full blur-2xl transition-opacity duration-300 ease-out motion-safe:group-hover:opacity-80"
          style={{
            background: accent,
            opacity: haloInner,
          }}
        />
        <div
          className={`relative flex ${size} shrink-0 items-center justify-center rounded-full border-[2.5px] bg-gradient-to-b from-[#181d28] to-[#080a0e] shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] transition-all duration-300 ease-out motion-safe:group-hover:scale-[1.03] ${ring}`}
          style={{
            borderColor: pathGlow ? accent : selected ? accent : 'rgba(255,255,255,0.16)',
            boxShadow: pathGlow
              ? `0 0 36px ${accent}aa, 0 0 14px ${accent}66, inset 0 0 22px ${accent}22`
              : selected
                ? `0 0 28px ${accent}77, 0 0 10px ${accent}44, inset 0 0 16px ${accent}18`
                : `0 0 20px ${accent}40, 0 4px 22px rgba(0,0,0,0.55)`,
          }}
        >
          <div
            className={`rounded-full bg-white shadow-[0_0_14px_rgba(255,255,255,0.95)] ${
              t === 0 ? 'size-3' : t <= 2 ? 'size-2.5' : 'size-2'
            }`}
          />
        </div>
      </div>
      <span
        className="line-clamp-2 w-full select-none text-center text-[13px] font-semibold leading-snug tracking-tight text-zinc-50 [text-shadow:0_1px_12px_rgba(0,0,0,0.92),0_0_18px_rgba(0,0,0,0.55)]"
      >
        {data.label}
      </span>
      <span className="font-mono text-[10px] leading-none tracking-tight text-zinc-300 [text-shadow:0_1px_8px_rgba(0,0,0,0.85)]">
        {data.hsnCode}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
});
KnowledgeNode.displayName = 'KnowledgeNode';

/** Stable map + memo’d component — required so @xyflow’s nodeTypes ref check (dev warn #002) stays quiet. */
const KNOWLEDGE_NODE_TYPES = Object.freeze({ knowledge: KnowledgeNode });

/** Colored glow on SVG edge paths (tier stroke is hex/rgb). */
function edgeGlowFilter(color: string): string {
  return `drop-shadow(0 0 12px ${color}aa) drop-shadow(0 0 5px ${color}dd) drop-shadow(0 0 1px ${color})`;
}

type PathHighlight = {
  edgeIds: Set<string>;
  nodeIds: Set<string>;
};

function buildParentChildMaps(edges: Edge[]) {
  const parent = new Map<string, string>();
  const children = new Map<string, string[]>();
  for (const e of edges) {
    const s = String(e.source);
    const t = String(e.target);
    parent.set(t, s);
    if (!children.has(s)) children.set(s, []);
    children.get(s)!.push(t);
  }
  for (const arr of children.values()) arr.sort((a, b) => a.localeCompare(b));
  return { parent, children };
}

function computePathHighlight(
  hoverId: string | null,
  rootId: string,
  edges: Edge[]
): PathHighlight | null {
  if (!hoverId) return null;
  const { parent, children } = buildParentChildMaps(edges);
  const edgeIds = new Set<string>();
  const nodeIds = new Set<string>();

  let cur = hoverId;
  nodeIds.add(cur);
  while (cur !== rootId) {
    const p = parent.get(cur);
    if (!p) break;
    const edge = edges.find((e) => e.source === p && e.target === cur);
    if (edge) edgeIds.add(edge.id);
    nodeIds.add(p);
    cur = p;
  }

  const stack = [...(children.get(hoverId) ?? [])];
  while (stack.length) {
    const u = stack.pop()!;
    const p = parent.get(u);
    if (p === undefined) continue;
    const edge = edges.find((e) => e.source === p && e.target === u);
    if (edge) edgeIds.add(edge.id);
    nodeIds.add(u);
    for (const v of children.get(u) ?? []) stack.push(v);
  }

  return { edgeIds, nodeIds };
}

const { nodes: seedNodes, edges: seedEdges, rootId: SEED_ROOT_ID } =
  buildSupplyChainGraph();

function TierLegend() {
  return (
    <div className="pointer-events-none max-w-[min(100vw-2rem,320px)] rounded-xl border border-white/[0.08] bg-[#0b0d12]/90 px-3 py-2.5 shadow-lg backdrop-blur-md">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
        Supply tiers
      </p>
      <div className="mt-2 flex flex-wrap gap-x-2 gap-y-1">
        {Object.entries(TIER_LABELS).map(([k, v]) => (
          <span
            key={k}
            className="inline-flex items-baseline gap-1 rounded-md bg-white/[0.04] px-1.5 py-0.5 text-[10px] text-zinc-300"
          >
            <span className="font-mono font-semibold text-[#00E8FF]">T{k}</span>
            <span className="hidden sm:inline">{v}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function BirdsEyesFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(seedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seedEdges);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(SEED_ROOT_ID);
  const [panelTab, setPanelTab] = useState<'learn' | 'blend' | 'explore'>('learn');
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** Click-locked path source: keeps highlight after pointer leaves node; cleared on pane / zoom-out / other actions. */
  const [lockedPathSourceId, setLockedPathSourceId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<'graph' | 'map'>('graph');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRootId, setActiveRootId] = useState<string>(SEED_ROOT_ID);
  const rfRef = useRef<ReactFlowInstance<KnowledgeFlowNode, Edge> | null>(null);

  const handleSearch = async (searchTerm: string) => {
    if (!searchTerm.trim()) return;
    setIsLoading(true);
    setError(null);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const response = await fetch(`${baseUrl}/company/${encodeURIComponent(searchTerm)}`);
      if (!response.ok) {
        throw new Error(`Failed to fetch supply chain data: ${response.statusText}`);
      }
      const data = await response.json();
      const { nodes: newNodes, edges: newEdges, rootId: newRootId } = transformBackendDataToGraph(data);
      
      setNodes(newNodes);
      setEdges(newEdges);
      setActiveRootId(newRootId);
      setSelectedId(newRootId);
      setLockedPathSourceId(null);
      setHoveredId(null);
      
      // Auto-fit the view after a short delay to allow React Flow to render
      setTimeout(() => {
        rfRef.current?.fitView({ padding: 0.38, duration: 800 });
      }, 100);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const pathHighlightSourceId = lockedPathSourceId ?? hoveredId;

  const pathHighlight = useMemo(
    () => computePathHighlight(pathHighlightSourceId, activeRootId, edges),
    [pathHighlightSourceId, activeRootId, edges]
  );

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  );

  const neighbors = useMemo(() => {
    if (!selectedId) return { incoming: [] as string[], outgoing: [] as string[] };
    const incoming = edges.filter((e) => e.target === selectedId).map((e) => e.source);
    const outgoing = edges.filter((e) => e.source === selectedId).map((e) => e.target);
    return { incoming, outgoing };
  }, [edges, selectedId]);

  const connectedLabels = useMemo(() => {
    const ids = new Set([...neighbors.incoming, ...neighbors.outgoing]);
    return nodes
      .filter((n) => ids.has(n.id))
      .map((n) => ({
        id: n.id,
        label: n.data.label,
        color: n.data.accentColor,
        tier: n.data.tier,
      }));
  }, [neighbors, nodes]);

  const tierByNodeId = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) m.set(n.id, n.data.tier);
    return m;
  }, [nodes]);

  const displayNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const glow = pathHighlight?.nodeIds;
    const focusLock = lockedPathSourceId !== null;
    return nodes.map((n) => {
      const d = n.data;
      const hay = [d.label, d.country, d.hsnCode, d.commodity, d.about, d.parentLabel]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const dim = q.length > 0 && !hay.includes(q);
      const pathHighlightOn = !!(glow && glow.has(n.id));
      const offFocusPath =
        focusLock && glow && !glow.has(n.id);
      let opacity = 1;
      if (dim) opacity = 0.12;
      else if (offFocusPath) opacity = 0.08;
      const node: KnowledgeFlowNode = {
        ...n,
        type: 'knowledge',
        data: {
          ...n.data,
          pathHighlight: pathHighlightOn,
        },
        style: { ...n.style, opacity },
      };
      return node;
    });
  }, [nodes, query, pathHighlight, lockedPathSourceId]);

  const displayEdges = useMemo(() => {
    const hi = pathHighlight?.edgeIds;
    const active = !!pathHighlightSourceId && hi;
    return edges.map((e) => {
      const targetTier = tierByNodeId.get(String(e.target)) ?? 0;
      const tierStroke = tierAccent(targetTier);
      const highlighted = active && hi.has(e.id);
      const dimmed = active && !hi.has(e.id);
      return {
        ...e,
        animated: highlighted,
        style: {
          ...e.style,
          stroke: tierStroke,
          strokeWidth: highlighted ? 3.35 : dimmed ? 1.25 : 2.15,
          opacity: active ? (highlighted ? 1 : 0.18) : 0.82,
          filter: dimmed ? undefined : edgeGlowFilter(tierStroke),
        },
      };
    });
  }, [edges, pathHighlightSourceId, pathHighlight, tierByNodeId]);

  useEffect(() => {
    if (mainView !== 'graph') return;
    let cancelled = false;
    let attempts = 0;
    const tryFit = () => {
      if (cancelled || attempts++ > 40) return;
      const inst = rfRef.current;
      if (inst) {
        inst.fitView({
          padding: 0.12,
          duration: 280,
          minZoom: 0.012,
          maxZoom: 2.25,
        });
        return;
      }
      requestAnimationFrame(tryFit);
    };
    const t = window.setTimeout(tryFit, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [mainView]);

  const focusNeighbor = useCallback(
    (id: string) => {
      setLockedPathSourceId(id);
      setSelectedId(id);
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === id })));
      if (mainView === 'graph') {
        queueMicrotask(() => {
          rfRef.current?.fitView({
            nodes: [{ id }],
            padding: 0.48,
            duration: 520,
            maxZoom: 0.92,
            minZoom: 0.03,
          });
        });
      }
    },
    [mainView, setNodes]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#06080c] font-sans text-white">
      <aside className="z-30 flex w-[4.5rem] shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#070a10] py-7">
        <div className="mb-3 flex flex-col items-center gap-1">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-[#00E8FF] to-[#00a8cc] shadow-[0_0_24px_rgba(0,232,255,0.25)]">
            <Factory className="text-black" size={20} strokeWidth={2.25} />
          </div>
          <span className="max-w-[3rem] text-center text-[8px] font-bold uppercase leading-tight tracking-wider text-zinc-500">
            Synergy
          </span>
        </div>
        <div className="flex flex-col items-center gap-5">
          <SidebarItem icon={Layers} active />
          <SidebarItem icon={Search} />
          <SidebarItem icon={User} />
        </div>
        <div className="mt-auto flex flex-col items-center pb-1">
          <SidebarItem icon={Settings} />
        </div>
      </aside>

      <main className="relative min-h-0 min-w-0 flex-1">
        {mainView === 'map' ? (
          <SupplyChainMapView
            nodes={nodes}
            edges={edges}
            rootId={activeRootId}
            hoveredId={hoveredId}
            selectedId={selectedId}
            query={query}
            pathHighlight={pathHighlight}
            onHoverNode={setHoveredId}
            onSelectNode={(id) => {
              setLockedPathSourceId(id);
              setSelectedId(id);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === id })));
            }}
          />
        ) : (
          <ReactFlow<KnowledgeFlowNode, Edge>
            nodes={displayNodes}
            edges={displayEdges}
            nodeTypes={KNOWLEDGE_NODE_TYPES}
            fitView
            fitViewOptions={{
              padding: 0.12,
              minZoom: 0.012,
              maxZoom: 2.25,
              includeHiddenNodes: false,
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable
            panOnDrag
            zoomOnScroll
            zoomOnPinch
            zoomOnDoubleClick={false}
            panOnScroll={false}
            preventScrolling={false}
            selectionOnDrag={false}
            onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
            onNodeMouseLeave={() => setHoveredId(null)}
            onPaneClick={() => {
              setLockedPathSourceId(null);
              setHoveredId(null);
              setSelectedId(null);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
            onMoveEnd={(_evt, viewport) => {
              if (viewport.zoom < PATH_LOCK_CLEAR_ZOOM) {
                setLockedPathSourceId(null);
              }
            }}
            onNodeClick={(_, node) => {
              setLockedPathSourceId(node.id);
              setSelectedId(node.id);
              setNodes((nds) =>
                nds.map((n) => ({ ...n, selected: n.id === node.id }))
              );
              queueMicrotask(() => {
                rfRef.current?.fitView({
                  nodes: [{ id: node.id }],
                  padding: 0.5,
                  duration: 520,
                  maxZoom: 0.95,
                  minZoom: 0.03,
                });
              });
            }}
            onSelectionChange={({ nodes: sel }) => {
              setSelectedId(sel[0]?.id ?? null);
            }}
            colorMode="dark"
            minZoom={0.012}
            maxZoom={2.25}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              animated: false,
              style: { strokeWidth: 2.05, opacity: 0.8 },
            }}
            className="!bg-[#06080c]"
            onInit={(inst) => {
              rfRef.current = inst;
              const fitAll = () =>
                inst.fitView({
                  padding: 0.12,
                  duration: 0,
                  minZoom: 0.012,
                  maxZoom: 2.25,
                });
              queueMicrotask(() => {
                requestAnimationFrame(() => {
                  requestAnimationFrame(fitAll);
                });
              });
              window.setTimeout(fitAll, 200);
              if (nodes.length > 0) {
                window.requestAnimationFrame(() =>
                  inst.fitView({
                    padding: 0.38,
                    duration: 0,
                    maxZoom: 0.58,
                    minZoom: 0.03,
                  })
                );
              }
            }}
          >
            <Background
              color="#3a4558"
              gap={28}
              size={1.2}
              variant={BackgroundVariant.Dots}
              className="opacity-[0.5]"
            />
          </ReactFlow>
        )}

        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
          <div className="pointer-events-auto absolute left-3 top-3 flex flex-col gap-2">
            <div className="flex w-fit gap-1 rounded-xl border border-white/[0.08] bg-[#0b0d12]/90 p-1 shadow-lg backdrop-blur-md">
              <button
                type="button"
                onClick={() => setMainView('graph')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  mainView === 'graph'
                    ? 'bg-[#00E8FF] text-black shadow-[0_0_16px_rgba(0,232,255,0.25)]'
                    : 'text-zinc-500 hover:bg-white/[0.06] hover:text-white'
                }`}
                aria-pressed={mainView === 'graph'}
                aria-label="Graph view"
              >
                <Network size={15} strokeWidth={2.25} />
                Graph
              </button>
              <button
                type="button"
                onClick={() => setMainView('map')}
                className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  mainView === 'map'
                    ? 'bg-[#00E8FF] text-black shadow-[0_0_16px_rgba(0,232,255,0.25)]'
                    : 'text-zinc-500 hover:bg-white/[0.06] hover:text-white'
                }`}
                aria-pressed={mainView === 'map'}
                aria-label="Map view"
              >
                <MapIcon size={15} strokeWidth={2.25} />
                Map
              </button>
            </div>
            <TierLegend />
          </div>
          <div className="pointer-events-auto absolute bottom-7 left-1/2 w-[min(100vw-2rem,28rem)] -translate-x-1/2">
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.1] bg-[#0c1018]/95 px-4 py-2.5 shadow-[0_12px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl transition-shadow duration-300 focus-within:border-[#00E8FF]/30 focus-within:shadow-[0_0_0_1px_rgba(0,232,255,0.15)]">
              <Search className="shrink-0 text-zinc-500" size={18} strokeWidth={2} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(query);
                  }
                }}
                placeholder="Search company (Enter to discover upstream)…"
                className="min-w-0 flex-1 border-none bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
              />
              {isLoading && (
                <div className="flex items-center gap-1.5 px-2">
                  <div className="size-1.5 animate-bounce rounded-full bg-[#00E8FF] [animation-delay:-0.3s]"></div>
                  <div className="size-1.5 animate-bounce rounded-full bg-[#00E8FF] [animation-delay:-0.15s]"></div>
                  <div className="size-1.5 animate-bounce rounded-full bg-[#00E8FF]"></div>
                </div>
              )}
            </div>
            {error && (
              <div className="mt-2 rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-1.5 text-[10px] text-red-400 backdrop-blur-md">
                {error}
              </div>
            )}
          </div>
        </div>
      </main>

      <aside className="z-30 flex w-full max-w-[420px] shrink-0 flex-col border-l border-white/[0.06] bg-gradient-to-b from-[#090c12] to-[#06080c] shadow-[-16px_0_48px_rgba(0,0,0,0.5)] backdrop-blur-xl">
        <div className="flex h-[52px] shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
          <div className="flex flex-col">
            <span className="text-[9px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Trade entity
            </span>
            <span className="text-[11px] font-medium text-zinc-400">HSN-anchored graph</span>
          </div>
          {selectedId ? (
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
                setLockedPathSourceId(null);
                setHoveredId(null);
                setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
              }}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label="Close panel"
            >
              <X size={18} />
            </button>
          ) : null}
        </div>

        {selectedNode ? (
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            <div className="border-b border-white/[0.06] px-5 pb-5 pt-4">
              <div className="flex items-start gap-3">
                <div
                  className="mt-0.5 size-11 shrink-0 rounded-full border-2 border-white/[0.1]"
                  style={{
                    background: `radial-gradient(circle at 32% 28%, ${selectedNode.data.accentColor}, #0a0c10 72%)`,
                    boxShadow: `0 0 28px ${selectedNode.data.accentColor}50`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-[1.05rem] font-semibold leading-snug tracking-tight text-white">
                    {selectedNode.data.label}
                  </h2>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span
                      className="rounded-md px-2 py-0.5 font-mono text-[10px] font-medium text-[#00E8FF]"
                      style={{
                        background: `${selectedNode.data.accentColor}18`,
                        border: `1px solid ${selectedNode.data.accentColor}35`,
                      }}
                    >
                      Tier {selectedNode.data.tier}
                    </span>
                    <span className="max-w-full truncate text-xs text-zinc-500">
                      {TIER_LABELS[selectedNode.data.tier] ?? `Tier ${selectedNode.data.tier}`}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                {(
                  [
                    { id: 'learn' as const, label: 'Profile' },
                    { id: 'blend' as const, label: 'Risk' },
                    { id: 'explore' as const, label: 'Trace' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPanelTab(t.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200 ${
                      panelTab === t.id
                        ? 'bg-white text-black shadow-md'
                        : 'bg-white/[0.05] text-zinc-400 hover:bg-white/[0.1] hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-3 text-zinc-600">
                <BookOpen size={18} className="transition-colors hover:text-zinc-300" />
                <Video size={18} className="transition-colors hover:text-zinc-300" />
                <StickyNote size={18} className="transition-colors hover:text-zinc-300" />
                <MessageCircle size={18} className="transition-colors hover:text-zinc-300" />
              </div>
            </div>

            <div className="flex-1 space-y-5 px-5 py-5">
              <div
                className="aspect-[16/10] w-full overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-br from-zinc-800/80 via-[#0d1018] to-[#06080c]"
                style={{
                  boxShadow: `inset 0 0 0 1px ${selectedNode.data.accentColor}25`,
                }}
              />

              {panelTab === 'learn' && (
                <>
                  <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        <Globe2 size={12} /> Country
                      </dt>
                      <dd className="mt-1 text-sm font-medium text-zinc-100">
                        {selectedNode.data.country}
                      </dd>
                    </div>
                    <div className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
                      <dt className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                        <Hash size={12} /> HSN
                      </dt>
                      <dd className="mt-1 font-mono text-sm font-medium text-[#00E8FF]">
                        {selectedNode.data.hsnCode}
                      </dd>
                    </div>
                  </dl>
                  <section>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Commodity
                    </h3>
                    <p className="mt-1.5 text-sm font-medium leading-snug text-zinc-200">
                      {selectedNode.data.commodity}
                    </p>
                  </section>
                  <section>
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                      Trade note
                    </h3>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                      {selectedNode.data.about}
                    </p>
                  </section>
                </>
              )}

              {panelTab === 'blend' && (
                <section className="rounded-xl border border-amber-500/20 bg-amber-500/[0.06] p-4">
                  <h3 className="text-xs font-semibold text-amber-200/95">Risk & compliance (preview)</h3>
                  <p className="mt-2 text-sm leading-relaxed text-amber-100/70">
                    Aligns with project goals: sanctions / forced-labor flags, financial instability, and
                    concentration risk will layer here once compliance feeds are wired.
                  </p>
                  <p className="mt-3 text-xs text-amber-100/45">
                    Tier-{selectedNode.data.tier} entities often correlate with different disclosure quality in
                    open trade data — deeper tiers may be sparser.
                  </p>
                </section>
              )}

              {panelTab === 'explore' && (
                <section className="rounded-xl border border-cyan-500/20 bg-cyan-500/[0.06] p-4">
                  <h3 className="text-xs font-semibold text-cyan-100">Recursive trace (preview)</h3>
                  <p className="mt-2 text-sm leading-relaxed text-cyan-100/75">
                    From anchor <span className="font-medium text-white">{ANCHOR_HSN}</span> ({PRODUCT_ANCHOR}
                    ), traversal extends to Tier-{selectedNode.data.tier} for this node. Geospatial flows and BOM
                    pruning will attach here per architecture notes.
                  </p>
                </section>
              )}

              <section className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Graph context
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-500">
                  Anchor company{' '}
                  <span className="font-semibold text-zinc-300">{ANCHOR_COMPANY_NAME}</span> (Tier 0).{' '}
                  {selectedNode.data.parentLabel ? (
                    <>
                      Immediate trade context: under{' '}
                      <span className="text-zinc-400">{selectedNode.data.parentLabel}</span>.
                    </>
                  ) : null}{' '}
                  Hover nodes to highlight paths to the anchor and toward terminal Tier-6 inputs.
                </p>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Linked entities
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {connectedLabels.length === 0 ? (
                    <span className="text-xs text-zinc-600">Leaf or isolated in this view.</span>
                  ) : (
                    connectedLabels.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => focusNeighbor(c.id)}
                        className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-left text-xs font-medium text-zinc-200 transition-all duration-200 hover:border-[#00E8FF]/35 hover:bg-[#00E8FF]/10"
                      >
                        <span
                          className="mr-2 inline-block size-1.5 rounded-full align-middle"
                          style={{ background: c.color }}
                        />
                        <span className="line-clamp-1">{c.label}</span>
                        <span className="ml-1.5 font-mono text-[10px] text-zinc-500">T{c.tier}</span>
                      </button>
                    ))
                  )}
                </div>
              </section>
            </div>
          </div>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
            <div className="rounded-full border border-white/[0.08] bg-white/[0.03] p-4">
              <Search className="text-zinc-500" size={22} />
            </div>
            <p className="text-sm font-medium text-zinc-400">Select a node</p>
            <p className="max-w-[280px] text-xs leading-relaxed text-zinc-600">
              Open trade reconstruction from{' '}
              {nodes.find((n) => n.id === activeRootId)?.data.label ?? ANCHOR_COMPANY_NAME} — Tier 0 through
              Tier 6. Hover for upstream / downstream path highlight.
            </p>
          </div>
        )}
      </aside>
    </div>
  );
}

export function KnowledgeBrain() {
  return (
    <ReactFlowProvider>
      <BirdsEyesFlow />
    </ReactFlowProvider>
  );
}
