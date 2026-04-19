'use client';

import dynamic from 'next/dynamic';
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
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
import Link from 'next/link';
import { Map as MapIcon, Network, Search, User, X } from 'lucide-react';
import '@xyflow/react/dist/style.css';
import {
  ANCHOR_COMPANY_NAME,
  buildSupplyChainGraph,
  PRODUCT_ANCHOR,
  tierAccent,
  type SupplyNodeData,
  transformBackendDataToGraph,
} from './supply-chain-data';

const SupplyChainMapView = dynamic(() => import('./SupplyChainMapView'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-[#06080c] text-sm text-zinc-500">
      Loading map…
    </div>
  ),
});

/** @deprecated Use ANCHOR_COMPANY_NAME — kept for imports expecting this name */
export const KNOWLEDGE_GRAPH_ROOT_NAME = ANCHOR_COMPANY_NAME;
export type KnowledgeNodeData = SupplyNodeData;

const CYAN = '#00E8FF';

/** Zooming out past this clears locked path focus (see onMoveEnd). */
const PATH_LOCK_CLEAR_ZOOM = 0.32;

type KnowledgeFlowNode = Node<SupplyNodeData, 'knowledge'>;

const KnowledgeNode = memo(function KnowledgeNode({
  id,
  data,
  selected,
}: NodeProps<KnowledgeFlowNode>) {
  const accent = data.accentColor || CYAN;
  const t = data.tier;
  const size =
    t === 0 ? 'size-[92px]' : t <= 2 ? 'size-[72px]' : t <= 4 ? 'size-[64px]' : 'size-[52px]';
  const ring =
    t === 0
      ? 'ring-[3.5px] ring-[#00E8FF]/45 ring-offset-[3px] ring-offset-white dark:ring-offset-[#06080c]'
      : '';
  const pathGlow = data.pathHighlight;

  const haloOuter =
    pathGlow ? 0.92 : selected ? 0.52 : 0.34;
  const haloInner =
    pathGlow ? 0.72 : selected ? 0.38 : 0.22;

  return (
    <div className="group flex max-w-[240px] flex-col items-center gap-2">
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-0 !bg-transparent !opacity-0"
      />
      <div className="relative flex flex-col items-center overflow-visible">
        {/* Wide ambient halo — always visible so tiers read as luminous */}
        <div
          className="pointer-events-none absolute -inset-14 scale-125 rounded-full blur-[48px] transition-opacity duration-300 ease-out motion-safe:group-hover:opacity-90"
          style={{
            background: `radial-gradient(circle at 50% 45%, ${accent} 0%, transparent 68%)`,
            opacity: haloOuter,
          }}
        />
        <div
          className="pointer-events-none absolute -inset-6 rounded-full blur-[32px] transition-opacity duration-300 ease-out motion-safe:group-hover:opacity-80"
          style={{
            background: accent,
            opacity: haloInner,
          }}
        />
        <div
          className={`relative flex ${size} shrink-0 items-center justify-center rounded-full border-[3px] bg-gradient-to-b from-zinc-100 to-zinc-200/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] transition-all duration-300 ease-out motion-safe:group-hover:scale-[1.02] dark:from-[#181d28] dark:to-[#080a0e] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${ring}`}
          style={{
            borderColor: pathGlow ? accent : selected ? accent : 'rgba(255,255,255,0.16)',
            boxShadow: pathGlow
              ? `0 0 48px ${accent}aa, 0 0 18px ${accent}66, inset 0 0 28px ${accent}22`
              : selected
                ? `0 0 36px ${accent}77, 0 0 14px ${accent}44, inset 0 0 20px ${accent}18`
                : `0 0 28px ${accent}40, 0 6px 28px rgba(0,0,0,0.55)`,
          }}
        >
          <div
            className={`rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.95)] ${
              t === 0 ? 'size-4' : t <= 2 ? 'size-3.5' : 'size-3'
            }`}
          />
        </div>
      </div>
      <span className="line-clamp-2 w-full select-none text-center text-[16px] font-bold leading-snug tracking-tight text-white [text-shadow:0_1px_4px_rgba(0,0,0,0.8)] dark:[text-shadow:0_2px_16px_rgba(0,0,0,0.95)]">
        {data.label}
      </span>
      <span className="font-mono text-[13px] font-medium leading-none tracking-tight text-zinc-400 dark:text-zinc-300">
        {data.hsnCode}
      </span>
      {selected && !data.isRoot && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            data.onExpand?.(id, data.label);
          }}
          className="pointer-events-auto mt-2 flex items-center gap-1 rounded-full border border-[#00E8FF]/30 bg-[#00E8FF]/10 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[#00E8FF] transition-all hover:bg-[#00E8FF]/20 active:scale-95"
        >
          <Network size={10} />
          Expand
        </button>
      )}
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
  return code.replace(/\D/g, '');
}

function hsnPrefix4(code: string): string {
  return normalizeHsn(code).slice(0, 4);
}

function edgeHsnPrefix4(edge: Edge): string {
  const raw = String((edge as { data?: { hsnCode?: string } }).data?.hsnCode ?? '');
  return hsnPrefix4(raw);
}

/** Highlight anchor-root branches whose Tier-0 outgoing edge HSN matches selected product HSN. */
function computeProductSupplyHighlight(
  productHsnNormalized: string | null,
  rootId: string,
  edges: Edge[]
): PathHighlight | null {
  if (!productHsnNormalized) return null;
  const { children } = buildParentChildMaps(edges);
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const selectedPrefix = hsnPrefix4(productHsnNormalized);

  const rootMatchingEdges = edges.filter(
    (e) => String(e.source) === rootId && edgeHsnPrefix4(e) === selectedPrefix
  );
  const seedIds = rootMatchingEdges.map((e) => String(e.target));
  if (seedIds.length === 0) return { edgeIds: new Set(), nodeIds: new Set() };

  nodeIds.add(rootId);
  for (const e of rootMatchingEdges) edgeIds.add(e.id);

  for (const seed of seedIds) {
    nodeIds.add(seed);
    const stack = [...(children.get(seed) ?? [])];
    while (stack.length) {
      const u = stack.pop()!;
      nodeIds.add(u);
      const parentEdge = edges.find((e) => String(e.target) === u);
      if (parentEdge) edgeIds.add(parentEdge.id);
      for (const v of children.get(u) ?? []) stack.push(v);
    }
  }

  return { edgeIds, nodeIds };
}

const { nodes: seedNodes, edges: seedEdges, rootId: SEED_ROOT_ID } =
  buildSupplyChainGraph();

/** Stagger tier reveal so each depth fades in slowly from the root outward. */
const TIER_REVEAL_INITIAL_MS = 420;
const TIER_REVEAL_STEP_MS = 520;

/** Fit/zoom tuned by graph size: small graphs fill the viewport; large graphs zoom out farther. */
function getGraphViewOptions(nodeCount: number): {
  padding: number;
  minZoom: number;
  maxZoom: number;
} {
  const n = Math.max(1, nodeCount);
  const padding = Math.min(0.48, 0.1 + Math.min(n * 0.017, 0.34));
  const minZoom = Math.max(0.0035, Math.min(0.055, 0.045 - n * 0.00028));
  const maxZoom = Math.min(3.2, 1.28 + Math.min(n * 0.03, 1.45));
  return { padding, minZoom, maxZoom };
}

function BirdsEyesFlow({ initialQuery }: { initialQuery?: string }) {
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
  const [rootHsnOptions, setRootHsnOptions] = useState<string[]>([]);
  const rfRef = useRef<ReactFlowInstance<KnowledgeFlowNode, Edge> | null>(null);

  /** Sidebar + product scope: selected node, or graph root after clearing selection. */
  const overviewCompanyId = selectedId ?? activeRootId;

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

  const viewOpts = useMemo(() => getGraphViewOptions(nodes.length), [nodes.length]);

  const handleSearch = useCallback(async (searchTerm: string) => {
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
      const {
        nodes: newNodes,
        edges: newEdges,
        rootId: newRootId,
        hsnOptions,
      } = transformBackendDataToGraph(data);
      const opts = getGraphViewOptions(newNodes.length);
      setNodes(newNodes);
      setEdges(newEdges);
      setActiveRootId(newRootId);
      setSelectedId(newRootId);
      setQuery('');
      setLockedPathSourceId(null);
      setHoveredId(null);
      setSelectedProductHsn(null);
      setRootHsnOptions(hsnOptions);

      setTimeout(() => {
        rfRef.current?.fitView({
          padding: opts.padding,
          duration: 800,
          minZoom: opts.minZoom,
          maxZoom: opts.maxZoom,
        });
      }, 120);
    } catch (err: unknown) {
      console.error(err);
      const message = err instanceof Error ? err.message : 'An unexpected error occurred';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleExpandNode = useCallback(async (nodeId: string, companyName: string) => {
    setIsLoading(true);
    try {
      const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
      const childCount = edges.filter(e => e.source === nodeId).length;
      const start = childCount;
      const end = start + 5;

      const response = await fetch(`${baseUrl}/company/${encodeURIComponent(companyName)}/suppliers?start=${start}&end=${end}`);
      if (!response.ok) throw new Error('Failed to fetch suppliers');
      
      const data = await response.json();
      const { nodes: newNodes, edges: newEdges } = transformBackendDataToGraph(data);

      const parentNode = nodes.find(n => n.id === nodeId);
      if (!parentNode) return;

      const parentTier = parentNode.data.tier;
      
      // Filter out root from incoming and adjust tiers/ids for the rest
      const filteredNodes = newNodes
        .filter(n => n.id !== companyName) // Backend uses company name as ID
        .map((n, idx, arr) => {
          // Explicit hierarchical positioning: centered below parent
          const TIER_GAP_Y = 340;
          const X_SCALE = 260;
          const totalWidth = (arr.length - 1) * X_SCALE;
          const startX = parentNode.position.x - totalWidth / 2;
          const x = startX + idx * X_SCALE;
          const y = parentNode.position.y + TIER_GAP_Y;

          return {
            ...n,
            id: `${nodeId}-${n.id}`, 
            position: { x, y },
            data: {
              ...n.data,
              tier: parentTier + 1,
              accentColor: tierAccent(parentTier + 1)
            }
          };
        });

      const filteredEdges = newEdges
        .filter(e => e.source === companyName) // Only take edges from the "expansion root"
        .map(e => ({
          ...e,
          id: `e-${nodeId}-${nodeId}-${e.target}`,
          source: nodeId,
          target: `${nodeId}-${e.target}`,
          style: { ...e.style, stroke: tierAccent(parentTier + 1) }
        }));

      if (filteredNodes.length === 0) {
        setError("No more suppliers found.");
        return;
      }

      setNodes(nds => [...nds, ...filteredNodes]);
      setEdges(eds => [...eds, ...filteredEdges]);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [nodes, edges, setNodes, setEdges]);

  const initialFetchDone = useRef<string | null>(null);
  useEffect(() => {
    const q = initialQuery?.trim();
    if (!q) return;
    if (initialFetchDone.current === q) return;
    initialFetchDone.current = q;
    void handleSearch(q);
  }, [initialQuery, handleSearch]);

  /** Topology-only key so selection/hover does not restart tier reveal. */
  const graphRevealKey = useMemo(() => {
    const sig = edges
      .map((e) => `${e.source}>${e.target}`)
      .sort()
      .join('|');
    return `${activeRootId}:${sig}`;
  }, [activeRootId, edges]);

  const [revealMaxTier, setRevealMaxTier] = useState(-1);
  const revealTimersRef = useRef<number[]>([]);
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  useEffect(() => {
    for (const id of revealTimersRef.current) window.clearTimeout(id);
    revealTimersRef.current = [];

    const nds = nodesRef.current;
    let maxTier = 0;
    for (const n of nds) maxTier = Math.max(maxTier, n.data.tier);
    if (nds.length === 0) {
      setRevealMaxTier(0);
      return;
    }

    setRevealMaxTier(-1);
    for (let t = 0; t <= maxTier; t++) {
      const tid = window.setTimeout(
        () => setRevealMaxTier(t),
        TIER_REVEAL_INITIAL_MS + t * TIER_REVEAL_STEP_MS
      );
      revealTimersRef.current.push(tid);
    }

    return () => {
      for (const id of revealTimersRef.current) window.clearTimeout(id);
      revealTimersRef.current = [];
    };
  }, [graphRevealKey]);

  const pathHighlightSourceId = lockedPathSourceId ?? hoveredId;

  const nodePathHighlight = useMemo(
    () => computePathHighlight(pathHighlightSourceId, activeRootId, edges),
    [pathHighlightSourceId, activeRootId, edges]
  );

  const productPathHighlight = useMemo(
    () => computeProductSupplyHighlight(selectedProductHsn, activeRootId, edges),
    [selectedProductHsn, activeRootId, edges]
  );

  const pathHighlight = selectedProductHsn ? productPathHighlight : nodePathHighlight;

  const productRows = useMemo(
    () => {
      const nodeById = new Map(nodes.map((n) => [String(n.id), n]));
      const map = new Map<
        string,
        {
          key: string;
          hsnDisplay: string;
          hsnNormalized: string;
          category: string;
          nodeCount: number;
        }
      >();
      for (const raw of rootHsnOptions) {
        const norm = normalizeHsn(raw);
        if (!norm || map.has(norm)) continue;
        const prefix = hsnPrefix4(norm);
        const rootEdgesForHsn = edges.filter(
          (e) => String(e.source) === activeRootId && edgeHsnPrefix4(e) === prefix
        );
        if (rootEdgesForHsn.length === 0) continue;

        const commodities = rootEdgesForHsn
          .map((e) => nodeById.get(String(e.target))?.data.commodity ?? '')
          .filter((x) => x && x !== 'N/A');
        const uniqueCommodities = [...new Set(commodities)];
        const category =
          uniqueCommodities.length > 0
            ? uniqueCommodities.slice(0, 2).join(' | ')
            : 'Mapped product category';

        map.set(norm, {
          key: norm,
          hsnDisplay: raw,
          hsnNormalized: norm,
          category,
          nodeCount: rootEdgesForHsn.length,
        });
      }
      return [...map.values()];
    },
    [rootHsnOptions, edges, nodes, activeRootId]
  );

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
      if (d.tier > revealMaxTier) opacity = 0;
      const node: KnowledgeFlowNode = {
        ...n,
        type: 'knowledge',
        data: {
          ...n.data,
          pathHighlight: pathHighlightOn,
          onExpand: handleExpandNode,
        },
        style: { ...n.style, opacity },
      };
      return node;
    });
  }, [nodes, query, pathHighlight, lockedPathSourceId, selectedProductHsn, revealMaxTier, handleExpandNode]);

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
      let opacity = active ? (highlighted ? 1 : 0.18) : 0.82;
      if (targetTier > revealMaxTier) opacity = 0;
      return {
        ...e,
        animated: highlighted,
        style: {
          ...e.style,
          stroke: tierStroke,
          strokeWidth: highlighted ? 4.5 : dimmed ? 1.5 : 2.8,
          opacity,
          filter: dimmed ? undefined : edgeGlowFilter(tierStroke),
        },
      };
    });
  }, [
    edges,
    pathHighlightSourceId,
    selectedProductHsn,
    pathHighlight,
    tierByNodeId,
    revealMaxTier,
  ]);

  useEffect(() => {
    if (mainView !== 'graph') return;
    let cancelled = false;
    let attempts = 0;
    const tryFit = () => {
      if (cancelled || attempts++ > 40) return;
      const inst = rfRef.current;
      if (inst) {
        inst.fitView({
          padding: viewOpts.padding,
          duration: 280,
          minZoom: viewOpts.minZoom,
          maxZoom: viewOpts.maxZoom,
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
  }, [mainView, viewOpts.padding, viewOpts.minZoom, viewOpts.maxZoom]);

  return (
    <div className="relative flex h-screen w-full overflow-hidden bg-[#06080c] font-sans text-white">
      <Link
        href="/user-dashboard"
        className="pointer-events-auto absolute right-4 top-4 z-[60] flex items-center gap-2 rounded-xl border border-white/15 bg-[#0b0f18]/92 px-3.5 py-2 text-[13px] font-medium text-zinc-100 shadow-[0_8px_32px_rgba(0,0,0,0.45)] backdrop-blur-md transition hover:border-[#00E8FF]/35 hover:bg-[#00E8FF]/10 hover:text-white"
      >
        <User className="size-[18px] text-[#00E8FF]" strokeWidth={2} aria-hidden />
        Profile
      </Link>

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
              padding: viewOpts.padding,
              minZoom: viewOpts.minZoom,
              maxZoom: viewOpts.maxZoom,
              includeHiddenNodes: false,
            }}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            nodesDraggable
            nodesConnectable={false}
            nodesFocusable
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
                  padding: Math.min(0.68, viewOpts.padding + 0.24),
                  duration: 520,
                  maxZoom: Math.min(viewOpts.maxZoom * 0.3, 0.82),
                  minZoom: viewOpts.minZoom,
                });
              });
            }}
            onSelectionChange={({ nodes: sel }) => {
              setSelectedId(sel[0]?.id ?? null);
            }}
            colorMode="dark"
            minZoom={viewOpts.minZoom}
            maxZoom={viewOpts.maxZoom}
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'straight',
              animated: false,
              style: { strokeWidth: 2.8, opacity: 0.8 },
            }}
            className="!bg-[#06080c]"
            onInit={(inst) => {
              rfRef.current = inst;
              const vo = getGraphViewOptions(seedNodes.length);
              const fitAll = () =>
                inst.fitView({
                  padding: vo.padding,
                  duration: 0,
                  minZoom: vo.minZoom,
                  maxZoom: vo.maxZoom,
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
              color="#8ea3c8"
              gap={44}
              size={3.8}
              variant={BackgroundVariant.Dots}
              className="opacity-[0.98]"
            />
          </ReactFlow>
        )}

        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col">
          <div className="pointer-events-auto absolute left-3 top-3 flex items-center gap-2">
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
                placeholder="Filter nodes by name, country, HSN, commodity…"
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

      <aside className="font-sans z-30 mt-[20vh] flex h-[calc(100vh-20vh)] min-h-0 w-full max-w-[min(100vw,28rem)] shrink-0 flex-col border-l border-white/10 bg-[linear-gradient(165deg,rgba(12,16,24,0.97)_0%,rgba(6,8,12,0.99)_45%,#05070a_100%)] shadow-[-20px_0_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-6 py-5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Company overview
            </p>
            <div className="mt-2 h-px w-12 rounded-full bg-gradient-to-r from-[#00E8FF]/80 to-transparent" />
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedId(null);
              setLockedPathSourceId(null);
              setHoveredId(null);
              setSelectedProductHsn(null);
              setNodes((nds) => nds.map((n) => ({ ...n, selected: false })));
            }}
            className="shrink-0 rounded-xl border border-white/10 bg-white/[0.04] p-2.5 text-zinc-400 transition-colors hover:border-[#00E8FF]/25 hover:bg-[#00E8FF]/10 hover:text-white"
            aria-label="Clear graph selection"
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-6 py-6">
          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Name & description
            </p>
            <h2 className="font-melodrama mt-3 text-[1.35rem] font-medium leading-tight tracking-tight text-white">
              {overviewNode?.data.label ?? ANCHOR_COMPANY_NAME}
            </h2>
            <p className="mt-3 font-sans text-[15px] font-normal leading-relaxed text-zinc-400">
              {overviewNode?.data.about ??
                `${PRODUCT_ANCHOR} — reconstructed from customs-scale trade slices and BOM-aware pruning.`}
            </p>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Primary client
            </h3>
            <p className="mt-3 font-sans text-[15px] font-normal leading-relaxed text-zinc-300">
              {parentCompanyName ??
                'Downstream OEM and fleet operators (illustrative end demand for assembled products).'}
            </p>
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <h3 className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Suppliers
            </h3>
            {tierOneSuppliers.length === 0 ? (
              <p className="mt-3 font-sans text-[15px] text-zinc-500">No direct suppliers in this graph.</p>
            ) : (
              <ul className="mt-3 list-inside list-disc space-y-2 font-sans text-[15px] leading-relaxed text-zinc-300 marker:text-[#00E8FF]/80">
                {tierOneSuppliers.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
            <div className="space-y-1">
              <h3 className="font-melodrama text-lg font-medium tracking-tight text-white">Products</h3>
              <p className="font-sans text-[13px] font-normal leading-snug text-zinc-500">
                Tier-0 HSN options from the API — select to highlight branches on the graph or map.
              </p>
            </div>
            <ul className="mt-4 flex flex-col gap-2.5">
              {productRows.length === 0 ? (
                <li className="font-sans text-[14px] leading-relaxed text-zinc-500">
                  No HSN options yet. Open the dashboard with{' '}
                  <span className="font-medium text-zinc-400">?q=CompanyName</span> to load tier-0 products.
                </li>
              ) : (
                productRows.map((row) => {
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
                          queueMicrotask(() =>
                            rfRef.current?.fitView({
                              padding: Math.max(0.12, viewOpts.padding * 0.85),
                              duration: 480,
                              minZoom: viewOpts.minZoom,
                              maxZoom: viewOpts.maxZoom,
                            })
                          );
                        }}
                        className={`flex w-full flex-col gap-1 rounded-xl border px-4 py-3.5 text-left transition-all ${
                          active
                            ? 'border-[#00E8FF]/45 bg-[#00E8FF]/10 shadow-[0_0_32px_-10px_rgba(0,232,255,0.45)]'
                            : 'border-white/10 bg-black/20 hover:border-[#00E8FF]/20 hover:bg-white/[0.05]'
                        }`}
                      >
                        <span className="font-mono text-[13px] font-semibold text-[#00E8FF]">
                          {row.hsnDisplay}
                        </span>
                        <span className="font-sans text-[14px] font-normal leading-snug text-zinc-300">
                          {row.category}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </section>

          <section className="rounded-2xl border border-dashed border-white/15 bg-black/25 px-4 py-3.5">
            <p className="font-sans text-[12px] font-normal italic leading-relaxed text-zinc-500">
              Tip: Click a node on the graph or map to inspect it. Click empty canvas to clear selection. Zoom out to
              release path focus.
            </p>
          </section>
        </div>
      </aside>
    </div>
  );
}

export function KnowledgeBrain({
  initialQuery,
}: {
  initialQuery?: string | null;
} = {}) {
  return (
    <ReactFlowProvider>
      <BirdsEyesFlow initialQuery={initialQuery ?? undefined} />
    </ReactFlowProvider>
  );
}
