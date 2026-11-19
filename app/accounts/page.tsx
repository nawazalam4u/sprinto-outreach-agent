"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLink, useStore } from "../components/store";
import { Score, StatusPill, VerdictPill, VERDICT_LABEL } from "../components/ui";
import type { CompanyResult, Verdict } from "@/lib/types";

function Row({ r }: { r: CompanyResult }) {
  const link = useLink(r.domain);
  return (
    <tr tabIndex={0} {...link} aria-label={`Open ${r.state.company_name ?? r.domain}`}>
      <td>
        <b style={{ fontWeight: 500 }}>{r.state.company_name ?? r.domain}</b>
        <div className="small muted">{r.domain}</div>
      </td>
      <td><VerdictPill v={r.state.verdict} /></td>
      <td className="r"><Score r={r} /></td>
      <td className="small">{r.poc ? `${r.poc.name} · ${r.poc.title}` : <span className="muted">—</span>}</td>
      <td><StatusPill s={r.state.status} /></td>
      <td className="small muted">{r.state.fixed_verdict && r.state.verdict && r.state.fixed_verdict !== r.state.verdict ? `${VERDICT_LABEL[r.state.fixed_verdict]} → ${VERDICT_LABEL[r.state.verdict]}` : "—"}</td>
    </tr>
  );
}

export default function Accounts() {
  const { list, ready, clearAll, isSample } = useStore();
  const [q, setQ] = useState("");
  const [v, setV] = useState<"" | Verdict>("");
  const rows = useMemo(
    () =>
      list.filter(
        (r) =>
          (!v || r.state.verdict === v) &&
          (!q || `${r.domain} ${r.state.company_name ?? ""} ${r.poc?.name ?? ""}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [list, q, v],
  );
  return (
    <div>
      <h1 className="display" style={{ fontSize: "clamp(30px,4.4vw,46px)" }}>Accounts</h1>
      <p className="lede">Every company researched, ranked by its proven score. Open one to see why.</p>
      <div className="row" style={{ marginTop: 32, marginBottom: 16 }}>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="q">SEARCH</label>
          <input id="q" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="company, domain or person" />
        </div>
        <div className="field" style={{ flex: "0 1 220px" }}>
          <label htmlFor="v">VERDICT</label>
          <select id="v" value={v} onChange={(e) => setV(e.target.value as Verdict | "")}>
            <option value="">All</option>
            {Object.entries(VERDICT_LABEL).map(([k, l]) => (
              <option key={k} value={k}>{l}</option>
            ))}
          </select>
        </div>
      </div>
      {!ready ? null : rows.length === 0 ? (
        <div className="empty">No accounts yet. <Link href="/run">Run some domains</Link>.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th>
                <th>Verdict</th>
                <th className="r">Score</th>
                <th>Person</th>
                <th>Status</th>
                <th>Changed by research</th>
              </tr>
            </thead>
            <tbody>{rows.map((r) => <Row key={r.domain} r={r} />)}</tbody>
          </table>
        </div>
      )}
      {!isSample && list.length > 0 && (
        <p style={{ marginTop: 24 }}>
          <button className="btn ghost sm" onClick={() => confirm("Remove every account stored in this browser?") && clearAll()}>Clear stored accounts</button>
        </p>
      )}
    </div>
  );
}
