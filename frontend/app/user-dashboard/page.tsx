'use client';

import Link from 'next/link';
import { ArrowLeft, LayoutDashboard, Settings, User } from 'lucide-react';

export default function UserDashboardPage() {
  return (
    <div className="font-sans min-h-screen bg-[#05070a] text-zinc-100">
      <header className="border-b border-white/10 bg-[#090c12]/90 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-sm font-medium text-zinc-400 transition hover:text-[#00E8FF]"
          >
            <ArrowLeft className="size-4" strokeWidth={2} />
            Back to graph
          </Link>
          <span className="font-melodrama text-lg font-medium tracking-tight text-white">
            Account
          </span>
          <div className="w-[88px]" aria-hidden />
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 py-12">
        <div className="mb-10 flex flex-col gap-2">
          <h1 className="font-melodrama text-3xl font-medium tracking-tight text-white md:text-4xl">
            User dashboard
          </h1>
          <p className="max-w-xl text-[15px] leading-relaxed text-zinc-400">
            Manage your workspace preferences and profile. This page is a shell — wire auth, saved graphs, and
            notifications here.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex size-10 items-center justify-center rounded-xl bg-[#00E8FF]/12 text-[#00E8FF]">
              <User className="size-5" strokeWidth={2} />
            </div>
            <h2 className="mt-4 font-sans text-lg font-semibold text-white">Profile</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Name, email, and organization — connect your identity provider when ready.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
            <div className="flex size-10 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
              <LayoutDashboard className="size-5" strokeWidth={2} />
            </div>
            <h2 className="mt-4 font-sans text-lg font-semibold text-white">Saved views</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Bookmark supply-chain snapshots and reopen them from one place.
            </p>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] sm:col-span-2 lg:col-span-1">
            <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/15 text-amber-200">
              <Settings className="size-5" strokeWidth={2} />
            </div>
            <h2 className="mt-4 font-sans text-lg font-semibold text-white">Settings</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              API keys, Mapbox token hints, and export defaults for your team.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
