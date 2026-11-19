"use client";

import { useLink, useStore } from "../components/store";
import { ScoreRing, stampFor } from "../components/ui";
import type { CompanyResult, Status } from "@/lib/types";

const COLS: { key: Status[]; name: string; note: string; bg: string }[] = [
  { key: ["sent"], name: "Sent", note: "In your inbox", bg: "#c9ecd9" },
  { key: ["drafted"], name: "Drafted", note: "Passed, not sent yet", bg: "#cfe5f9" },
  { key: ["held"], name: "Held", note: "A draft failed a check", bg: "#fbd0c2" },
  { key: ["no_contact"], name: "No contact", note: "Nobody named found", bg: "#fbe8bf" },
  { key: ["insufficient_data", "failed"], name: "Needs a look", note: "Unclear or unreadable", bg: "#d8cff8" },
  { key: ["not_qualified"], name: "Kept out", note: "Wrong fit, rival, customer", bg: "#ece7dc" },
];

function Mini({ r }: { r: CompanyResult }) {
  const { onClick, onKeyDown, className, onMouseEnter, onMouseLeave, onFocus, onBlur } = useLink(r.domain);
  const st = stampFor(r);
  return (
    <button className={`mini ${className}`} {...{ onClick, onKeyDown, onMouseEnter, onMouseLeave, onFocus, onBlur }}>
      <span className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
        <ScoreRing low={r.state.score_low} high={r.state.score_high} size={38} />
        <span style={{ minWidth: 0 }}>
          <b>{r.state.company_name ?? r.domain}</b>
          <span>{r.poc ? `${r.poc.name} · ${r.poc.title}` : st?.text.toLowerCase() ?? r.domain}</span>
        </span>
      </span>
    </button>
  );
}

export default function Pipeline() {
  const { list } = useStore();
  return (
    <div>
      <div className="sec-title">
        <h1 style={{ fontSize: "clamp(30px,4.4vw,44px)" }}>
          The <em className="s" style={{ color: "var(--night-3)" }}>pipeline</em>
        </h1>
        <span className="sub">Where each prospect stopped, and why. Hover one and it lights up on every page.</span>
      </div>
      <div className="board">
        {COLS.map((c) => {
          const items = list.filter((r) => c.key.includes(r.state.status));
          return (
            <section key={c.name} className="col" style={{ background: c.bg }} aria-label={c.name}>
              <h3>
                <span>{c.name}</span>
                <span className="n">{items.length}</span>
              </h3>
              <p className="note">{c.note}</p>
              {items.map((r) => <Mini key={r.domain} r={r} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
