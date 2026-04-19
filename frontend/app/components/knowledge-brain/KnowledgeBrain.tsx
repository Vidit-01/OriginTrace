'use client';

import dynamic from 'next/dynamic';
import React, { memo, useEffect, useMemo, useRef, useState } from 'react';
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
import { Map as MapIcon, Network, Search, X } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import {
  ANCHOR_COMPANY_NAME,
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

type KnowledgeFlowNode = Node<SupplyNodeData, 'knowledge'>;

const KnowledgeNode = memo(function KnowledgeNode({
  data,
  selected,
}: NodeProps<KnowledgeFlowNode>) {
  const accent = data.accentColor || CYAN;
  const t = data.tier;
  const size =
    t === 0 ? 'size-[58px]' : t <= 2 ? 'size-12' : t <= 4 ? 'size-11' : 'size-[38px]';
  const ring =
    t === 0
      ? 'ring-2 ring-[#00E8FF]/45 ring-offset-2 ring-offset-white dark:ring-offset-[#06080c]'
      : '';
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
          className={`relative flex ${size} shrink-0 items-center justify-center rounded-full border-[2.5px] bg-gradient-to-b from-zinc-100 to-zinc-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 ease-out motion-safe:group-hover:scale-[1.03] dark:from-[#181d28] dark:to-[#080a0e] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${ring}`}
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
      <span className="line-clamp-2 w-full select-none text-center text-[13px] font-semibold leading-snug tracking-tight text-zinc-900 [text-shadow:0_1px_2px_rgba(255,255,255,0.8)] dark:text-zinc-50 dark:[text-shadow:0_1px_12px_rgba(0,0,0,0.92),0_0_18px_rgba(0,0,0,0.55)]">
        {data.label}
      </span>
      <span className="font-mono text-[10px] leading-none tracking-tight text-zinc-600 dark:text-zinc-300 dark:[text-shadow:0_1px_8px_rgba(0,0,0,0.85)]">
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

function normalizeHsn(code: string): string {
  return code.replace(/\s+/g, '').trim();
}

/** All node ids in the subtree rooted at `focusId` (includes that node). */
function collectSubtreeNodeIds(focusId: string, edges: Edge[]): Set<string> {
  const children = new Map<string, string[]>();
  for (const e of edges) {
    const s = String(e.source);
    const t = String(e.target);
    if (!children.has(s)) children.set(s, []);
    children.get(s)!.push(t);
  }
  for (const arr of children.values()) arr.sort((a, b) => a.localeCompare(b));
  const ids = new Set<string>();
  const stack = [focusId];
  while (stack.length) {
    const u = stack.pop()!;
    ids.add(u);
    for (const v of children.get(u) ?? []) stack.push(v);
  }
  return ids;
}

/**
 * Paths for an HSN scoped to the subtree rooted at `focusId` (clicked company):
 * upstream to that node, downstream only within its subtree.
 */
function computeProductSupplyHighlight(
  productHsnNormalized: string | null,
  nodes: Node<SupplyNodeData>[],
  focusId: string,
  edges: Edge[]
): PathHighlight | null {
  if (!productHsnNormalized) return null;
  const { parent, children } = buildParentChildMaps(edges);
  const subtreeIds = collectSubtreeNodeIds(focusId, edges);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  const seedIds = nodes
    .filter(
      (n) =>
        subtreeIds.has(n.id) && normalizeHsn(n.data.hsnCode) === productHsnNormalized
    )
    .map((n) => n.id);

  if (seedIds.length === 0) return { edgeIds: new Set(), nodeIds: new Set() };

  const addEdge = (s: string, t: string) => {
    const edge = edges.find((e) => e.source === s && e.target === t);
    if (edge) edgeIds.add(edge.id);
  };

  for (const seed of seedIds) {
    let cur = seed;
    nodeIds.add(cur);
    while (cur !== focusId) {
      const p = parent.get(cur);
      if (!p) break;
      addEdge(p, cur);
      nodeIds.add(p);
      cur = p;
    }

    const stack = [...(children.get(seed) ?? [])];
    while (stack.length) {
      const u = stack.pop()!;
      if (!subtreeIds.has(u)) continue;
      nodeIds.add(u);
      const p = parent.get(u);
      if (p !== undefined) addEdge(p, u);
      for (const v of children.get(u) ?? []) {
        if (subtreeIds.has(v)) stack.push(v);
      }
    }
  }

  return { edgeIds, nodeIds };
}

const { nodes: seedNodes, edges: seedEdges, rootId: SEED_ROOT_ID } =
  buildSupplyChainGraph();

function BirdsEyesFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(seedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seedEdges);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(SEED_ROOT_ID);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  /** Click-locked path source: keeps highlight after pointer leaves node; cleared on pane / zoom-out / other actions. */
  const [lockedPathSourceId, setLockedPathSourceId] = useState<string | null>(null);
  const [mainView, setMainView] = useState<'graph' | 'map'>('graph');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeRootId, setActiveRootId] = useState<string>(SEED_ROOT_ID);
  /** Normalized HSN — highlights every route in the tree tied to that code. */
  const [selectedProductHsn, setSelectedProductHsn] = useState<string | null>(null);
  const rfRef = useRef<ReactFlowInstance<KnowledgeFlowNode, Edge> | null>(null);

  /** Sidebar + product scope: selected node, or graph root after clearing selection. */
  const overviewCompanyId = selectedId ?? activeRootId;

  const overviewSubtreeIds = useMemo(
    () => collectSubtreeNodeIds(overviewCompanyId, edges),
    [overviewCompanyId, edges]
  );

  const overviewNode = useMemo(
    () => nodes.find((n) => n.id === overviewCompanyId) ?? null,
    [nodes, overviewCompanyId]
  );

  const parentCompanyId = useMemo(() => {
    const { parent } = buildParentChildMaps(edges);
    return parent.get(overviewCompanyId) ?? null;
  }, [edges, overviewCompanyId]);

  const parentCompanyName = useMemo(() => {
    if (!parentCompanyId) return null;
    return nodes.find((n) => n.id === parentCompanyId)?.data.label ?? null;
  }, [nodes, parentCompanyId]);

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
      setSelectedProductHsn(null);
      
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

  const nodePathHighlight = useMemo(
    () => computePathHighlight(pathHighlightSourceId, activeRootId, edges),
    [pathHighlightSourceId, activeRootId, edges]
  );

  const productPathHighlight = useMemo(
    () => computeProductSupplyHighlight(selectedProductHsn, nodes, overviewCompanyId, edges),
    [selectedProductHsn, nodes, overviewCompanyId, edges]
  );

  const pathHighlight = selectedProductHsn ? productPathHighlight : nodePathHighlight;

  const productRows = useMemo(() => {
    const map = new Map<
      string,
      { key: string; hsnDisplay: string; commodity: string; hsnNormalized: string }
    >();
    for (const n of nodes) {
      if (!overviewSubtreeIds.has(n.id)) continue;
      const raw = n.data.hsnCode?.trim() ?? '';
      if (!raw) continue;
      const hsnNormalized = normalizeHsn(raw);
      const key = `${hsnNormalized}|${n.data.commodity}`;
      if (!map.has(key))
        map.set(key, {
          key,
          hsnDisplay: raw,
          commodity: n.data.commodity,
          hsnNormalized,
        });
    }
    return [...map.values()].sort((a, b) => a.hsnDisplay.localeCompare(b.hsnDisplay));
  }, [nodes, overviewSubtreeIds]);

  const tierOneSuppliers = useMemo(() => {
    const ids = edges.filter((e) => e.source === overviewCompanyId).map((e) => String(e.target));
    const labels = ids
      .map((id) => nodes.find((n) => n.id === id))
      .filter((n): n is Node<SupplyNodeData> => !!n)
      .map((n) => n.data.label);
    return [...new Set(labels)];
  }, [edges, nodes, overviewCompanyId]);

  const tierByNodeId = useMemo(() => {
    const m = new Map<string, number>();
    for (const n of nodes) m.set(n.id, n.data.tier);
    return m;
  }, [nodes]);

  const displayNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const glow = pathHighlight?.nodeIds;
    const focusLock = lockedPathSourceId !== null || selectedProductHsn !== null;
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
  }, [nodes, query, pathHighlight, lockedPathSourceId, selectedProductHsn]);

  const displayEdges = useMemo(() => {
    const hi = pathHighlight?.edgeIds;
    const highlightDriving =
      selectedProductHsn !== null ? true : !!pathHighlightSourceId;
    const active = highlightDriving && hi;
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
  }, [edges, pathHighlightSourceId, selectedProductHsn, pathHighlight, tierByNodeId]);

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

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#06080c] font-sans text-white">
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
              setSelectedProductHsn(null);
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
              setSelectedProductHsn(null);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
            onMoveEnd={(_evt, viewport) => {
              if (viewport.zoom < PATH_LOCK_CLEAR_ZOOM) {
                setLockedPathSourceId(null);
                setSelectedProductHsn(null);
              }
            }}
            onNodeClick={(_, node) => {
              setSelectedProductHsn(null);
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
              type: 'straight',
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
            }}
          >
            <Background
              color="#5c6b8a"
              gap={22}
              size={1.35}
              variant={BackgroundVariant.Dots}
              className="opacity-90"
            />
          </ReactFlow>
        )}

        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
          <div className="pointer-events-auto absolute right-3 top-3 flex items-center gap-2">
            <div className="flex w-fit gap-0.5 rounded-xl border border-white/[0.08] bg-[#0b0d12]/90 p-1 shadow-lg backdrop-blur-md">
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

      <aside className="z-30 flex w-full max-w-[min(100vw,26rem)] shrink-0 flex-col border-l border-white/[0.06] bg-gradient-to-b from-[#090c12] to-[#06080c] shadow-[-16px_0_48px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <span className="sy-type-caption text-zinc-300">
            Company overview
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setLockedPathSourceId(null);
              setHoveredId(null);
              setSelectedProductHsn(null);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
            className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-white"
            aria-label="Clear graph selection"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-8 overflow-y-auto px-5 py-6">
          <section className="space-y-3 border-b border-white/[0.06] pb-6">
            <p className="sy-type-caption text-zinc-500">Name & description</p>
            <h2 className="sy-type-title-lg text-white">
              {overviewNode?.data.label ?? ANCHOR_COMPANY_NAME}
            </h2>
            <p className="sy-type-body text-zinc-400">
              {overviewNode?.data.about ??
                `${PRODUCT_ANCHOR} — reconstructed from customs-scale trade slices and BOM-aware pruning.`}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="sy-type-ui font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Primary client
            </h3>
            <p className="sy-type-body text-zinc-300">
              {parentCompanyName ??
                'Downstream OEM and fleet operators (illustrative end demand for assembled products).'}
            </p>
          </section>

          <section className="space-y-2">
            <h3 className="sy-type-ui font-semibold uppercase tracking-[0.12em] text-zinc-500">
              Suppliers
            </h3>
            {tierOneSuppliers.length === 0 ? (
              <p className="sy-type-body text-zinc-500">No direct suppliers in this graph.</p>
            ) : (
              <ul className="sy-type-body list-inside list-disc space-y-1.5 text-zinc-300 marker:text-[#00a8cc]">
                {tierOneSuppliers.map((name) => (
                  <li key={name} className="leading-relaxed">
                    {name}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="space-y-4">
            <div>
              <h3 className="sy-type-title text-white">Products</h3>
              <p className="sy-type-caption mt-1 text-zinc-500">
                HSNs in this company’s branch—select one to highlight routes scoped to this subtree (graph &
                map).
              </p>
            </div>
            <ul className="flex flex-col gap-2">
              {productRows.map((row) => {
                const active = selectedProductHsn === row.hsnNormalized;
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      onClick={() => {
                        setLockedPathSourceId(null);
                        setHoveredId(null);
                        setSelectedProductHsn((prev) =>
                          prev === row.hsnNormalized ? null : row.hsnNormalized
                        );
                        queueMicrotask(() => rfRef.current?.fitView({ padding: 0.14, duration: 480 }));
                      }}
                      className={`flex w-full flex-col gap-0.5 rounded-xl border px-3.5 py-3 text-left transition-all ${
                        active
                          ? 'border-[#00E8FF]/40 bg-[#00E8FF]/12 shadow-[0_0_24px_-8px_rgba(0,232,255,0.55)]'
                          : 'border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className="font-mono sy-type-ui font-semibold text-[#00E8FF]">
                        {row.hsnDisplay}
                      </span>
                      <span className="sy-type-body leading-snug text-zinc-300">
                        {row.commodity}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </section>

          <section className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
            <p className="sy-type-caption leading-relaxed text-zinc-500">
              Tip: Click a company on the graph or map to refresh this panel. Click the canvas to clear selection
              and return the overview to the anchor. Zoom far out to release node focus.
            </p>
          </section>
        </div>
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
