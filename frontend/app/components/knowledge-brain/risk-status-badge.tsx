'use client';

import {
  riskBandBadgeClass,
  riskBandFromCombinedScore,
  riskBandLabel,
} from './supply-chain-data';

export function RiskStatusBadge({
  combinedScore,
  className = '',
  variant = 'full',
}: {
  combinedScore: number | undefined;
  className?: string;
  /** full: label + score; score: numeric only (e.g. map pins) */
  variant?: 'full' | 'score';
}) {
  const band = riskBandFromCombinedScore(combinedScore);
  const title = riskBandLabel(band);
  const scoreText =
    combinedScore !== undefined && Number.isFinite(combinedScore)
      ? `${combinedScore}`
      : '—';

  return (
    <span
      title={`${title}${combinedScore !== undefined ? ` (${combinedScore})` : ''}`}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${riskBandBadgeClass(band)} ${variant === 'score' ? 'scale-95 px-1.5' : ''} ${className}`}
    >
      {variant === 'full' && <span className="opacity-85">{title}</span>}
      <span className="tabular-nums">{scoreText}</span>
    </span>
  );
}
