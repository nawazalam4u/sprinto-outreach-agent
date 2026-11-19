"use client";

import Link from "next/link";
import { useLink, useStore } from "./components/store";
import { RangeBar, Reveal, VERDICT_LABEL, fmtMs } from "./components/ui";
import type { CompanyResult } from "@/lib/types";

const MANUAL_MIN = 17.5; // midpoint of the case's 15-20 minutes per company

function Overturn({ r }: { r: CompanyResult }) {
  const link = useLink(r.domain);
  const s = r.state;
  return (
    <div {...link} tabIndex={0} role="button" className={`card ${link.className}`} style={{ padding: "16px 4px" }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <b style={{ fontWeight: 500 }}>{s.company_name ?? r.domain}</b>
        <span className="small">
          <span className="muted">{s.fixed_verdict ? VERDICT_LABEL[s.fixed_verdict] : ""}</span> → <b style={{ fontWeight: 500 }}>{s.verdict ? VERDICT_LABEL[s.verdict] : ""}</b>
        </span>
      </div>
      <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
        <div className="small muted">Homepage only: {s.fixed_low}–{s.fixed_high}</div>
        <RangeBar low={s.fixed_low ?? 0} high={s.fixed_high ?? 0} />
        <div className="small muted">After {r.loop.length} tool call{r.loop.length === 1 ? "" : "s"}: {s.score_low}–{s.score_high}</div>
        <RangeBar low={s.score_low ?? 0} high={s.score_high ?? 0} />
      </div>
    </div>
  );
}

function NeedRow({ r, why }: { r: CompanyResult; why: string }) {
  const link = useLink(r.domain);
  return (
    <li>
      <button className={`card ${link.className}`} onClick={link.onClick} onMouseEnter={link.onMouseEnter} onMouseLeave={link.onMouseLeave} onFocus={link.onFocus} onBlur={link.onBlur}>
        <span className="t">{r.state.company_name ?? r.domain}</span> <span className="s">· {why}</span>
      </button>
    </li>
  );
}

export default function Home() {
  const { list, ready } = useStore();
  if (!ready) return null;
  const n = list.length;
  if (!n)
    return (
      <div className="story">
        <section>
          <h1 className="display">
            Research a prospect in <em>a minute</em>, not twenty.
          </h1>
          <p className="lede">Give it a list of domains. It reads each site, decides whether the company fits Sprinto, finds the right person, and sends a cited email to your own inbox.</p>
          <p style={{ marginTop: 32 }}>
            <Link className="btn" href="/run">Run your first list</Link>
          </p>
        </section>
      </div>
    );

  const timed = list.filter((r) => r.ms);
  const avgMs = timed.reduce((s, r) => s + (r.ms ?? 0), 0) / Math.max(1, timed.length);
  const avgMin = avgMs / 60000;
  const saved = Math.max(0, n * MANUAL_MIN - (n * avgMs) / 60000);

  const overturned = list.filter((r) => r.state.fixed_verdict && r.state.verdict && r.state.fixed_verdict !== r.state.verdict);
  const loopCalls = list.reduce((s, r) => s + r.loop.length, 0);

  const passedGates = list.filter((r) => r.gates.length && !r.gates.some((g) => g.status === "fail"));
  const qualified = list.filter((r) => r.state.verdict === "PRIORITY" || r.state.verdict === "QUALIFY");
  const withPoc = qualified.filter((r) => r.poc);
  const passedEmail = withPoc.filter((r) => r.draft?.passed);
  const sent = list.filter((r) => r.state.status === "sent");
  const funnel = [
    { label: "Researched", v: n, drop: "" },
    { label: "Passed the hard gates", v: passedGates.length, drop: dropReasons(list.filter((r) => !passedGates.includes(r)), (r) => {
      const g = r.gates.find((x) => x.status === "fail");
      if (g) return /software/.test(g.name) ? "Not B2B software" : /rival|Sprinto/.test(g.name) ? (/Sprinto customer/.test(g.detail) ? "Already a Sprinto customer" : "Uses a rival tool or is one") : "Outside the size band";
      return r.pages[0]?.outcome && r.pages[0].outcome !== "OK" ? `Site unreadable (${r.pages[0].outcome.toLowerCase()})` : "Unclear what they sell";
    }) },
    { label: "Scored 60+ (qualified)", v: qualified.length, drop: dropReasons(passedGates.filter((r) => !qualified.includes(r)), (r) => (r.state.verdict ? VERDICT_LABEL[r.state.verdict] : "—")) },
    { label: "Named person found", v: withPoc.length, drop: qualified.length - withPoc.length ? `${qualified.length - withPoc.length} with no named decision-maker` : "" },
    { label: "Email passed every check", v: passedEmail.length, drop: withPoc.length - passedEmail.length ? `${withPoc.length - passedEmail.length} held` : "" },
    { label: "Sent to my inbox", v: sent.length, drop: passedEmail.length - sent.length ? `${passedEmail.length - sent.length} drafted, not sent` : "" },
  ];

  const emails = list.filter((r) => r.draft);
  const held = emails.filter((r) => !r.draft!.passed);
  const reviewed = emails.filter((r) => r.draft?.review);
  const avgReview = reviewed.reduce((s, r) => s + (r.draft!.review!.avg ?? 0), 0) / Math.max(1, reviewed.length);

  const needs: { r: CompanyResult; why: string }[] = [
    ...held.map((r) => ({ r, why: "email held: no draft passed the checks" })),
    ...list.filter((r) => r.state.status === "drafted").map((r) => ({ r, why: "passed, waiting for you to send" })),
    ...list.filter((r) => r.state.status === "no_contact").map((r) => ({ r, why: "qualified, but no named person found" })),
    ...list.filter((r) => r.state.status === "insufficient_data" || r.state.status === "failed").map((r) => ({ r, why: r.pages[0]?.outcome && r.pages[0].outcome !== "OK" ? `site unreadable (${r.pages[0].outcome})` : "not enough evidence either way" })),
    ...sent.filter((r) => r.review?.replied === undefined).map((r) => ({ r, why: "sent: log whether they replied" })),
  ];

  return (
    <div className="story">
      <section>
        <h1 className="display">
          {n} {n === 1 ? "company" : "companies"} researched at <em>{fmtMs(avgMs)}</em> each.
        </h1>
        <p className="lede">The Growth Lead takes 15 to 20 minutes per company by hand. Same research, every decision written down with its evidence.</p>
        <div style={{ display: "grid", gap: 14, marginTop: 40, maxWidth: 720 }}>
          <div>
            <div className="row small" style={{ justifyContent: "space-between" }}><span>By hand (case brief)</span><span className="num">{MANUAL_MIN} min</span></div>
            <div className="bar-track"><div className="bar" style={{ width: "100%", background: "var(--rule-strong)" }} /></div>
          </div>
          <div>
            <div className="row small" style={{ justifyContent: "space-between" }}><span>This system, average of {timed.length}</span><span className="num">{avgMin.toFixed(1)} min</span></div>
            <div className="bar-track"><div className="bar shu" style={{ width: `${Math.max(0.8, (avgMin / MANUAL_MIN) * 100)}%` }} /></div>
          </div>
          <p className="small muted" style={{ margin: 0 }}>Bars drawn to scale. About {Math.round(saved)} minutes of research saved across these {n}.</p>
        </div>
      </section>

      <Reveal>
        <div className="claim">
          <div className="say">
            <h2 className="sec">Reading one page is not enough.</h2>
            <p>
              A fixed pipeline judges from the homepage alone. The agent loop kept researching while the 60 line sat inside the score range: {loopCalls} tool calls across {n} companies,{" "}
              <b>{overturned.length} verdict{overturned.length === 1 ? "" : "s"} changed</b>.
            </p>
          </div>
          <div>
            {overturned.length ? overturned.slice(0, 5).map((r) => <Overturn key={r.domain} r={r} />) : <p className="muted">No verdict changed in this set: the homepage was already decisive for each one.</p>}
            <p className="small muted">Dark = proven points · pale band = still unknown · red line = 60.</p>
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="claim">
          <div className="say">
            <h2 className="sec">Most companies should not get an email.</h2>
            <p>{n} in, {sent.length} sent. Each drop has a written reason, so the Growth Lead can disagree with a specific rule rather than a feeling.</p>
          </div>
          <div style={{ display: "grid", gap: 16 }}>
            {funnel.map((f) => (
              <div key={f.label}>
                <div className="row small" style={{ justifyContent: "space-between" }}><span>{f.label}</span><span className="num">{f.v}</span></div>
                <div className="bar-track"><div className="bar" style={{ width: `${(f.v / n) * 100}%` }} /></div>
                {f.drop && <div className="small muted">Dropped: {f.drop}</div>}
              </div>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="claim">
          <div className="say">
            <h2 className="sec">Nothing unchecked goes out.</h2>
            <p>
              Every draft must pass 16 rules in code, then an AI reviewer scoring 7 or more out of 10. {emails.length - held.length} passed, {held.length} held. Average reviewer score{" "}
              <b>{reviewed.length ? avgReview.toFixed(1) : "—"}/10</b>.
            </p>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {emails.length === 0 && <p className="muted">No emails written yet.</p>}
            {emails.map((r) => (
              <div key={r.domain}>
                <div className="row small" style={{ justifyContent: "space-between" }}>
                  <span>{r.state.company_name ?? r.domain} <span className="muted">· {r.draft!.passed ? (r.state.status === "sent" ? "sent" : "passed") : "held"}</span></span>
                  <span className="num">{r.draft!.review ? `${r.draft!.review.avg}/10` : "—"}</span>
                </div>
                <div className="bar-track" style={{ height: 6 }}>
                  <div className={`bar ${r.draft!.passed ? "" : "shu"}`} style={{ width: `${(r.draft!.review?.avg ?? 0) * 10}%` }} />
                  <div className="line60" style={{ left: "70%" }} />
                </div>
              </div>
            ))}
            {emails.length > 0 && <p className="small muted">Red line = 7/10, the reviewer pass line.</p>}
          </div>
        </div>
      </Reveal>

      <Reveal>
        <div className="claim">
          <div className="say">
            <h2 className="sec">What needs you.</h2>
            <p>The system decides everything it can. These are the {needs.length} places where a human adds something it cannot.</p>
          </div>
          <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
            {needs.length ? needs.map((x, i) => <NeedRow key={x.r.domain + i} r={x.r} why={x.why} />) : <li className="muted">Nothing waiting.</li>}
          </ul>
        </div>
      </Reveal>
    </div>
  );
}

function dropReasons(rs: CompanyResult[], key: (r: CompanyResult) => string) {
  if (!rs.length) return "";
  const m = new Map<string, number>();
  for (const r of rs) m.set(key(r), (m.get(key(r)) ?? 0) + 1);
  return [...m.entries()].map(([k, v]) => `${v} ${k.toLowerCase()}`).join(" · ");
}
