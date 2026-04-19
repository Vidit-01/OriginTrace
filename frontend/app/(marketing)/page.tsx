import Link from "next/link";

const features = [
  {
    title: "Resolve & anchor",
    body: "Accept a company name, match it to global trade records, and surface HSN codes from import history so analysts pick the right commodity anchor.",
  },
  {
    title: "Graph that compounds",
    body: "Persist companies and trade links as nodes and edges. Each new search enriches one shared graph so the model deepens instead of resetting.",
  },
  {
    title: "See risk, not noise",
    body: "BOM-aware pruning keeps the graph relevant to the product you care about—so a motor trace does not drown in unrelated office imports.",
  },
];

const steps = [
  {
    step: "01",
    title: "Search the importer",
    body: "Tier 0 is your company of interest—resolved against customs-scale trade datasets.",
  },
  {
    step: "02",
    title: "Choose the HSN anchor",
    body: "Pick the harmonized code that defines the product slice you want to follow across borders.",
  },
  {
    step: "03",
    title: "Walk the tiers",
    body: "Traverse Tier-1 suppliers through sub-suppliers and upstream materials, normalized where jurisdictions diverge beyond the first six digits.",
  },
];

const faqs = [
  {
    q: "What problem does Synergy target?",
    a: "Most teams see direct suppliers well but lose visibility into Tier-N. Synergy uses open trade records to reconstruct deeper tiers for compliance, resilience, and sourcing decisions.",
  },
  {
    q: "How does HSN normalization work?",
    a: "The first six digits of HS codes are globally comparable; national sub-classifications vary after that. The system is designed to align codes across jurisdictions while preserving jurisdiction-specific detail where it matters.",
  },
  {
    q: "What does “BOM-aware filtering” mean?",
    a: "The graph is pruned so unrelated commodities imported by the same company do not pollute a product-specific trace—critical when one importer handles many categories.",
  },
  {
    q: "What will I see in the product?",
    a: "An interactive graph to expand and collapse tiers, a geospatial view of cross-border flows, and a risk dashboard summarizing Tier-1 signals and red flags.",
  },
];

export default function LandingPage() {
  return (
    <div className="relative min-h-full">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.18),transparent_55%),radial-gradient(ellipse_60%_40%_at_100%_0%,rgba(167,139,250,0.12),transparent_50%)]"
      />

      <header className="relative border-b border-white/5 bg-[#030306]/80 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="text-sm font-semibold tracking-tight text-white"
          >
            Synergy
          </Link>
          <nav className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 text-sm text-zinc-400 sm:gap-x-6">
            <a
              href="#features"
              className="hidden transition hover:text-white sm:inline"
            >
              Capabilities
            </a>
            <a href="#how" className="hidden transition hover:text-white sm:inline">
              How it works
            </a>
            <a href="#faq" className="hidden transition hover:text-white sm:inline">
              FAQ
            </a>
            <Link
              href="/dashboard"
              className="rounded-full border border-white/15 bg-white/5 px-4 py-2 font-medium text-white transition hover:border-sky-400/40 hover:bg-white/10"
            >
              Open app
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="relative mx-auto grid max-w-6xl gap-12 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-sky-300/90">
              Open trade data · Tier 0 → Tier N
            </p>
            <h1 className="mt-4 text-balance text-4xl font-semibold tracking-tight text-white sm:text-5xl lg:text-[2.75rem] lg:leading-[1.08]">
              Trace sub-suppliers and raw inputs without the blind spot
            </h1>
            <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-zinc-400">
              Synergy reconstructs product-specific supply networks from public
              customs and harmonized-system records—so procurement and risk teams
              can see past Tier-1 into the chain that actually feeds production.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <a
                href="#cta"
                className="inline-flex h-12 min-h-[48px] items-center justify-center rounded-full bg-sky-500 px-7 text-sm font-semibold text-slate-950 shadow-[0_0_40px_-10px_rgba(56,189,248,0.7)] transition hover:bg-sky-400"
              >
                See a walkthrough
              </a>
              <a
                href="#depth"
                className="inline-flex h-12 min-h-[48px] items-center justify-center rounded-full border border-white/15 px-7 text-sm font-medium text-zinc-200 transition hover:border-white/30 hover:bg-white/5"
              >
                Depth in one example chain
              </a>
            </div>
            <p className="mt-8 text-sm text-zinc-500">
              Built for analysts who care about{" "}
              <span className="text-zinc-400">depth</span>,{" "}
              <span className="text-zinc-400">data integrity</span>, and{" "}
              <span className="text-zinc-400">usable graph UX</span>—not slide
              deck abstractions.
            </p>
          </div>

          <div className="relative">
            <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-sky-500/20 via-transparent to-violet-500/15 blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-white/[0.02] p-6 shadow-2xl">
              <div className="flex items-center justify-between text-xs text-zinc-500">
                <span>Illustrative tier sketch</span>
                <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-medium text-emerald-300/90">
                  HSN-anchored
                </span>
              </div>
              <div className="mt-6 space-y-4 font-mono text-[11px] leading-relaxed text-zinc-400 sm:text-xs">
                <div className="flex gap-3 rounded-lg border border-white/5 bg-black/30 p-3">
                  <span className="shrink-0 text-sky-400">T0</span>
                  <span>Anchor company — product slice from import history</span>
                </div>
                <div className="flex gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                  <span className="shrink-0 text-violet-300">T1</span>
                  <span>Direct suppliers & shippers tied to selected HSN</span>
                </div>
                <div className="flex gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                  <span className="shrink-0 text-amber-300/90">T2–T3</span>
                  <span>Sub-suppliers, materials, semi-finished inputs</span>
                </div>
                <div className="flex gap-3 rounded-lg border border-white/5 bg-black/20 p-3">
                  <span className="shrink-0 text-rose-300/80">T4+</span>
                  <span>Ore, concentrates, steel—where open data thins</span>
                </div>
              </div>
              <p className="mt-5 text-xs leading-relaxed text-zinc-500">
                Bonus layers in the vision: sanctions and ethics signals,
                environmental and geopolitical overlays, and concentration risk
                where geography dominates a tier.
              </p>
            </div>
          </div>
        </section>

        <section
          aria-label="Trust signals"
          className="border-y border-white/5 bg-white/[0.02]"
        >
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-8 text-center text-xs font-medium uppercase tracking-wider text-zinc-500 sm:px-6">
            <span>US customs-scale thinking</span>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <span>HS / HSN harmonization</span>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <span>Graph persistence</span>
            <span className="hidden h-4 w-px bg-white/10 sm:block" />
            <span>Map + risk dashboard</span>
          </div>
        </section>

        <section
          id="problem"
          className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24"
        >
          <div className="max-w-2xl">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Tier-1 lists are not enough
            </h2>
            <p className="mt-4 text-lg leading-relaxed text-zinc-400">
              Direct suppliers are table stakes. The fragile tail lives in
              sub-suppliers, traded intermediates, and raw materials—where
              compliance, geopolitics, and ESG exposure often surface first. When
              trade data exists in the open, it should be assembled into a
              coherent, product-specific network—not scattered spreadsheets.
            </p>
          </div>
        </section>

        <section
          id="features"
          className="border-t border-white/5 bg-white/[0.02] py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              What Synergy is designed to do
            </h2>
            <p className="mt-3 max-w-2xl text-zinc-400">
              Core requirements from the product vision: entity resolution, HSN
              anchoring, recursive traversal with intelligent pruning, and a
              graph that gets richer with every search.
            </p>
            <ul className="mt-12 grid gap-6 sm:grid-cols-3">
              {features.map((f) => (
                <li
                  key={f.title}
                  className="rounded-2xl border border-white/10 bg-[#05050a]/80 p-6"
                >
                  <h3 className="font-semibold text-white">{f.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-zinc-400">
                    {f.body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            How it works
          </h2>
          <ol className="mt-12 grid gap-8 sm:grid-cols-3">
            {steps.map((s) => (
              <li key={s.step} className="relative pl-0 sm:pl-2">
                <span className="font-mono text-xs text-sky-400/90">{s.step}</span>
                <h3 className="mt-2 font-semibold text-white">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {s.body}
                </p>
              </li>
            ))}
          </ol>
        </section>

        <section
          id="depth"
          className="border-t border-white/5 bg-gradient-to-b from-white/[0.03] to-transparent py-20 sm:py-24"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Depth without losing relevance
            </h2>
            <p className="mt-3 max-w-3xl text-zinc-400">
              The project narrative uses an EV traction motor thread to show how
              tiers chain from assemblies through copper and electrical steel to
              ore and mining inputs—exactly the kind of path Synergy is meant to
              surface when data allows.
            </p>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-white/10">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.04] text-xs uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3 font-medium">Tier</th>
                    <th className="px-4 py-3 font-medium">Example node</th>
                    <th className="px-4 py-3 font-medium">Region</th>
                    <th className="px-4 py-3 font-medium">HSN / theme</th>
                  </tr>
                </thead>
                <tbody className="text-zinc-300">
                  <tr className="border-b border-white/5">
                    <td className="px-4 py-3 font-mono text-sky-400">T0</td>
                    <td className="px-4 py-3">Anchor OEM</td>
                    <td className="px-4 py-3 text-zinc-500">USA</td>
                    <td className="px-4 py-3 text-zinc-400">
                      8501.53 — traction motors
                    </td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="px-4 py-3 font-mono text-violet-300">T1</td>
                    <td className="px-4 py-3">Motor & drive suppliers</td>
                    <td className="px-4 py-3 text-zinc-500">JP / US</td>
                    <td className="px-4 py-3 text-zinc-400">
                      Assemblies, stators, inverters
                    </td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="px-4 py-3 font-mono text-amber-300/90">T2–T3</td>
                    <td className="px-4 py-3">Magnet wire, silicon steel, refiners</td>
                    <td className="px-4 py-3 text-zinc-500">Global</td>
                    <td className="px-4 py-3 text-zinc-400">
                      7408.x copper wire · 7225.x electrical steel
                    </td>
                  </tr>
                  <tr className="border-b border-white/5">
                    <td className="px-4 py-3 font-mono text-rose-300/80">T4</td>
                    <td className="px-4 py-3">Ore & concentrates</td>
                    <td className="px-4 py-3 text-zinc-500">CL / AU / …</td>
                    <td className="px-4 py-3 text-zinc-400">2603.00 — copper ore</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 font-mono text-zinc-500">T5–T6</td>
                    <td className="px-4 py-3">
                      Mining equipment, reagents, industrial gases, fuels
                    </td>
                    <td className="px-4 py-3 text-zinc-500">Global</td>
                    <td className="px-4 py-3 text-zinc-400">
                      Furthest upstream resolvable tier in open data
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-4 text-xs text-zinc-500">
              Rows are illustrative of the tiering concept described in project
              context; not live trade assertions on this page.
            </p>
          </div>
        </section>

        <section id="faq" className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-24">
          <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            FAQ
          </h2>
          <dl className="mt-10 space-y-8 max-w-3xl">
            {faqs.map((item) => (
              <div key={item.q}>
                <dt className="font-semibold text-white">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-zinc-400">
                  {item.a}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section
          id="cta"
          className="border-t border-white/10 bg-gradient-to-t from-sky-950/40 to-transparent py-20 sm:py-28"
        >
          <div className="mx-auto max-w-6xl px-4 text-center sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Ready to explore the graph?
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-zinc-400">
              Jump into the interactive graph and map on the dashboard, or use
              this page as the narrative anchor for judges and stakeholders.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex h-12 w-full min-h-[48px] max-w-xs items-center justify-center rounded-full bg-sky-500 px-8 text-sm font-semibold text-slate-950 transition hover:bg-sky-400 sm:w-auto"
              >
                Open the knowledge brain
              </Link>
              <a
                href="#features"
                className="text-sm font-medium text-sky-300/90 underline-offset-4 hover:underline"
              >
                Review capabilities again
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/5 py-10 text-center text-xs text-zinc-600">
        <p>Synergy — recursive supply chain reconstruction (project context).</p>
        <p className="mt-2">
          <Link href="/dashboard" className="text-zinc-500 hover:text-zinc-400">
            Dashboard
          </Link>
          <span className="mx-2 text-zinc-700">·</span>
          <span className="text-zinc-600">Home is this page · App lives at /dashboard</span>
        </p>
      </footer>
    </div>
  );
}
