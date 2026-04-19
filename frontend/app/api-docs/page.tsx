import Link from "next/link";

export default function ApiDocsPage() {
  return (
    <div className="font-sans min-h-screen bg-[#05070A] px-6 py-16 text-[#e4e4e7]">
      <div className="mx-auto max-w-2xl">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.3em] text-[#FF00E5]/85">
          GLOBALTRACE / API
        </p>
        <h1 className="font-melodrama mt-4 text-3xl font-medium tracking-tight text-white">
          API reference
        </h1>
        <p className="mt-6 leading-relaxed text-[#a0a0a0]">
          Placeholder for REST endpoints — e.g.{" "}
          <code className="rounded bg-white/5 px-1.5 py-0.5 font-mono text-[0.85em] text-[#00F2FF]">
            GET /company/{"{name}"}
          </code>
          . Link your Swagger / Scalar docs when ready.
        </p>
        <Link
          href="/"
          className="mt-10 inline-block text-sm text-[#00F2FF] underline-offset-4 hover:underline"
        >
          ← Back to GLOBALTRACE
        </Link>
      </div>
    </div>
  );
}
