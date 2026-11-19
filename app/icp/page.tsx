import type { Metadata } from "next";
import { BLOCKS, CAPS, COMPETITOR_TOOLS, EVIDENCE_MAP, GATES, ICP_SUMMARY, ICP_VERSION, LOOP_LIMITS, ROLE_PRIORITY, SIGNALS, VERDICT_LINES } from "@/lib/icp";

export const metadata: Metadata = { title: "ICP · Sprinto Outreach Agent" };

export default function Icp() {
  return (
    <div>
      <h1 className="display" style={{ fontSize: "clamp(30px,4.4vw,46px)" }}>Who is a <em>right company</em>?</h1>
      <p className="lede">{ICP_SUMMARY.oneLine}</p>
      <p className="small muted">ICP {ICP_VERSION} · every rule below is in one file the Growth Lead owns.</p>

      <section style={{ marginTop: 56 }}>
        <h2 className="sec">Why this definition</h2>
        <ol style={{ paddingLeft: 20, color: "var(--ink-2)", maxWidth: 760 }}>
          {ICP_SUMMARY.why.map((w) => <li key={w} style={{ marginTop: 8 }}>{w}</li>)}
        </ol>
      </section>

      <section style={{ marginTop: 56 }}>
        <h2 className="sec">Hard gates</h2>
        <p className="muted">Any fail ends the assessment. Rival tools checked: {COMPETITOR_TOOLS.join(", ")}.</p>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Gate</th><th>Passes when</th><th>Fails when</th></tr></thead>
            <tbody>{GATES.map((g) => <tr key={g.key} style={{ cursor: "default" }}><td>{g.name}</td><td className="small">{g.rule}</td><td className="small muted">{g.fail}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <h2 className="sec">The 100-point rubric</h2>
        <p className="muted" style={{ maxWidth: 760 }}>
          Points need evidence. A signal the website cannot settle is marked external: silence there means unknown, not no. Unknowns widen the range. Priority from {VERDICT_LINES.priority}, Qualify from {VERDICT_LINES.qualify}, Nurture from {VERDICT_LINES.nurture}. With no upmarket pull the cap is {CAPS.noUpmarket}; already holding SOC 2 and ISO 27001 caps it at {CAPS.fullyCertified}.
        </p>
        {BLOCKS.map((b) => (
          <div key={b.key} style={{ marginTop: 24 }}>
            <div className="label">{b.name.toUpperCase()} · {b.max}</div>
            <div className="table-wrap" style={{ borderTopWidth: 1 }}>
              <table><tbody>
                {SIGNALS.filter((s) => s.block === b.key).map((s) => (
                  <tr key={s.key} style={{ cursor: "default" }}>
                    <td>{s.name}</td>
                    <td className="small muted">{s.external ? "external" : "website"}</td>
                    <td className="r num" style={{ width: 70 }}>{s.max}</td>
                  </tr>
                ))}
              </tbody></table>
            </div>
          </div>
        ))}
      </section>

      <section style={{ marginTop: 56 }}>
        <h2 className="sec">Evidence map</h2>
        <p className="muted">The agent loop runs while 60 sits inside the score range. Budget: {LOOP_LIMITS.maxToolCalls} tool calls, at most {LOOP_LIMITS.maxSearches} web searches, {LOOP_LIMITS.maxMs / 1000} seconds, no repeats.</p>
        <div className="table-wrap" style={{ marginTop: 16 }}>
          <table>
            <thead><tr><th>Question</th><th>Fact that settles it</th><th>Where it lives</th><th>Enough when</th><th className="r">Tries</th><th>If unanswered</th></tr></thead>
            <tbody>{EVIDENCE_MAP.map((e) => (
              <tr key={e.field} style={{ cursor: "default" }}>
                <td>{e.question}</td><td className="small">{e.fact}</td><td className="small">{e.where}</td><td className="small">{e.sufficient}</td><td className="r num">{e.limit}</td><td className="small muted">{e.ifUnanswered}</td>
              </tr>
            ))}</tbody>
          </table>
        </div>
      </section>

      <section style={{ marginTop: 56 }}>
        <h2 className="sec">Who gets the email</h2>
        <div className="grid-3" style={{ marginTop: 20 }}>
          {ROLE_PRIORITY.map((r) => (
            <div key={r.band} style={{ borderTop: "1px solid var(--ink)", paddingTop: 12 }}>
              <div className="label">{r.band.toUpperCase()}</div>
              <p style={{ margin: "6px 0" }}>{r.roles.join(" → ")}</p>
              <p className="small muted" style={{ margin: 0 }}>{r.why}</p>
            </div>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 16 }}>Unknown size uses the 51–200 rules. Sales, marketing and HR titles are never picked. No person is ever invented, and no email address is guessed.</p>
      </section>
    </div>
  );
}
