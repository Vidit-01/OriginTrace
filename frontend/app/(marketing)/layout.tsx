import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "GLOBALTRACE — Synergy",
  description:
    "Identify origin nodes, trace supply routes, and map raw material dependencies across the global grid.",
};

/** Inherits Plus Jakarta Sans from root `layout.tsx` (`font-sans` / `--font-plus-jakarta`). */
export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="fixed inset-0 z-[100] overflow-x-hidden overflow-y-auto overscroll-contain bg-[#05070A] font-sans text-zinc-100 antialiased [text-rendering:optimizeLegibility]">
      {children}
    </div>
  );
}
