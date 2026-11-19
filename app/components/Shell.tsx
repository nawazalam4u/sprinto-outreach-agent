"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Drawer from "./Drawer";
import { StoreProvider, useStore } from "./store";

const NAV = [
  ["/", "Home"],
  ["/run", "Run"],
  ["/accounts", "Accounts"],
  ["/pipeline", "Pipeline"],
  ["/icp", "ICP"],
  ["/brief", "Brief"],
] as const;

function Theme() {
  const [t, setT] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    try {
      const v = localStorage.getItem("theme") as "light" | "dark" | null;
      if (v) {
        document.documentElement.dataset.theme = v;
        setT(v);
      }
    } catch {}
  }, []);
  const toggle = () => {
    const dark = t ? t === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    const next = dark ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    setT(next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  };
  return (
    <button className="theme-btn" onClick={toggle} aria-label="Switch light or dark theme">
      ◐
    </button>
  );
}

function SampleBanner() {
  const { isSample } = useStore();
  if (!isSample) return null;
  return (
    <div style={{ background: "var(--paper-2)", borderBottom: "1px solid var(--rule)" }}>
      <div className="wrap small" style={{ padding: "8px 24px" }}>
        Showing an example run so the pages are not empty. <Link href="/run">Run your own domains</Link>: your first run replaces it.
      </div>
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <StoreProvider>
      <a href="#main" className="sr">
        Skip to content
      </a>
      <header className="top">
        <div className="wrap">
          <Link href="/" className="mark" aria-label="Sprinto Outreach Agent, home">
            <i aria-hidden />
            <span>Sprinto Outreach</span>
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map(([href, label]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
                {label}
              </Link>
            ))}
          </nav>
          <Theme />
        </div>
      </header>
      <SampleBanner />
      <main id="main">
        <div className="wrap">{children}</div>
      </main>
      <footer className="foot">
        <div className="wrap">
          <span>Sprinto Outreach Agent · MESA C4 Term 2 · Case 02</span>
          <span>Every email goes to the builder&apos;s own inbox only. Prospects are never contacted.</span>
        </div>
      </footer>
      <Drawer />
    </StoreProvider>
  );
}
