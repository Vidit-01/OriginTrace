'use client';

import React, { useCallback, useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Handle,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
  useEdgesState,
  useNodesState,
} from '@xyflow/react';
import {
  BookOpen,
  Layers,
  MessageCircle,
  Search,
  Settings,
  StickyNote,
  User,
  Video,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import '@xyflow/react/dist/style.css';

/** Canonical name for the root (tier 0) node — single source of truth for the graph root label. */
export const KNOWLEDGE_GRAPH_ROOT_NAME = 'Technology';

export type KnowledgeNodeData = {
  label: string;
  about: string;
  category?: string;
  accentColor: string;
  /** 0 = root, 1 = direct children of root, then depth to leaves */
  tier: number;
  isRoot?: boolean;
  /** Derived at render: ancestor + subtree highlight while hovering paths */
  pathHighlight?: boolean;
};

type KnowledgeFlowNode = Node<KnowledgeNodeData, 'knowledge'>;

const CYAN = '#00F0FF';

function SidebarItem({
  icon: Icon,
  active = false,
}: {
  icon: LucideIcon;
  active?: boolean;
}) {
  return (
    <div
      className={`flex cursor-pointer items-center justify-center rounded-xl p-2 transition-all ${
        active
          ? 'bg-[#00F0FF] text-black'
          : 'text-gray-500 hover:text-white'
      }`}
    >
      <Icon size={20} strokeWidth={2.5} />
    </div>
  );
}

function KnowledgeNode({ data, selected }: NodeProps<KnowledgeFlowNode>) {
  const accent = data.accentColor || CYAN;
  const size = data.isRoot ? 'size-[52px]' : 'size-11';
  const ring = data.isRoot ? 'ring-2 ring-offset-2 ring-offset-[#050505]' : '';
  const pathGlow = data.pathHighlight;

  return (
    <div className="group flex flex-col items-center gap-2">
      <Handle
        type="target"
        position={Position.Top}
        className="!size-2 !border-0 !bg-transparent !opacity-0"
      />
      <div className="relative flex flex-col items-center">
        <div
          className={`pointer-events-none absolute inset-0 scale-125 rounded-full blur-xl transition-opacity duration-300 ${
            pathGlow ? 'opacity-90' : 'opacity-0 group-hover:opacity-70'
          } ${selected && !pathGlow ? 'opacity-90' : ''}`}
          style={{ background: accent }}
        />
        <div
          className={`relative flex ${size} shrink-0 items-center justify-center rounded-full border-[3px] bg-[#0c0c0c] shadow-[0_0_0_1px_rgba(255,255,255,0.04)] transition-all duration-200 ${ring}`}
          style={{
            borderColor: pathGlow ? accent : selected ? accent : '#2a2a2a',
            boxShadow: pathGlow
              ? `0 0 32px ${accent}99, inset 0 0 22px ${accent}22`
              : selected
                ? `0 0 28px ${accent}66, inset 0 0 20px ${accent}14`
                : undefined,
          }}
        >
          <div
            className={`rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.9)] ${
              data.isRoot ? 'size-2.5' : 'size-2'
            }`}
          />
        </div>
      </div>
      <span className="max-w-[128px] select-none text-center text-[11px] font-semibold leading-tight tracking-wide text-white/95">
        {data.label}
      </span>
      <Handle
        type="source"
        position={Position.Bottom}
        className="!size-2 !border-0 !bg-transparent !opacity-0"
      />
    </div>
  );
}

const nodeTypes = { knowledge: KnowledgeNode };

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

/** Vertical tree: tier increases downward; siblings spread horizontally. */
const TIER_GAP_Y = 132;
const SIBLING_GAP_X = 150;

function layoutByTiers(
  nodes: { id: string; data: KnowledgeNodeData }[]
): Map<string, { x: number; y: number }> {
  const byTier = new Map<number, string[]>();
  for (const n of nodes) {
    const t = n.data.tier;
    if (!byTier.has(t)) byTier.set(t, []);
    byTier.get(t)!.push(n.id);
  }
  for (const ids of byTier.values()) ids.sort((a, b) => a.localeCompare(b));
  const maxTier = Math.max(...byTier.keys(), 0);
  const positions = new Map<string, { x: number; y: number }>();
  for (let tier = 0; tier <= maxTier; tier++) {
    const row = byTier.get(tier) ?? [];
    row.forEach((id, j) => {
      const y = tier * TIER_GAP_Y;
      const x = j * SIBLING_GAP_X - ((row.length - 1) * SIBLING_GAP_X) / 2;
      positions.set(id, { x, y });
    });
  }
  return positions;
}

function buildStaticGraph(): {
  nodes: Node<KnowledgeNodeData>[];
  edges: Edge[];
  rootId: string;
} {
  const rootId = 'root-technology';

  const rawNodes: Omit<Node<KnowledgeNodeData>, 'position' | 'type'>[] = [
    {
      id: rootId,
      selected: true,
      data: {
        label: KNOWLEDGE_GRAPH_ROOT_NAME,
        category: 'Root · Tier 0',
        isRoot: true,
        tier: 0,
        accentColor: CYAN,
        about:
          'Technology is the application of conceptual knowledge to achieve practical goals — especially in industry, science, and everyday life.',
      },
    },
    {
      id: 'n-bio',
      data: {
        label: 'Bio Hacking',
        category: KNOWLEDGE_GRAPH_ROOT_NAME,
        tier: 1,
        accentColor: '#22C55E',
        about:
          'Exploring biology through measurement, feedback loops, and careful experimentation to improve health and performance.',
      },
    },
    {
      id: 'n-ethics',
      data: {
        label: 'AI Ethics',
        category: KNOWLEDGE_GRAPH_ROOT_NAME,
        tier: 1,
        accentColor: '#7C3AED',
        about:
          'Frameworks for fairness, safety, transparency, and accountability when building and deploying intelligent systems.',
      },
    },
    {
      id: 'n-art',
      data: {
        label: 'Digital Art',
        category: KNOWLEDGE_GRAPH_ROOT_NAME,
        tier: 1,
        accentColor: '#EC4899',
        about:
          'Creative practice spanning generative tools, motion, and interactive installations — where craft meets computation.',
      },
    },
    {
      id: 'n-space',
      data: {
        label: 'Space Exploration',
        category: KNOWLEDGE_GRAPH_ROOT_NAME,
        tier: 1,
        accentColor: '#F97316',
        about:
          'Robotics, propulsion, and remote sensing — engineering systems that operate where humans cannot easily go.',
      },
    },
    {
      id: 'n-wearables',
      data: {
        label: 'Wearables',
        category: 'Bio Hacking',
        tier: 2,
        accentColor: '#4ADE80',
        about:
          'Sensors on the body for continuous vitals, activity, and context — closing the loop between signal and habit.',
      },
    },
    {
      id: 'n-fairness',
      data: {
        label: 'Fairness',
        category: 'AI Ethics',
        tier: 2,
        accentColor: '#A78BFA',
        about:
          'Measuring and mitigating disparate impact across groups in data, models, and decisions.',
      },
    },
    {
      id: 'n-transparency',
      data: {
        label: 'Transparency',
        category: 'AI Ethics',
        tier: 2,
        accentColor: '#C4B5FD',
        about:
          'Interpretability, reporting, and audit trails so stakeholders can understand how outcomes are produced.',
      },
    },
    {
      id: 'n-robotics',
      data: {
        label: 'Robotics',
        category: 'Space Exploration',
        tier: 2,
        accentColor: '#FB923C',
        about:
          'Autonomous platforms, manipulation, and teleoperation for environments that are hostile or distant.',
      },
    },
  ];

  const edges: Edge[] = [
    { id: 'e-r-bio', source: rootId, target: 'n-bio', animated: false },
    { id: 'e-r-ethics', source: rootId, target: 'n-ethics', animated: false },
    { id: 'e-r-art', source: rootId, target: 'n-art', animated: false },
    { id: 'e-r-space', source: rootId, target: 'n-space', animated: false },
    { id: 'e-bio-wear', source: 'n-bio', target: 'n-wearables', animated: false },
    { id: 'e-eth-fair', source: 'n-ethics', target: 'n-fairness', animated: false },
    { id: 'e-eth-trans', source: 'n-ethics', target: 'n-transparency', animated: false },
    { id: 'e-space-rob', source: 'n-space', target: 'n-robotics', animated: false },
  ].map((e) => ({
    ...e,
    style: { stroke: CYAN, strokeWidth: 1.25, opacity: 0.42 },
  }));

  const pos = layoutByTiers(rawNodes.map((n) => ({ id: n.id, data: n.data })));

  const nodes: Node<KnowledgeNodeData>[] = rawNodes.map((n) => ({
    ...n,
    type: 'knowledge' as const,
    position: pos.get(n.id) ?? { x: 0, y: 0 },
  }));

  return { nodes, edges, rootId };
}

const { nodes: seedNodes, edges: seedEdges, rootId: SEED_ROOT_ID } =
  buildStaticGraph();

function BirdsEyesFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState(seedNodes);
  const [edges, , onEdgesChange] = useEdgesState(seedEdges);
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(SEED_ROOT_ID);
  const [panelTab, setPanelTab] = useState<'learn' | 'blend' | 'explore'>('learn');
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const pathHighlight = useMemo(
    () => computePathHighlight(hoveredId, SEED_ROOT_ID, edges),
    [hoveredId, edges]
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

  const displayNodes = useMemo(() => {
    const q = query.trim().toLowerCase();
    const glow = pathHighlight?.nodeIds;
    return nodes.map((n) => {
      const label = n.data.label ?? '';
      const dim = q.length > 0 && !label.toLowerCase().includes(q);
      const pathHighlightOn = !!(glow && glow.has(n.id));
      return {
        ...n,
        data: {
          ...n.data,
          pathHighlight: pathHighlightOn,
        },
        style: { ...n.style, opacity: dim ? 0.14 : 1 },
      };
    });
  }, [nodes, query, pathHighlight]);

  const displayEdges = useMemo(() => {
    const hi = pathHighlight?.edgeIds;
    const active = !!hoveredId && hi;
    return edges.map((e) => ({
      ...e,
      animated: active ? hi.has(e.id) : false,
      style: {
        ...e.style,
        stroke: CYAN,
        strokeWidth: active && hi.has(e.id) ? 2.75 : 1.25,
        opacity: active ? (hi.has(e.id) ? 0.95 : 0.14) : 0.42,
      },
    }));
  }, [edges, hoveredId, pathHighlight]);

  const focusNeighbor = useCallback(
    (id: string) => {
      setSelectedId(id);
      setNodes((nds) => nds.map((n) => ({ ...n, selected: n.id === id })));
    },
    [setNodes]
  );

  return (
    <div className="flex h-screen w-full overflow-hidden bg-[#050505] font-sans text-white">
      <aside className="z-30 flex w-20 shrink-0 flex-col items-center border-r border-white/[0.06] bg-[#070707] py-8">
        <div className="mb-4 flex size-10 items-center justify-center rounded-xl bg-white shadow-sm">
          <Layers className="text-black" size={20} />
        </div>
        <div className="flex flex-col items-center gap-6">
          <SidebarItem icon={BookOpen} active />
          <SidebarItem icon={Search} />
          <SidebarItem icon={User} />
        </div>
        <div className="mt-auto flex flex-col items-center">
          <SidebarItem icon={Settings} />
        </div>
      </aside>

      <main className="relative min-h-0 min-w-0 flex-1">
        <ReactFlow
          nodes={displayNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling
          onNodeMouseEnter={(_, n) => setHoveredId(n.id)}
          onNodeMouseLeave={() => setHoveredId(null)}
          onSelectionChange={({ nodes: sel }) => {
            setSelectedId(sel[0]?.id ?? null);
          }}
          colorMode="dark"
          minZoom={0.45}
          maxZoom={1.35}
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            animated: false,
            style: { stroke: CYAN, strokeWidth: 1.25, opacity: 0.42 },
          }}
          className="!bg-[#050505]"
          onInit={(inst) => {
            window.requestAnimationFrame(() =>
              inst.fitView({ padding: 0.3, duration: 0, maxZoom: 1.2 })
            );
          }}
        >
          <Background
            color="#353535"
            gap={24}
            size={1.1}
            variant={BackgroundVariant.Dots}
          />
          <Panel position="bottom-center" className="mb-8">
            <div className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#101010]/90 px-4 py-2.5 shadow-[0_16px_48px_rgba(0,0,0,0.55)] backdrop-blur-2xl">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search the map…"
                className="w-64 border-none bg-transparent text-sm text-white/90 outline-none placeholder:text-zinc-600 sm:w-72"
              />
              <Search className="shrink-0 text-zinc-500" size={18} strokeWidth={2} />
            </div>
          </Panel>
        </ReactFlow>
      </main>

      <aside className="z-30 flex w-[min(100%,420px)] shrink-0 flex-col border-l border-white/[0.06] bg-[#080808]/95 shadow-[-12px_0_40px_rgba(0,0,0,0.45)] backdrop-blur-xl">
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-white/[0.06] px-5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Knowledge
          </span>
          {selectedId ? (
            <button
              type="button"
              onClick={() => {
                setSelectedId(null);
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
                  className="mt-0.5 size-10 shrink-0 rounded-full border-2 border-white/[0.08]"
                  style={{
                    background: `radial-gradient(circle at 35% 30%, ${selectedNode.data.accentColor}, #0a0a0a 70%)`,
                    boxShadow: `0 0 24px ${selectedNode.data.accentColor}44`,
                  }}
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold leading-snug tracking-tight text-white">
                    {selectedNode.data.label}
                  </h2>
                  <p className="mt-1 text-xs font-medium text-zinc-500">
                    Tier {selectedNode.data.tier}
                    {selectedNode.data.isRoot
                      ? ` · Root · ${KNOWLEDGE_GRAPH_ROOT_NAME}`
                      : selectedNode.data.category
                        ? ` · Under “${selectedNode.data.category}”`
                        : ''}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex gap-2">
                {(
                  [
                    { id: 'learn' as const, label: 'Learn' },
                    { id: 'blend' as const, label: 'Blend' },
                    { id: 'explore' as const, label: 'Explore' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setPanelTab(t.id)}
                    className={`rounded-full px-4 py-2 text-xs font-semibold transition-all ${
                      panelTab === t.id
                        ? 'bg-white text-black shadow-sm'
                        : 'bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-white'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="mt-4 flex gap-3 text-zinc-600">
                <BookOpen size={18} className="hover:text-zinc-300" />
                <Video size={18} className="hover:text-zinc-300" />
                <StickyNote size={18} className="hover:text-zinc-300" />
                <MessageCircle size={18} className="hover:text-zinc-300" />
              </div>
            </div>

            <div className="flex-1 space-y-6 px-5 py-6">
              <div
                className="aspect-[16/9] w-full overflow-hidden rounded-xl border border-white/[0.06] bg-gradient-to-br from-zinc-800 via-[#0f0f0f] to-black"
                style={{
                  boxShadow: `inset 0 0 0 1px ${selectedNode.data.accentColor}22`,
                }}
              />
              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  About
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-300">
                  {panelTab === 'learn' && selectedNode.data.about}
                  {panelTab === 'blend' &&
                    'Blend mode is a stub: combine sources, weigh signals, and fork narratives — wire this tab to your reasoning pipeline.'}
                  {panelTab === 'explore' &&
                    'Explore mode is a stub: surface adjacent corpora, timelines, and citations — connect to search or RAG here.'}
                </p>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Graph context
                </h3>
                <p className="mt-2 text-xs leading-relaxed text-zinc-400">
                  Root is <span className="font-semibold text-zinc-200">{KNOWLEDGE_GRAPH_ROOT_NAME}</span> (tier 0).
                  This node is tier {selectedNode.data.tier}. Hover any node on the canvas to trace paths to the
                  root and down to leaves.
                </p>
              </section>

              <section>
                <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-zinc-500">
                  Connected to
                </h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {connectedLabels.length === 0 ? (
                    <span className="text-xs text-zinc-600">No edges.</span>
                  ) : (
                    connectedLabels.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => focusNeighbor(c.id)}
                        className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-zinc-200 transition-colors hover:border-white/[0.14] hover:bg-white/[0.08]"
                      >
                        <span
                          className="mr-2 inline-block size-1.5 rounded-full align-middle"
                          style={{ background: c.color }}
                        />
                        {c.label}
                        <span className="ml-1.5 text-[10px] text-zinc-500">T{c.tier}</span>
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
            <p className="text-sm font-medium text-zinc-400">Select a node on the map</p>
            <p className="max-w-[260px] text-xs leading-relaxed text-zinc-600">
              Click a node to open this card. The graph is fixed: root is{' '}
              <span className="text-zinc-400">{KNOWLEDGE_GRAPH_ROOT_NAME}</span> (tier 0); deeper tiers extend
              downward.
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
