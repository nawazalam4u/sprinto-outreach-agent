"use client";

import { useLink, useStore } from "../components/store";
import { Score } from "../components/ui";
import type { CompanyResult, Status } from "@/lib/types";

const COLS: { key: Status[]; name: string; note: string }[] = [
  { key: ["sent"], name: "Sent", note: "In your inbox" },
  { key: ["drafted"], name: "Drafted", note: "Passed, not sent yet" },
  { key: ["held"], name: "Held", note: "No draft passed the checks" },
  { key: ["no_contact"], name: "No contact", note: "Nobody named found" },
  { key: ["insufficient_data", "failed"], name: "Needs a look", note: "Unclear or unreadable" },
  { key: ["not_qualified"], name: "Not qualified", note: "Disqualified or below 60" },
];

function Card({ r }: { r: CompanyResult }) {
  const { onClick, onKeyDown, className, onMouseEnter, onMouseLeave, onFocus, onBlur } = useLink(r.domain);
  return (
    <button className={`card ${className}`} {...{ onClick, onKeyDown, onMouseEnter, onMouseLeave, onFocus, onBlur }}>
      <div className="t">{r.state.company_name ?? r.domain}</div>
      <div className="s">
        <Score r={r} /> · {r.poc ? r.poc.title : r.reasons[0]?.slice(0, 60)}
      </div>
    </button>
  );
}

export default function Pipeline() {
  const { list } = useStore();
  return (
    <div>
      <h1 className="display" style={{ fontSize: "clamp(30px,4.4vw,46px)" }}>Pipeline</h1>
      <p className="lede">Where each account stopped, and why. Hover one here and it lights up everywhere.</p>
      <div className="board" style={{ marginTop: 40 }}>
        {COLS.map((c) => {
          const items = list.filter((r) => c.key.includes(r.state.status));
          return (
            <section key={c.name} className="col" aria-label={c.name}>
              <h3>
                <span>{c.name}</span>
                <span className="num muted">{items.length}</span>
              </h3>
              <p className="small muted" style={{ margin: "6px 0 4px" }}>{c.note}</p>
              {items.map((r) => <Card key={r.domain} r={r} />)}
            </section>
          );
        })}
      </div>
    </div>
  );
}
