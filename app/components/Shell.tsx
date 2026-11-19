"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import Drawer from "./Drawer";
import { IBook, ICols, IGrid, IHome, IPlay, ITarget } from "./Icons";
import { StoreProvider, useStore } from "./store";

const NAV = [
  ["/", "Home", IHome],
  ["/run", "Run", IPlay],
  ["/accounts", "Prospects", IGrid],
  ["/pipeline", "Pipeline", ICols],
  ["/icp", "ICP", ITarget],
  ["/brief", "Brief", IBook],
] as const;

export function Logo() {
  return (
    <svg viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#f6b545" />
      <path d="M20 8l10 4v7c0 6.5-4.3 10.5-10 12-5.7-1.5-10-5.5-10-12v-7z" fill="#17153b" />
      <path d="M15 20l3.5 3.5L26 16" stroke="#f6b545" strokeWidth="3" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Health() {
  const [h, setH] = useState<{ gemini: boolean; hunter: boolean; email: boolean } | null>(null);
  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setH).catch(() => {});
  }, []);
  if (!h) return null;
  return (
    <div className="health" aria-label="Connected services">
      <span><i className={`dot ${h.gemini ? "on" : ""}`} />AI</span>
      <span><i className={`dot ${h.hunter ? "on" : ""}`} />Hunter</span>
      <span><i className={`dot ${h.email ? "on" : ""}`} />Email</span>
    </div>
  );
}

function SampleBanner() {
  const { isSample } = useStore();
  if (!isSample) return null;
  return (
    <div className="notice-bar">
      You are looking at a real example run (emails masked). <Link href="/run">Run your own domains</Link>; your first run replaces it.
    </div>
  );
}

export default function Shell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <StoreProvider>
      <a href="#main" className="sr">Skip to content</a>
      <header className="top">
        <div className="bar">
          <Link href="/" className="brand" aria-label="Sprinto Outreach, home">
            <Logo />
            <b>Prospect Quest</b>
            <small>Sprinto outreach agent</small>
          </Link>
          <nav className="nav" aria-label="Main">
            {NAV.map(([href, label, Icon]) => (
              <Link key={href} href={href} aria-current={path === href ? "page" : undefined}>
                <Icon />
                {label}
              </Link>
            ))}
          </nav>
          <Health />
        </div>
      </header>
      <div className="sheet">
        <SampleBanner />
        <main id="main">
          <div className="wrap">{children}</div>
        </main>
      </div>
      <footer className="foot">
        <div className="wrap">
          <span>Prospect Quest · Sprinto cold-outreach agent · MESA C4 Term 2 · Case 02</span>
          <span>Every email goes to the builder&apos;s own inbox only. Prospects are never contacted.</span>
        </div>
      </footer>
      <Drawer />
    </StoreProvider>
  );
}
