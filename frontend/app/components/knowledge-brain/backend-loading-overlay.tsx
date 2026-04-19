'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

type Props = {
  open: boolean;
  message?: string;
};

/**
 * Full-screen loading state while the Python API builds or expands a graph.
 * Optional `public/loading.gif` is used when present; otherwise a branded spinner is shown.
 */
export function BackendLoadingOverlay({ open, message = 'Processing supply chain data…' }: Props) {
  const [useGif, setUseGif] = useState(true);

  if (!open) return null;

  return (
    <div
      className="pointer-events-auto fixed inset-0 z-[500] flex flex-col items-center justify-center gap-4 bg-[#03050a]/88 px-6 backdrop-blur-md"
      role="status"
      aria-live="polite"
      aria-busy
    >
      {useGif ? (
        <div className="relative h-20 w-20">
          {/* Drop `public/loading.gif` to use a custom animation; on missing file we fall back to the spinner. */}
          <img
            src="/loading.gif"
            alt=""
            width={80}
            height={80}
            className="h-20 w-20 object-contain"
            onError={() => setUseGif(false)}
          />
        </div>
      ) : (
        <Loader2
          className="size-16 shrink-0 animate-spin text-[#00E8FF]"
          strokeWidth={1.75}
          aria-hidden
        />
      )}
      <p className="max-w-sm text-center font-sans text-sm font-medium text-zinc-200">{message}</p>
      <p className="max-w-md text-center font-sans text-xs leading-relaxed text-zinc-500">
        Enriching nodes with geocoding, sanctions, financial context, and weather baselines.
      </p>
    </div>
  );
}
