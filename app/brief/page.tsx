import type { Metadata } from "next";
import { CHECK_GROUPS, DECISIONS, FIRST_PRINCIPLES, THE_CUT, VERDICT } from "@/lib/brief";

export const metadata: Metadata = { title: "Brief · Sprinto Outreach Agent" };

export default function Brief() {
  return (
    <div>
      <h1 className="display" style={{ fontSize: "clamp(30px,4.4vw,46px)" }}>
        Does this deserve <em>to be built?</em>
      </h1>
      <p className="lede">The Nine Checks and the Five Pre-Build Decisions, written before the code. Then the system as it was built.</p>

      <section style={{ marginTop: 48 }}>
        <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
          {FIRST_PRINCIPLES.map((f) => (
            <div key={f.h} style={{ borderTop: "1px solid var(--ink)", paddingTop: 12 }}>
              <div className="label">{f.h.toUpperCase()}</div>
              <p style={{ margin: "6px 0 0", color: "var(--ink-2)" }}>{f.t}</p>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 72 }}>
        <h2 className="sec">The Nine Checks</h2>
        <div className="grid-3" style={{ marginTop: 28 }}>
          {CHECK_GROUPS.map((g) => (
            <div key={g.title}>
              <h3 style={{ fontSize: 18, fontWeight: 500 }}>{g.title}</h3>
              <p className="small muted" style={{ margin: "2px 0 14px" }}>{g.rule}</p>
              {g.checks.map((c) => (
                <article key={c.n} style={{ borderTop: "1px solid var(--rule-strong)", padding: "14px 0 18px" }}>
                  <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                    <h4 style={{ margin: 0, fontWeight: 500 }}>
                      <span className="num" style={{ color: "var(--shu)" }}>{c.n}</span> {c.q}
                    </h4>
                    <span className={`pill ${c.tone === "yes" ? "go" : "warn"}`}>{c.badge}</span>
                  </div>
                  <p className="small" style={{ color: "var(--ink-2)", margin: "8px 0 0" }}>{c.text}</p>
                  {c.human && <p className="small notice info" style={{ margin: "10px 0 0" }}>{c.human}</p>}
                </article>
              ))}
            </div>
          ))}
        </div>
        <p className="notice info" style={{ marginTop: 28 }}><b>Verdict:</b> {VERDICT}</p>
        <p className="notice" style={{ marginTop: 12 }}><b>The Cut, what we deliberately did not automate:</b> {THE_CUT.join(" · ")}.</p>
        <p className="small" style={{ marginTop: 12 }}><a href="/nine-checks.png">Download the Nine Checks image</a></p>
      </section>

      <section style={{ marginTop: 72 }}>
        <h2 className="sec">Five Pre-Build Decisions</h2>
        <dl className="kv" style={{ marginTop: 24, gridTemplateColumns: "200px minmax(0,1fr)" }}>
          {DECISIONS.map((d) => (
            <div key={d.k} style={{ display: "contents" }}>
              <dt style={{ borderTop: "1px solid var(--rule)", paddingTop: 12 }}>{d.k}</dt>
              <dd style={{ borderTop: "1px solid var(--rule)", paddingTop: 12, color: "var(--ink-2)" }}>{d.t}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section style={{ marginTop: 72 }}>
        <h2 className="sec">Components map</h2>
        <p className="muted" style={{ marginTop: 8 }}>Every part of the system and how data flows between them.</p>
        <figure className="figure" style={{ margin: "20px 0 0" }}>
          <a href="/components-map.png"><img src="/components-map.png" alt="Components map: actors in rows, trigger to output in columns, showing the 7-step pipeline, the agent loop, Gemini, Hunter, Resend and the review loop" /></a>
        </figure>
      </section>
    </div>
  );
}
