'use client';

import { useMemo } from 'react';

import {
  parseRiskAssessment,
  riskBandBadgeClass,
  riskBandFromCombinedScore,
  type StoredGraphRecord,
} from './supply-chain-data';

type Props = {
  records: StoredGraphRecord[] | null;
};

export function AggregateRiskSummary({ records }: Props) {
  const { recent, hotSpots } = useMemo(() => {
    if (!records?.length) {
      return { recent: [], hotSpots: [] as { company: string; label: string; score: number }[] };
    }

    const sorted = [...records].sort(
      (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
    );

    type Row = {
      company: string;
      updated_at: string;
      anchor: string;
      avg?: number;
      max?: number;
      nodes: number;
      elevated: number;
    };

    const recentRows: Row[] = sorted.slice(0, 6).map((rec) => {
      const nodes = rec.payload?.nodes ?? [];
      let sum = 0;
      let nScores = 0;
      let max = 0;
      let elevated = 0;
      for (const node of nodes) {
        const r = parseRiskAssessment(node['Risk Assessment']);
        const c = r?.combined_score;
        if (c !== undefined && Number.isFinite(c)) {
          sum += c;
          nScores += 1;
          max = Math.max(max, c);
          if (c >= 67) elevated += 1;
        }
      }
      const avg = nScores ? Math.round((sum / nScores) * 10) / 10 : undefined;
      return {
        company: rec.company_input || rec.company_key,
        updated_at: rec.updated_at,
        anchor: rec.payload?.selected_anchor_hsn?.trim()
          ? rec.payload.selected_anchor_hsn
          : '—',
        avg,
        max: max || undefined,
        nodes: nodes.length,
        elevated,
      };
    });

    const hotspotList: { company: string; label: string; score: number }[] = [];
    for (const rec of sorted) {
      const anchorName = rec.company_input || rec.company_key;
      for (const node of rec.payload?.nodes ?? []) {
        const r = parseRiskAssessment(node['Risk Assessment']);
        const c = r?.combined_score;
        if (c !== undefined && Number.isFinite(c) && c >= 45) {
          hotspotList.push({
            company: anchorName,
            label: String(node['Company Name'] ?? ''),
            score: c,
          });
        }
      }
    }
    hotspotList.sort((a, b) => b.score - a.score);
    const hotSpots = hotspotList.slice(0, 8);

    return { recent: recentRows, hotSpots };
  }, [records]);

  if (!records) {
    return (
      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Portfolio intelligence
        </p>
        <p className="mt-3 font-sans text-[13px] leading-relaxed text-zinc-500">
          Loading cross-graph analytics…
        </p>
      </section>
    );
  }

  if (records.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-white/15 bg-black/20 p-5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
          Portfolio intelligence
        </p>
        <p className="mt-3 font-sans text-[13px] leading-relaxed text-zinc-500">
          No cached company graphs yet. Run a supply chain search to build history for aggregate risk
          views.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Portfolio intelligence
          </p>
          <p className="mt-1 font-sans text-[12px] leading-snug text-zinc-500">
            From <span className="font-mono text-zinc-400">{records.length}</span> cached graph
            {records.length === 1 ? '' : 's'} · GET /all_companies_data
          </p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#00E8FF]/75">
          Recent activity
        </p>
        <ul className="space-y-2.5">
          {recent.map((row) => (
            <li
              key={`${row.company}-${row.updated_at}`}
              className="rounded-xl border border-white/[0.06] bg-black/25 px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="min-w-0 truncate font-sans text-[13px] font-medium text-zinc-200">
                  {row.company}
                </p>
                {row.avg !== undefined && (
                  <span
                    className={`shrink-0 rounded-md border px-1.5 py-0.5 font-mono text-[10px] tabular-nums ${riskBandBadgeClass(riskBandFromCombinedScore(row.avg))}`}
                  >
                    μ {row.avg}
                  </span>
                )}
              </div>
              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 font-sans text-[11px] text-zinc-500">
                <span>
                  Nodes <span className="tabular-nums text-zinc-400">{row.nodes}</span>
                </span>
                <span>
                  HS anchor <span className="font-mono text-zinc-400">{row.anchor}</span>
                </span>
                {row.elevated > 0 && (
                  <span className="text-amber-200/90">
                    High-tier cells: <span className="tabular-nums">{row.elevated}</span>
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-zinc-600">{row.updated_at}</p>
            </li>
          ))}
        </ul>
      </div>

      {hotSpots.length > 0 && (
        <div className="mt-6 space-y-3 border-t border-white/[0.06] pt-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-200/80">
            Cross-graph watchlist
          </p>
          <p className="font-sans text-[11px] leading-relaxed text-zinc-500">
            Entities with combined risk ≥ 45 across saved searches (highest first).
          </p>
          <ul className="space-y-2">
            {hotSpots.map((h, i) => (
              <li
                key={`${h.company}-${h.label}-${i}`}
                className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.05] bg-black/30 px-2.5 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-sans text-[12px] font-medium text-zinc-200">{h.label}</p>
                  <p className="truncate font-sans text-[10px] text-zinc-500">Graph: {h.company}</p>
                </div>
                <span
                  className={`shrink-0 rounded-md border px-2 py-0.5 font-mono text-[11px] tabular-nums ${riskBandBadgeClass(riskBandFromCombinedScore(h.score))}`}
                >
                  {h.score}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
