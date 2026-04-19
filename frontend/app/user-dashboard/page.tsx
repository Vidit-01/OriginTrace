'use client';

import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

import { AggregateRiskSummary } from '@/app/components/knowledge-brain/aggregate-risk-summary';
import type { StoredGraphRecord } from '@/app/components/knowledge-brain/supply-chain-data';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  ChevronDown,
  Clock,
  Layers,
  Package,
  ShieldAlert,
  User,
} from 'lucide-react';

type TierBlock = {
  tier: 1 | 2 | 3;
  suppliers: string[];
};

type ProductLine = {
  label: string;
  hsn: string;
};

type HistoryCompany = {
  id: string;
  name: string;
  tiers: TierBlock[];
  sanctionsNote: string;
  topProducts: ProductLine[];
};

const DEMO_PROFILE = {
  displayName: 'Jordan Vale',
  role: 'Trade compliance analyst',
  organization: 'Synergy Supply Intelligence',
  focus:
    'HS-normalized tiers, OFAC-aligned screening, and customs-route priors.',
  lastActiveNote: 'Preferences stored locally until auth ships.',
} as const;

const SEARCH_HISTORY: HistoryCompany[] = [
  {
    id: 'apple',
    name: 'Apple Inc.',
    tiers: [
      { tier: 1, suppliers: ['Foxconn Technology Group', 'Taiwan Semiconductor Mfg.', 'Samsung Display Co.'] },
      { tier: 2, suppliers: ['Corning Incorporated', 'Micron Technology Inc.', 'SK Hynix Inc.'] },
      {
        tier: 3,
        suppliers: ['ASM Pacific Technology', 'Applied Materials Inc.', 'Entegris Specialty Materials'],
      },
    ],
    sanctionsNote:
      'Illustrative check: parent not on OFAC SDN as of demo freeze; flagged watch for lithography-capable tools under coordinated EU/US export reviews. Subsidiary tooling in CN subject to quarterly rescreen.',
    topProducts: [
      { label: 'Smartphones & tethered assemblies', hsn: '8517.12' },
      { label: 'Portable computing devices', hsn: '8471.30' },
      { label: 'Wireless audio wearables', hsn: '8518.30' },
    ],
  },
  {
    id: 'tesla',
    name: 'Tesla Inc.',
    tiers: [
      { tier: 1, suppliers: ['Panasonic Energy', 'CATL', 'LG Energy Solution'] },
      { tier: 2, suppliers: ['Contemporary Amperex — module plants', 'Sumitomo Metal Mining', 'Albemarle Corporation'] },
      { tier: 3, suppliers: ['SQM Lithium division', 'Pilbara Minerals spodumene', 'Glencore cathode precursors'] },
    ],
    sanctionsNote:
      'Demo narrative: no SDN hit on Tesla Inc.; Russian-origin aluminium trace passes secondary filter. Minor alert on CN rare-earth alloy blends — holds for documentation only.',
    topProducts: [
      { label: 'EV traction battery packs', hsn: '8507.60' },
      { label: 'DC charging infrastructure cabinets', hsn: '8537.10' },
      { label: 'Drive inverter assemblies', hsn: '8504.40' },
    ],
  },
  {
    id: 'microsoft',
    name: 'Microsoft Corporation',
    tiers: [
      { tier: 1, suppliers: ['AMD packaging partners', 'Intel Foundry Services', 'SK Hynix DRAM modules'] },
      { tier: 2, suppliers: ['Quanta Computer ODM', 'Wistron Corporation', 'Delta Electronics PSUs'] },
      { tier: 3, suppliers: ['Tokyo Electron etch', 'ASML EUV sustainment', 'Lam Research deposition'] },
    ],
    sanctionsNote:
      'Illustrative: cloud capex suppliers screened against BIS entity list extensions; no block on Microsoft parent. Legacy RU-region revenue carve-outs flagged for audit trail only.',
    topProducts: [
      { label: 'Cloud accelerator appliances', hsn: '8471.50' },
      { label: 'Enterprise security appliance SKUs', hsn: '8517.62' },
      { label: 'Mixed-reality headsets', hsn: '8528.52' },
    ],
  },
];

const tierSupplierTotal = (company: HistoryCompany) =>
  company.tiers.reduce((acc, b) => acc + b.suppliers.length, 0);

export default function UserDashboardPage() {
  const [cachedGraphs, setCachedGraphs] = useState<StoredGraphRecord[] | null>(null);

  useEffect(() => {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
    let cancelled = false;
    fetch(`${baseUrl}/all_companies_data`)
      .then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json() as Promise<StoredGraphRecord[]>;
      })
      .then((data) => {
        if (!cancelled) setCachedGraphs(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setCachedGraphs([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cachedStats = useMemo(() => {
    if (!cachedGraphs?.length) return null;
    let nodes = 0;
    let edges = 0;
    for (const rec of cachedGraphs) {
      const p = rec.payload;
      nodes += p?.nodes?.length ?? 0;
      edges += p?.edges?.length ?? 0;
    }
    return { graphs: cachedGraphs.length, nodes, edges };
  }, [cachedGraphs]);

  const companyCount = cachedStats?.graphs ?? SEARCH_HISTORY.length;
  const mappedLinks =
    cachedStats?.edges ??
    SEARCH_HISTORY.reduce((sum, c) => sum + tierSupplierTotal(c), 0);

  return (
    <div className="font-sans text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-white/[0.08] bg-[#090c12]/90 backdrop-blur-xl supports-[backdrop-filter]:bg-[#090c12]/80">
        <div className="mx-auto flex h-[3.25rem] max-w-7xl items-center justify-between gap-3 px-5 sm:h-14">
          <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
            <Link
              href="/dashboard"
              className="group flex shrink-0 items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-[#00E8FF]"
            >
              <span className="flex size-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03] transition group-hover:border-[#00E8FF]/30">
                <ArrowLeft className="size-4" strokeWidth={2} />
              </span>
              <span className="hidden sm:inline">Back to graph</span>
              <span className="sm:hidden">Graph</span>
            </Link>
            <Link
              href="/"
              className="shrink-0 opacity-90 transition hover:opacity-100"
              aria-label="ORIGINTRACE home"
            >
              <Image
                src="/ot2.png"
                alt="ORIGINTRACE"
                width={152}
                height={40}
                className="h-6 w-auto max-w-[9rem] object-contain object-left sm:h-7 sm:max-w-none"
                sizes="(max-width:640px) 120px, 152px"
              />
            </Link>
          </div>
          <p className="truncate text-[11px] font-semibold uppercase tracking-[var(--sy-tracking-overline)] text-zinc-500">
            Account workspace
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 pb-28 pt-8 sm:pb-32 sm:pt-10">
        <div className="border-b border-white/[0.06] pb-8">
          <h1 className="font-melodrama text-[length:var(--sy-text-display)] leading-[var(--sy-leading-display)] tracking-[var(--sy-tracking-tight)] text-white">
            Your workspace
          </h1>
          <p className="mt-3 max-w-2xl text-[length:var(--sy-text-body)] leading-[var(--sy-leading-relaxed)] text-zinc-400">
            Profile and saved company intelligence from the supply graph. Open a row to review tiers, compliance
            context, and HSN product lines — demo data for preview.
          </p>

          <dl className="mt-8 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[var(--sy-tracking-overline)] text-zinc-500">
                <Building2 className="size-3.5 text-[#00E8FF]/70" aria-hidden />
                Cached graphs
              </dt>
              <dd className="font-melodrama mt-1 text-2xl font-medium tabular-nums text-white">{companyCount}</dd>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[var(--sy-tracking-overline)] text-zinc-500">
                <Layers className="size-3.5 text-[#00E8FF]/70" aria-hidden />
                Stored nodes
              </dt>
              <dd className="font-melodrama mt-1 text-2xl font-medium tabular-nums text-white">
                {cachedStats?.nodes ?? '—'}
              </dd>
            </div>
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
              <dt className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[var(--sy-tracking-overline)] text-zinc-500">
                <Package className="size-3.5 text-[#00E8FF]/70" aria-hidden />
                Stored edges
              </dt>
              <dd className="font-melodrama mt-1 text-2xl font-medium tabular-nums text-white">{mappedLinks}</dd>
            </div>
          </dl>
        </div>

        <div className="mt-12 grid gap-10 lg:grid-cols-[minmax(280px,360px)_minmax(0,1fr)] lg:items-start lg:gap-14">
          <div className="flex min-w-0 flex-col gap-10">
            <aside>
              <div className="relative overflow-hidden rounded-2xl border border-white/[0.1] bg-[linear-gradient(155deg,rgba(16,22,36,0.65),rgba(6,9,14,0.92))] p-6 shadow-[0_24px_80px_-32px_rgba(0,232,255,0.2)]">
                <div className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full bg-[#00E8FF]/[0.07] blur-2xl" />
                <div className="relative flex flex-col items-center text-center sm:flex-row sm:items-start sm:text-left">
                  <div
                    className="flex size-[92px] shrink-0 items-center justify-center rounded-2xl border border-[#00E8FF]/30 bg-[linear-gradient(165deg,rgba(18,26,42,0.95),rgba(8,11,18,0.98))] shadow-[0_0_40px_-8px_rgba(0,232,255,0.35)]"
                    aria-hidden
                  >
                    <User className="size-10 text-[#00E8FF]/90" strokeWidth={1.5} />
                  </div>
                  <div className="mt-6 min-w-0 sm:ml-5 sm:mt-0">
                    <h2 className="font-melodrama text-[length:var(--sy-text-title-lg)] font-medium tracking-[var(--sy-tracking-tight)] text-white">
                      {DEMO_PROFILE.displayName}
                    </h2>
                    <p className="mt-2 inline-flex rounded-full border border-[#00E8FF]/25 bg-[#00E8FF]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#00E8FF]/95">
                      {DEMO_PROFILE.role}
                    </p>
                  </div>
                </div>

                <ul className="relative mt-6 space-y-3 border-t border-white/[0.06] pt-6 text-[length:var(--sy-text-body)] leading-[var(--sy-leading-relaxed)] text-zinc-400">
                  <li className="flex gap-3">
                    <Briefcase className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                    <span>{DEMO_PROFILE.organization}</span>
                  </li>
                  <li className="flex gap-3">
                    <Layers className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                    <span>{DEMO_PROFILE.focus}</span>
                  </li>
                  <li className="flex gap-3">
                    <Clock className="mt-0.5 size-4 shrink-0 text-zinc-500" aria-hidden />
                    <span>{DEMO_PROFILE.lastActiveNote}</span>
                  </li>
                </ul>
              </div>
            </aside>

            <AggregateRiskSummary records={cachedGraphs} />
          </div>

          <section className="min-w-0 flex-1">
            <div className="flex flex-col gap-2 border-b border-[#00E8FF]/20 pb-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="font-melodrama text-[length:var(--sy-text-title-lg)] font-medium tracking-[var(--sy-tracking-tight)] text-white">
                  Saved companies
                </h2>
                <p className="mt-2 max-w-xl text-[length:var(--sy-text-body)] leading-[var(--sy-leading-snug)] text-zinc-500">
                  Tap a row to expand tiers, sanctions snapshot, and top HSN products. Same data as before — clearer
                  layout and touch-friendly disclosure.
                </p>
              </div>
              <Link
                href="/dashboard"
                className="mt-2 inline-flex shrink-0 items-center justify-center rounded-lg border border-[#00E8FF]/35 bg-[#00E8FF]/10 px-4 py-2 text-[13px] font-semibold text-[#00E8FF] transition hover:bg-[#00E8FF]/15 sm:mt-0"
              >
                Open supply graph
              </Link>
            </div>

            <ul className="mt-8 flex flex-col gap-3">
              {SEARCH_HISTORY.map((company, index) => (
                <li key={company.id}>
                  <details className="group rounded-xl border border-white/[0.1] bg-white/[0.03] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition open:border-[#00E8FF]/25 open:shadow-[0_0_0_1px_rgba(0,232,255,0.12)]">
                    <summary className="flex cursor-pointer list-none items-center gap-4 px-4 py-4 outline-none marker:content-none [&::-webkit-details-marker]:hidden sm:gap-5 sm:px-5">
                      <span
                        className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#00E8FF]/40 bg-[#00E8FF]/10 font-sans text-sm font-semibold text-[#00E8FF]"
                        aria-hidden
                      >
                        {index + 1}
                      </span>
                      <span className="font-melodrama min-w-0 flex-1 text-left text-[1.15rem] font-medium tracking-[var(--sy-tracking-tight)] text-white sm:text-[1.3rem]">
                        {company.name}
                      </span>
                      <span className="hidden text-[11px] font-medium uppercase tracking-[0.14em] text-zinc-500 sm:block">
                        {tierSupplierTotal(company)} links
                      </span>
                      <ChevronDown
                        className="size-5 shrink-0 text-zinc-500 transition duration-200 group-open:rotate-180 group-open:text-[#00E8FF]"
                        aria-hidden
                      />
                    </summary>

                    <div className="border-t border-white/10 bg-[#070a10]/95 px-4 py-5 sm:px-5">
                      <div className="space-y-6 text-left">
                        {company.tiers.map((block) => (
                          <div key={block.tier}>
                            <p className="font-sans text-[11px] font-semibold uppercase tracking-[var(--sy-tracking-overline)] text-[#00E8FF]/85">
                              Tier {block.tier}
                            </p>
                            <ul className="mt-2 space-y-1.5 font-sans text-[14px] leading-snug text-zinc-300">
                              {block.suppliers.map((s) => (
                                <li key={s} className="flex gap-2">
                                  <span className="mt-2 size-1 shrink-0 rounded-full bg-[#00E8FF]/60" />
                                  <span>{s}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}

                        <div className="rounded-lg border border-amber-500/25 bg-amber-500/[0.07] px-3 py-3">
                          <div className="flex items-start gap-2">
                            <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-400/90" aria-hidden />
                            <div>
                              <p className="font-sans text-[11px] font-semibold uppercase tracking-[var(--sy-tracking-overline)] text-amber-200/90">
                                Sanctions & compliance snapshot
                              </p>
                              <p className="mt-2 font-sans text-[13px] leading-relaxed text-zinc-400">
                                {company.sanctionsNote}
                              </p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <p className="font-sans text-[11px] font-semibold uppercase tracking-[var(--sy-tracking-overline)] text-zinc-500">
                            Top products (HSN)
                          </p>
                          <ul className="mt-3 divide-y divide-white/[0.06] rounded-lg border border-white/[0.08] bg-black/30 font-sans">
                            {company.topProducts.map((p) => (
                              <li
                                key={p.hsn}
                                className="flex flex-wrap items-baseline justify-between gap-2 px-3 py-2.5 text-[13px] sm:px-4"
                              >
                                <span className="text-zinc-300">{p.label}</span>
                                <span className="font-mono text-[12px] font-semibold text-[#00E8FF]">{p.hsn}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </details>
                </li>
              ))}
            </ul>

            <p className="mt-8 text-center text-[12px] text-zinc-600 sm:text-left">
              Preview dataset — persistence and live screening sync when authentication is enabled.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
