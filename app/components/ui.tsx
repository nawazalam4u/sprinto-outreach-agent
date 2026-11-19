"use client";

import { useEffect, useRef } from "react";
import type { CompanyResult, Status, Verdict } from "@/lib/types";
import { IAlert, IBolt, ICheck, IEye, ILock, IMail, IShield, ISpark, IStar, ITarget, ITrophy, STEP_ICONS } from "./Icons";

export const STEP_NAMES = ["Scrape", "Extract", "Qualify", "Person", "Pains", "Email", "Send"];

export const VERDICT_LABEL: Record<Verdict, string> = {
  PRIORITY: "Priority",
  QUALIFY: "Qualify",
  NURTURE: "Nurture",
  REJECT: "Reject",
  DISQUALIFIED: "Disqualified",
  INSUFFICIENT_DATA: "Insufficient data",
};
export const VERDICT_TONE: Record<Verdict, string> = {
  PRIORITY: "t-go",
  QUALIFY: "t-go",
  NURTURE: "t-wait",
  REJECT: "t-muted",
  DISQUALIFIED: "t-stop",
  INSUFFICIENT_DATA: "t-hold",
};
export const STATUS_LABEL: Record<Status, string> = {
  running: "Running",
  sent: "Sent",
  held: "Held",
  drafted: "Drafted",
  not_qualified: "Not qualified",
  insufficient_data: "Needs a look",
  no_contact: "No contact",
  failed: "Failed",
};
export const STATUS_TONE: Record<Status, string> = {
  running: "t-info",
  sent: "t-go",
  held: "t-warn",
  drafted: "t-info",
  not_qualified: "t-muted",
  insufficient_data: "t-hold",
  no_contact: "t-wait",
  failed: "t-stop",
};

export function VerdictPill({ v }: { v: Verdict | null }) {
  if (!v) return <span className="pill t-muted">Pending</span>;
  return <span className={`pill ${VERDICT_TONE[v]}`}>{VERDICT_LABEL[v]}</span>;
}
export function StatusPill({ s }: { s: Status }) {
  return <span className={`pill ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}</span>;
}

// Stamp: the one-word outcome, like a rubber stamp on the card.
export function stampFor(r: CompanyResult): { text: string; color: string } | null {
  const s = r.state;
  if (s.status === "sent") return { text: "SENT", color: "var(--go)" };
  if (s.status === "held") return { text: "HELD", color: "var(--warn)" };
  if (s.status === "drafted") return { text: "DRAFTED", color: "var(--info)" };
  if (r.gates.some((g) => g.status === "fail" && /vendor/i.test(g.detail))) return { text: "RIVAL", color: "var(--stop)" };
  if (s.compliance_tool === "Sprinto") return { text: "CUSTOMER", color: "var(--hold)" };
  if (s.compliance_tool) return { text: `ON ${s.compliance_tool.toUpperCase()}`, color: "var(--stop)" };
  if (s.verdict === "DISQUALIFIED") return { text: "OUT", color: "var(--stop)" };
  if (s.verdict === "NURTURE") return { text: "NURTURE", color: "var(--wait)" };
  if (s.status === "insufficient_data") return { text: "CHECK", color: "var(--hold)" };
  return null;
}

export const ringColor = (score: number) => (score >= 75 ? "var(--go)" : score >= 60 ? "#2fa46b" : score >= 40 ? "var(--mango)" : "var(--coral)");

// Score ring: 0-100 with the 60 decision line as a tick. Dark arc = proven points, pale = unknown range.
export function ScoreRing({ low, high, size = 64, dark = false, label = "score" }: { low: number | null; high: number | null; size?: number; dark?: boolean; label?: string }) {
  const sw = Math.max(6, size / 10);
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const lo = low ?? 0;
  const hi = high ?? lo;
  const tickA = 0.6 * 2 * Math.PI; // svg is rotated -90deg, so 0 rad = 12 o'clock
  const cx = size / 2;
  const t1 = { x: cx + Math.cos(tickA) * (r - sw * 0.9), y: cx + Math.sin(tickA) * (r - sw * 0.9) };
  const t2 = { x: cx + Math.cos(tickA) * (r + sw * 0.9), y: cx + Math.sin(tickA) * (r + sw * 0.9) };
  return (
    <div className="ring" style={{ width: size, height: size }} role="img" aria-label={low == null ? "No score" : `Score ${lo}${hi !== lo ? ` to ${hi}` : ""} out of 100; qualify line 60`}>
      <svg width={size} height={size} style={{ overflow: "visible" }}>
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={dark ? "rgba(246,241,230,.14)" : "var(--muted-bg)"} strokeWidth={sw} />
        {hi > lo && <circle cx={cx} cy={cx} r={r} fill="none" stroke="var(--lilac)" strokeOpacity={0.55} strokeWidth={sw} strokeDasharray={c} strokeDashoffset={c * (1 - hi / 100)} strokeLinecap="round" />}
        <circle cx={cx} cy={cx} r={r} fill="none" stroke={ringColor(lo)} strokeWidth={sw} strokeDasharray={c} strokeDashoffset={c * (1 - lo / 100)} strokeLinecap="round" />
        <line x1={t1.x} y1={t1.y} x2={t2.x} y2={t2.y} stroke="var(--coral)" strokeWidth={2.5} />
      </svg>
      <div className="v" style={{ color: dark ? "var(--on-night)" : "var(--ink)" }}>
        <div>
          <b style={{ fontSize: size * 0.3 }}>{low == null ? "–" : lo}</b>
          {size >= 80 && <small>{hi !== lo ? `to ${hi}` : label}</small>}
        </div>
      </div>
    </div>
  );
}

// 7-node journey for one company
export function Journey({ steps, dark = false, details = false }: { steps: Record<number, { status: string; detail?: string }>; dark?: boolean; details?: boolean }) {
  return (
    <ol className={`journey ${dark ? "dark" : ""}`} style={{ listStyle: "none", padding: 0 }}>
      {STEP_NAMES.map((n, k) => {
        const s = steps[k + 1];
        const Icon = STEP_ICONS[k];
        return (
          <li key={n} className={`js ${s?.status ?? ""}`}>
            <i>{s?.status === "done" ? <ICheck /> : <Icon />}</i>
            {n}
            {details && s?.detail && <span className="d">{s.detail.slice(0, 90)}</span>}
          </li>
        );
      })}
    </ol>
  );
}

// Reconstruct the journey from a finished result
export function stepsFromResult(r: CompanyResult): Record<number, { status: string }> {
  const s = r.state;
  const st: Record<number, { status: string }> = {};
  const scraped = r.pages[0]?.ok;
  st[1] = { status: scraped ? "done" : "error" };
  if (!scraped) return { ...st, 2: { status: "skipped" }, 3: { status: "skipped" }, 4: { status: "skipped" }, 5: { status: "skipped" }, 6: { status: "skipped" }, 7: { status: "skipped" } };
  st[2] = { status: "done" };
  st[3] = { status: s.verdict ? "done" : "error" };
  const q = s.verdict === "PRIORITY" || s.verdict === "QUALIFY";
  st[4] = { status: !q ? "skipped" : r.poc ? "done" : "error" };
  st[5] = { status: r.painPoints.length ? "done" : "skipped" };
  st[6] = { status: r.draft ? (r.draft.passed ? "done" : "error") : "skipped" };
  st[7] = { status: s.status === "sent" ? "done" : s.status === "held" ? "error" : "skipped" };
  return st;
}

export function JDots({ r }: { r: CompanyResult }) {
  const st = stepsFromResult(r);
  return (
    <div className="jdots" aria-label="Pipeline progress">
      {STEP_NAMES.map((n, i) => (
        <span key={n} className={st[i + 1]?.status} title={`${n}: ${st[i + 1]?.status}`} />
      ))}
    </div>
  );
}

const AV_COLORS = ["#5b40b8", "#1d7f53", "#b5441f", "#2f5fae", "#8c5b00", "#9d1f33", "#2d2968"];
export function Avatar({ name, lg = false }: { name: string; lg?: boolean }) {
  const ini = name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const c = AV_COLORS[[...name].reduce((a, ch) => a + ch.charCodeAt(0), 0) % AV_COLORS.length];
  return <span className={`av ${lg ? "lg" : ""}`} style={{ background: c }} aria-hidden>{ini}</span>;
}

// Achievements: earned per account, rolled up per run
export type Badge = { key: string; name: string; desc: string; Icon: (p: { className?: string }) => React.ReactElement };
export const BADGES: Badge[] = [
  { key: "fact", name: "Fact checker", desc: "Every fact used is quoted word-for-word from a real page.", Icon: IEye },
  { key: "detective", name: "Detective", desc: "The agent loop overturned what the homepage alone said.", Icon: ITarget },
  { key: "gate", name: "Gatekeeper", desc: "Kept a rival vendor or an existing Sprinto customer out of the inbox.", Icon: ILock },
  { key: "sharp", name: "Sharpshooter", desc: "An email scored 8/10 or more with the reviewer.", Icon: IStar },
  { key: "sent", name: "Inbox hit", desc: "A checked email landed in your inbox.", Icon: IMail },
  { key: "honest", name: "No bluffing", desc: "A draft with an unsupported claim was held, not sent.", Icon: IShield },
  { key: "speed", name: "Speedrun", desc: "Researched a company in under 2 minutes (vs 15-20 by hand).", Icon: IBolt },
  { key: "polite", name: "Good citizen", desc: "Respected a site's robots.txt or block instead of forcing it.", Icon: ISpark },
];
export function earned(list: CompanyResult[]): Set<string> {
  const e = new Set<string>();
  for (const r of list) {
    if (r.facts.length && r.facts.filter((f) => f.via === "model").every((f) => f.verified || !f.quote)) e.add("fact");
    if (r.state.fixed_verdict && r.state.verdict && r.state.fixed_verdict !== r.state.verdict) e.add("detective");
    if (r.state.compliance_tool || r.gates.some((g) => g.status === "fail" && /rival|Sprinto/.test(g.name))) e.add("gate");
    if ((r.draft?.review?.avg ?? 0) >= 8 && r.draft?.passed) e.add("sharp");
    if (r.state.status === "sent") e.add("sent");
    if (r.draft?.attempts.some((a) => a.review?.unsupported?.length)) e.add("honest");
    if ((r.ms ?? 1e9) < 120000) e.add("speed");
    if (r.pages.some((p) => p.outcome === "ROBOTS" || p.outcome === "BLOCKED")) e.add("polite");
  }
  return e;
}

export function BadgeShelf({ list }: { list: CompanyResult[] }) {
  const e = earned(list);
  return (
    <div className="badges" aria-label={`${e.size} of ${BADGES.length} badges earned`}>
      {BADGES.map((b) => (
        <div key={b.key} className={`badge ${e.has(b.key) ? "on" : ""}`} tabIndex={0} aria-label={`${b.name}: ${e.has(b.key) ? "earned" : "locked"}. ${b.desc}`}>
          <b.Icon />
          <span className="tip" role="tooltip">
            <b>{b.name}</b>
            {b.desc}
            {!e.has(b.key) && <em className="s"> · locked</em>}
          </span>
        </div>
      ))}
    </div>
  );
}

export function Reveal({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!("IntersectionObserver" in window)) {
      el.classList.add("in");
      return;
    }
    const io = new IntersectionObserver(
      (es) => es.forEach((x) => {
        if (x.isIntersecting) {
          x.target.classList.add("in");
          io.unobserve(x.target);
        }
      }),
      { threshold: 0.08 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return <section ref={ref} className={`reveal sec ${className}`}>{children}</section>;
}

export const fmtMs = (ms?: number) => (ms == null ? "–" : ms < 60000 ? `${Math.round(ms / 1000)} s` : `${(ms / 60000).toFixed(1)} min`);

export function Confetti() {
  const colors = ["var(--mango)", "var(--coral)", "var(--mint)", "var(--lilac)", "var(--sky)"];
  return (
    <div className="confetti" aria-hidden>
      {Array.from({ length: 26 }).map((_, i) => (
        <i key={i} style={{ left: `${(i * 37) % 100}%`, background: colors[i % colors.length], animationDelay: `${(i % 7) * 0.08}s` }} />
      ))}
    </div>
  );
}

export { IAlert, ITrophy };
