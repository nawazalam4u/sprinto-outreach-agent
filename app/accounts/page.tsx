"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLink, useStore } from "../components/store";
import { ISearch } from "../components/Icons";
import { Avatar, JDots, ScoreRing, StatusPill, VerdictPill, VERDICT_LABEL, ringColor, stampFor } from "../components/ui";
import type { CompanyResult } from "@/lib/types";

const FILTERS = [
  ["all", "All"],
  ["sent", "Sent"],
  ["qualified", "Qualified"],
  ["held", "Held"],
  ["out", "Kept out"],
  ["look", "Needs a look"],
] as const;
type F = (typeof FILTERS)[number][0];

const match = (r: CompanyResult, f: F) =>
  f === "all" ||
  (f === "sent" && r.state.status === "sent") ||
  (f === "qualified" && (r.state.verdict === "QUALIFY" || r.state.verdict === "PRIORITY")) ||
  (f === "held" && r.state.status === "held") ||
  (f === "out" && ["DISQUALIFIED", "REJECT", "NURTURE"].includes(r.state.verdict ?? "")) ||
  (f === "look" && ["insufficient_data", "failed", "no_contact"].includes(r.state.status));

function Card({ r }: { r: CompanyResult }) {
  const link = useLink(r.domain);
  const st = stampFor(r);
  const headline = r.reasons[0] ?? r.error ?? "";
  return (
    <button className={`pcard ${link.className}`} onClick={link.onClick} onMouseEnter={link.onMouseEnter} onMouseLeave={link.onMouseLeave} onFocus={link.onFocus} onBlur={link.onBlur} aria-label={`Open ${r.state.company_name ?? r.domain}`}>
      <span className="band" style={{ background: r.state.score_low != null ? ringColor(r.state.score_low) : "var(--line)" }} />
      {st && <span className="stamp" style={{ color: st.color }}>{st.text}</span>}
      <span className="tr">
        <ScoreRing low={r.state.score_low} high={r.state.score_high} size={52} />
        <span>
          <h3>{r.state.company_name ?? r.domain}</h3>
          <span className="meta">{r.domain}</span>
        </span>
      </span>
      <span className="row" style={{ marginTop: 10 }}>
        <VerdictPill v={r.state.verdict} />
        {r.state.fixed_verdict && r.state.verdict && r.state.fixed_verdict !== r.state.verdict && <span className="pill t-hold">loop flipped it</span>}
      </span>
      {headline && <span className="hl-line" style={{ display: "block" }}>{headline.length > 150 ? headline.slice(0, 150) + "…" : headline}</span>}
      <JDots r={r} />
      {r.poc && (
        <span className="who">
          <Avatar name={r.poc.name} />
          <span>
            <b>{r.poc.name}</b>
            <span className="small muted" style={{ display: "block" }}>{r.poc.title}</span>
          </span>
        </span>
      )}
    </button>
  );
}

function Row({ r }: { r: CompanyResult }) {
  const link = useLink(r.domain);
  return (
    <tr tabIndex={0} {...link} style={{ cursor: "pointer", background: link.className ? "var(--cream)" : undefined }}>
      <td><b>{r.state.company_name ?? r.domain}</b><div className="small muted">{r.domain}</div></td>
      <td><VerdictPill v={r.state.verdict} /></td>
      <td className="r num">{r.state.score_low == null ? "–" : r.state.score_low === r.state.score_high ? r.state.score_low : `${r.state.score_low}–${r.state.score_high}`}</td>
      <td className="small hide-m">{r.poc ? `${r.poc.name} · ${r.poc.title}` : <span className="muted">–</span>}</td>
      <td><StatusPill s={r.state.status} /></td>
      <td className="small muted hide-m">{r.state.fixed_verdict && r.state.verdict && r.state.fixed_verdict !== r.state.verdict ? `${VERDICT_LABEL[r.state.fixed_verdict]} → ${VERDICT_LABEL[r.state.verdict]}` : "–"}</td>
    </tr>
  );
}

export default function Accounts() {
  const { list, ready, clearAll, isSample } = useStore();
  const [q, setQ] = useState("");
  const [f, setF] = useState<F>("all");
  const [view, setView] = useState<"wall" | "table">("wall");
  const rows = useMemo(
    () => list.filter((r) => match(r, f) && (!q || `${r.domain} ${r.state.company_name ?? ""} ${r.poc?.name ?? ""}`.toLowerCase().includes(q.toLowerCase()))),
    [list, q, f],
  );
  return (
    <div>
      <div className="sec-title">
        <h1 style={{ fontSize: "clamp(30px,4.4vw,44px)" }}>
          Your <em className="s" style={{ color: "var(--night-3)" }}>prospects</em>
        </h1>
        <span className="sub">Every company the agent researched, ranked by proven score. Tap one to see why.</span>
      </div>
      <div className="toolbar">
        <div className="search" style={{ position: "relative" }}>
          <ISearch className="sr" />
          <input type="search" aria-label="Search prospects" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, domain or person" />
        </div>
        {FILTERS.map(([k, l]) => (
          <button key={k} className={`fchip ${f === k ? "on" : ""}`} onClick={() => setF(k)} aria-pressed={f === k}>
            {l} <span className="num">{list.filter((r) => match(r, k)).length}</span>
          </button>
        ))}
        <span style={{ flex: 1 }} />
        <button className={`fchip ${view === "wall" ? "on" : ""}`} onClick={() => setView("wall")} aria-pressed={view === "wall"}>Cards</button>
        <button className={`fchip ${view === "table" ? "on" : ""}`} onClick={() => setView("table")} aria-pressed={view === "table"}>Table</button>
      </div>
      {!ready ? null : rows.length === 0 ? (
        <div className="empty">Nothing here yet. <Link href="/run?demo=1">Run the demo list</Link>.</div>
      ) : view === "wall" ? (
        <div className="wall">{rows.map((r) => <Card key={r.domain} r={r} />)}</div>
      ) : (
        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Company</th>
                <th>Verdict</th>
                <th className="r">Score</th>
                <th className="hide-m">Person</th>
                <th>Status</th>
                <th className="hide-m">Changed by research</th>
              </tr>
            </thead>
            <tbody>{rows.map((r) => <Row key={r.domain} r={r} />)}</tbody>
          </table>
        </div>
      )}
      {!isSample && list.length > 0 && (
        <p style={{ marginTop: 24 }}>
          <button className="btn sm" onClick={() => confirm("Remove every prospect stored in this browser?") && clearAll()}>Clear stored prospects</button>
        </p>
      )}
    </div>
  );
}
