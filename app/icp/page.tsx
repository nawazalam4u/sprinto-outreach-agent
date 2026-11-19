import type { Metadata } from "next";
import { BLOCKS, CAPS, COMPETITOR_TOOLS, EVIDENCE_MAP, GATES, ICP_SUMMARY, ICP_VERSION, LOOP_LIMITS, ROLE_PRIORITY, SIGNALS, VERDICT_LINES } from "@/lib/icp";

export const metadata: Metadata = { title: "ICP · Prospect Quest" };

const BLOCK_BG: Record<string, string> = { firmographic: "#cfe5f9", upmarket: "#d8cff8", trigger: "#fbd0c2", fit: "#c9ecd9" };

export default function Icp() {
  return (
    <div>
      <section className="hero" style={{ paddingBottom: 30 }}>
        <span className="eyebrow">ICP {ICP_VERSION} · one file she owns</span>
        <h1 style={{ fontSize: "clamp(32px,4.6vw,52px)" }}>Who is a <em>right company?</em></h1>
        <p className="lead">{ICP_SUMMARY.oneLine}</p>
      </section>

      <section className="sec">
        <div className="sec-title"><h2>Why this <em>definition</em></h2></div>
        <div className="grid g2">
          {ICP_SUMMARY.why.map((w, i) => (
            <div key={w} className="card" style={{ display: "flex", gap: 12 }}>
              <span className="num" style={{ fontWeight: 800, color: "var(--coral)" }}>{String(i + 1).padStart(2, "0")}</span>
              <span style={{ color: "var(--ink-2)" }}>{w}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-title">
          <h2>Three <em>hard gates</em></h2>
          <span className="sub">Any fail ends the assessment at once. Rival tools checked: {COMPETITOR_TOOLS.join(", ")}.</span>
        </div>
        <div className="grid g3">
          {GATES.map((g) => (
            <div key={g.key} className="card">
              <h3 style={{ fontSize: 17 }}>{g.name}</h3>
              <p className="small" style={{ margin: "8px 0 4px" }}><span className="pill t-go">Pass</span> {g.rule}</p>
              <p className="small" style={{ margin: 0 }}><span className="pill t-stop">Fail</span> {g.fail}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-title">
          <h2>The 100-point <em>rubric</em></h2>
          <span className="sub">
            Points need evidence. "External" signals are rarely on a website, so silence there means unknown, which widens the range. Priority from {VERDICT_LINES.priority}, Qualify from {VERDICT_LINES.qualify}, Nurture from {VERDICT_LINES.nurture}. No upmarket pull caps it at {CAPS.noUpmarket}; holding SOC 2 and ISO 27001 caps it at {CAPS.fullyCertified}.
          </span>
        </div>
        <div className="grid g4" style={{ alignItems: "start" }}>
          {BLOCKS.map((b) => (
            <div key={b.key} style={{ background: BLOCK_BG[b.key], borderRadius: 20, padding: 14 }}>
              <div className="row between"><h3 style={{ fontSize: 16 }}>{b.name}</h3><span className="num" style={{ fontWeight: 800 }}>{b.max}</span></div>
              <div style={{ display: "grid", gap: 6, marginTop: 10 }}>
                {SIGNALS.filter((s) => s.block === b.key).map((s) => (
                  <div key={s.key} className="row between" style={{ background: "var(--card)", borderRadius: 12, padding: "7px 10px", flexWrap: "nowrap" }}>
                    <span className="small">{s.name}{s.external && <span className="muted"> · ext</span>}</span>
                    <span className="num small" style={{ fontWeight: 800 }}>{s.max}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-title">
          <h2>The evidence <em>map</em></h2>
          <span className="sub">The agent loop runs while 60 sits inside the score range. Budget: {LOOP_LIMITS.maxToolCalls} tool calls, at most {LOOP_LIMITS.maxSearches} searches, {LOOP_LIMITS.maxMs / 1000} seconds, no repeats.</span>
        </div>
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>Question</th><th>Fact that settles it</th><th className="hide-m">Where it lives</th><th>Enough when</th><th className="hide-m">If unanswered</th></tr></thead>
            <tbody>{EVIDENCE_MAP.map((e) => (
              <tr key={e.field}><td><b>{e.question}</b></td><td className="small">{e.fact}</td><td className="small hide-m">{e.where}</td><td className="small">{e.sufficient}</td><td className="small muted hide-m">{e.ifUnanswered}</td></tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section className="sec">
        <div className="sec-title"><h2>Who gets the <em>email</em></h2><span className="sub">Unknown size uses the 51–200 rules. Sales, marketing and HR are never picked. Nobody is invented, no address is guessed.</span></div>
        <div className="grid g3">
          {ROLE_PRIORITY.map((r, i) => (
            <div key={r.band} className={`lvl c${i + 1}`} style={{ minHeight: 0 }}>
              <div className="k">{r.band.toUpperCase()}</div>
              <b>{r.roles.join(" → ")}</b>
              <p>{r.why}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
