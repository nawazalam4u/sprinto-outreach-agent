"use client";

import { useEffect, useRef } from "react";
import type { CompanyResult, Status, Verdict } from "@/lib/types";

export const VERDICT_LABEL: Record<Verdict, string> = {
  PRIORITY: "Priority",
  QUALIFY: "Qualify",
  NURTURE: "Nurture",
  REJECT: "Reject",
  DISQUALIFIED: "Disqualified",
  INSUFFICIENT_DATA: "Insufficient data",
};
export const STATUS_LABEL: Record<Status, string> = {
  running: "Running",
  sent: "Sent",
  held: "Held",
  drafted: "Drafted",
  not_qualified: "Not qualified",
  insufficient_data: "Insufficient data",
  no_contact: "No contact",
  failed: "Failed",
};

export function VerdictPill({ v }: { v: Verdict | null }) {
  if (!v) return <span className="pill">—</span>;
  const tone = v === "PRIORITY" || v === "QUALIFY" ? "go" : v === "NURTURE" || v === "INSUFFICIENT_DATA" ? "warn" : "no";
  return <span className={`pill ${tone}`}>{VERDICT_LABEL[v]}</span>;
}

export function StatusPill({ s }: { s: Status }) {
  const tone = s === "sent" ? "go" : s === "held" || s === "insufficient_data" || s === "no_contact" || s === "drafted" ? "warn" : s === "failed" ? "no" : "info";
  return <span className={`pill ${tone}`}>{STATUS_LABEL[s]}</span>;
}

export function Score({ r }: { r: CompanyResult }) {
  const { score_low: lo, score_high: hi } = r.state;
  if (lo == null) return <span className="muted">—</span>;
  return <span className="num">{lo === hi ? lo : `${lo}–${hi}`}</span>;
}

// Score range drawn to scale on 0-100 with the 60 decision line.
export function RangeBar({ low, high, label }: { low: number; high: number; label?: string }) {
  return (
    <div aria-label={label ?? `Score ${low} to ${high} out of 100, decision line at 60`} role="img" className="bar-track" style={{ height: 14 }}>
      <div className="range" style={{ left: `${low}%`, width: `${Math.max(1, high - low)}%` }} />
      <div className="bar" style={{ width: `${low}%`, opacity: 0.85 }} />
      <div className="line60" style={{ left: "60%" }} />
    </div>
  );
}

export function Reveal({ children, as: Tag = "section" }: { children: React.ReactNode; as?: "section" | "div" }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (es) => es.forEach((e) => e.isIntersecting && (e.target.classList.add("in"), io.unobserve(e.target))),
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <Tag ref={ref as never} className="reveal">{children}</Tag>;
}

export const fmtMs = (ms?: number) => (ms == null ? "—" : ms < 60000 ? `${Math.round(ms / 1000)} s` : `${(ms / 60000).toFixed(1)} min`);
