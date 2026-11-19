import type { Metadata } from "next";
import { CHECK_GROUPS, DECISIONS, FIRST_PRINCIPLES, THE_CUT, VERDICT } from "@/lib/brief";

export const metadata: Metadata = { title: "Brief · Prospect Quest" };

const DEC_COLORS = ["c1", "c2", "c3", "c4", "c5"];

export default function Brief() {
  return (
    <div>
      <section className="hero" style={{ paddingBottom: 30 }}>
        <span className="eyebrow">Before a line of code</span>
        <h1 style={{ fontSize: "clamp(32px,4.6vw,52px)" }}>Does this <em>deserve</em> to be built?</h1>
        <p className="lead">The Nine Checks and Five Pre-Build Decisions from MESA L4, answered for Sprinto, with the numbers measured on the live build.</p>
        <div className="row">
          <a className="btn primary" href="/nine-checks.png" download>Download the Nine Checks</a>
          <a className="btn ghost-n" href="/components-map.png" download>Download the Components Map</a>
        </div>
      </section>

      <div className="grid g4 sec" style={{ marginTop: 14 }}>
        {FIRST_PRINCIPLES.map((f, i) => (
          <div key={f.h} className={`lvl ${DEC_COLORS[i]}`} style={{ minHeight: 0 }}>
            <div className="k">{f.h.toUpperCase()}</div>
            <p style={{ marginTop: 6, fontSize: 14 }}>{f.t}</p>
          </div>
        ))}
      </div>

      <section className="sec">
        <div className="sec-title">
          <h2>The <em>Nine Checks</em></h2>
          <span className="sub">Kill switches decide whether to build, sizing decides how big, and the boundary says where the human stays.</span>
        </div>
        <div className="grid g3" style={{ alignItems: "start" }}>
          {CHECK_GROUPS.map((g) => (
            <div key={g.title} style={{ background: g.color, borderRadius: 22, padding: 14 }}>
              <h3 style={{ fontSize: 19 }}>{g.title}</h3>
              <p className="small" style={{ margin: "0 0 10px", fontWeight: 600, color: "var(--ink-2)" }}>{g.rule}</p>
              <div style={{ display: "grid", gap: 8 }}>
                {g.checks.map((c) => (
                  <article key={c.n} className="card" style={{ padding: 14, boxShadow: "none" }}>
                    <div className="row between" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                      <h4 style={{ fontSize: 16 }}><span className="num" style={{ color: "var(--coral)" }}>{c.n}</span> {c.q}</h4>
                      <span className={`pill ${c.tone === "yes" ? "t-go" : "t-wait"}`}>{c.badge}</span>
                    </div>
                    <p className="small" style={{ margin: "6px 0 0", color: "var(--ink-2)" }}>{c.text}</p>
                    {c.human && <p className="small" style={{ margin: "8px 0 0", fontWeight: 700, color: "var(--hold)" }}>Human here: {c.human}</p>}
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="grid g2" style={{ marginTop: 12 }}>
          <p className="notice go" style={{ margin: 0 }}><b>Verdict:</b> {VERDICT}</p>
          <p className="notice" style={{ margin: 0 }}><b>The Cut, deliberately not automated:</b> {THE_CUT.join(" · ")}.</p>
        </div>
      </section>

      <section className="sec">
        <div className="sec-title">
          <h2>Five <em>pre-build decisions</em></h2>
        </div>
        <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
          {DECISIONS.map((d, i) => (
            <div key={d.k} className={`lvl ${DEC_COLORS[i]}`}>
              <div className="k">{String(i + 1).padStart(2, "0")}</div>
              <b>{d.k}</b>
              <p>{d.t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="sec-title">
          <h2>Components <em>map</em></h2>
          <span className="sub">Every part of the system, who acts, and how data flows between them.</span>
        </div>
        <figure className="figure" style={{ margin: 0 }}>
          <a href="/components-map.png"><img src="/components-map.png" alt="Components map: actors in rows, trigger to output in columns, showing the 7-step pipeline, the agent loop, Gemini, Hunter, Resend and the review loop" /></a>
        </figure>
      </section>
    </div>
  );
}
