"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../components/store";
import { IMail, IPlay, ISpark } from "../components/Icons";
import { Confetti, Journey, ScoreRing, StatusPill, VerdictPill, fmtMs } from "../components/ui";
import type { CompanyResult, CompanyState, ManualPoc, RunEvent } from "@/lib/types";

// A mix that shows every outcome: qualifies and sends, already a Sprinto customer, rival vendor, not B2B, nurture
const SAMPLE = ["reflex.dev", "airmeet.com", "plane.so", "vanta.com", "zomato.com", "spendflo.com"];
const MAX = 15;
const PARALLEL = 2;

type Live = {
  domain: string;
  steps: Record<number, { status: string; detail?: string }>;
  turns: string[];
  state?: CompanyState;
  result?: CompanyResult;
  error?: string;
  t0: number;
  t1?: number;
};

type Health = { gemini: boolean; hunter: boolean; email: boolean; recipient: string | null; model: string; sender: string };

function parse(text: string): { domain: string; manual: ManualPoc | null }[] {
  const out: { domain: string; manual: ManualPoc | null }[] = [];
  for (const line of text.split(/\n+/)) {
    const parts = line.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    if (parts.length >= 3 && parts[1].includes(" ")) {
      out.push({ domain: parts[0], manual: { name: parts[1], title: parts[2], email: parts[3] ?? "" } });
    } else {
      for (const p of line.split(/[\s,;]+/).filter(Boolean)) out.push({ domain: p, manual: null });
    }
  }
  const seen = new Set<string>();
  return out
    .map((x) => ({ ...x, domain: x.domain.toLowerCase().replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0] }))
    .filter((x) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(x.domain) && !seen.has(x.domain) && (seen.add(x.domain), true));
}

export default function RunPage() {
  const { upsert, addRun, style, setOpen } = useStore();
  const [text, setText] = useState("");
  const [autoSend, setAutoSend] = useState(true);
  const [runs, setRuns] = useState<Live[]>([]);
  const [busy, setBusy] = useState(false);
  const [health, setHealth] = useState<Health | null>(null);
  const [err, setErr] = useState("");
  const stop = useRef(false);

  useEffect(() => {
    fetch("/api/health").then((r) => r.json()).then(setHealth).catch(() => {});
    if (new URLSearchParams(window.location.search).get("demo")) setText(SAMPLE.join("\n"));
  }, []);

  const items = parse(text);
  const update = (i: number, fn: (l: Live) => Live) => setRuns((rs) => rs.map((r, j) => (j === i ? fn(r) : r)));

  async function runOne(i: number, domain: string, manual: ManualPoc | null) {
    update(i, (l) => ({ ...l, t0: Date.now(), steps: { 1: { status: "running" } } }));
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, autoSend, manualPoc: manual, style }),
    });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      update(i, (l) => ({ ...l, error: j.error ?? `HTTP ${res.status}`, t1: Date.now() }));
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        let e: RunEvent;
        try {
          e = JSON.parse(line);
        } catch {
          continue;
        }
        if (e.type === "step") update(i, (l) => ({ ...l, steps: { ...l.steps, [e.step]: { status: e.status, detail: e.detail } } }));
        else if (e.type === "log" && e.message && /^(Turn|→|Draft|Short|Score range|Budget|Size band|Hunter|No Hunter|Google|No useful)/.test(e.message.trim()))
          update(i, (l) => ({ ...l, turns: [...l.turns, e.message].slice(-14) }));
        else if (e.type === "state") update(i, (l) => ({ ...l, state: e.state }));
        else if (e.type === "fatal") update(i, (l) => ({ ...l, error: e.error }));
        else if (e.type === "result") {
          update(i, (l) => ({ ...l, result: e.result, state: e.result.state, t1: Date.now() }));
          upsert(e.result);
        }
      }
    }
    update(i, (l) => ({ ...l, t1: l.t1 ?? Date.now() }));
  }

  async function start() {
    setErr("");
    if (!items.length) return setErr("Add at least one domain, like acme.com");
    if (items.length > MAX) return setErr(`Up to ${MAX} domains per run`);
    stop.current = false;
    setBusy(true);
    const t0 = Date.now();
    setRuns(items.map((x) => ({ domain: x.domain, steps: {}, turns: [], t0: 0 })));
    let next = 0;
    const worker = async () => {
      while (next < items.length && !stop.current) {
        const i = next++;
        try {
          await runOne(i, items[i].domain, items[i].manual);
        } catch (e) {
          update(i, (l) => ({ ...l, error: (e as Error).message, t1: Date.now() })); // one bad domain never stops the batch
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL, items.length) }, worker));
    addRun({ id: String(t0), at: new Date(t0).toISOString(), domains: items.map((x) => x.domain), ms: Date.now() - t0 });
    setBusy(false);
  }

  const done = runs.filter((r) => r.result);
  const sentN = done.filter((r) => r.result?.state.status === "sent").length;
  return (
    <div>
      <section className="hero" style={{ paddingBottom: 30 }}>
        <span className="eyebrow">Start a quest</span>
        <h1 style={{ fontSize: "clamp(32px,4.6vw,50px)" }}>
          Give it domains. <em>It decides the rest.</em>
        </h1>
        <p className="lead">One domain per line. Each company runs all 7 steps with no questions asked. Strong fits get a checked email in your inbox. Weak or unclear ones are held, with the reason written down.</p>
      </section>

      <div className="grid g2 sec" style={{ alignItems: "start", marginTop: 16 }}>
        <div className="card">
          <div className="field">
            <label className="label" htmlFor="domains">Domains · up to {MAX}</label>
            <textarea
              id="domains"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={"acme.com\nexample.io\n\nOptional hard-coded person (Option B):\nacme.com, Priya Shah, CTO, priya@acme.com"}
              spellCheck={false}
            />
          </div>
          <div className="row between" style={{ marginTop: 10 }}>
            <span className="small muted">{items.length} valid domain{items.length === 1 ? "" : "s"}</span>
            <button className="btn sm" onClick={() => setText(SAMPLE.join("\n"))} type="button">
              <ISpark /> Load the demo list
            </button>
          </div>
        </div>
        <div className="card night" style={{ display: "grid", gap: 16 }}>
          <label className="check" style={{ color: "var(--on-night)" }}>
            <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
            Send passing emails automatically (to my inbox only)
          </label>
          <dl className="kv small" style={{ color: "var(--on-night)" }}>
            <dt style={{ color: "var(--on-night-2)" }}>AI</dt>
            <dd>{health ? (health.gemini ? `Gemini · ${health.model}` : "not set on the server") : "…"}</dd>
            <dt style={{ color: "var(--on-night-2)" }}>Find the person</dt>
            <dd>{health ? (health.hunter ? "Hunter.io Domain Search + company data" : "Google Search (no Hunter key: emails never guessed)") : "…"}</dd>
            <dt style={{ color: "var(--on-night-2)" }}>Email</dt>
            <dd>{health ? (health.email ? `Resend → ${health.recipient} only` : "not connected: Gmail draft link instead") : "…"}</dd>
            <dt style={{ color: "var(--on-night-2)" }}>Learned edits</dt>
            <dd>{style.length ? `${style.length} of your edits guide new drafts` : "none yet: edit a draft to teach it"}</dd>
          </dl>
          <div className="row">
            <button className="btn primary lg" onClick={start} disabled={busy || !items.length}>
              <IPlay /> {busy ? "Running…" : `Run ${items.length || ""} ${items.length === 1 ? "company" : "companies"}`}
            </button>
            {busy && (
              <button className="btn ghost-n" onClick={() => (stop.current = true)}>
                Stop after current
              </button>
            )}
          </div>
          <p className="small" style={{ margin: 0, color: "var(--on-night-2)" }}>A qualifying company takes about 1–2 minutes (the agent reads several pages and writes up to 4 drafts). Two run at a time.</p>
          {err && <p className="notice" role="alert">{err}</p>}
        </div>
      </div>

      {runs.length > 0 && (
        <section className="sec" aria-live="polite">
          <div className="sec-title">
            <h2>This <em>run</em></h2>
            <span className="sub">
              {done.length}/{runs.length} done{sentN ? ` · ${sentN} in your inbox` : ""}
              {done.length ? ` · avg ${fmtMs(done.reduce((s, r) => s + (r.result?.ms ?? 0), 0) / done.length)} per company vs 15–20 min by hand` : ""}
            </span>
          </div>
          {runs.map((r) => {
            const live = r.t0 && !r.t1;
            const sent = r.result?.state.status === "sent";
            return (
              <article key={r.domain} className={`runcard ${live ? "live" : ""}`}>
                {sent && <Confetti />}
                <header>
                  <div className="row" style={{ gap: 14 }}>
                    <ScoreRing low={r.state?.score_low ?? null} high={r.state?.score_high ?? null} size={58} />
                    <div>
                      <h3 style={{ fontSize: 19 }}>{r.state?.company_name ?? r.domain}</h3>
                      <span className="small muted">{r.domain}{r.t0 ? ` · ${fmtMs((r.t1 ?? Date.now()) - r.t0)}` : " · queued"}</span>
                    </div>
                  </div>
                  <div className="row">
                    {r.state?.verdict && <VerdictPill v={r.state.verdict} />}
                    {r.result && <StatusPill s={r.result.state.status} />}
                    {r.result && (
                      <button className="btn sm dark" onClick={() => setOpen(r.domain)}>
                        Why? Open dossier
                      </button>
                    )}
                  </div>
                </header>
                <Journey steps={r.steps} details />
                {r.error && <p className="notice" style={{ marginTop: 12 }}>{r.error}</p>}
                {r.turns.length > 0 && (
                  <details style={{ marginTop: 10 }} open={Boolean(live)}>
                    <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>Agent log ({r.turns.length})</summary>
                    <div className="turns">
                      {r.turns.map((t, k) => {
                        const isOut = /^\s*→/.test(t);
                        const m = t.match(/^Turn (\d+): (.*)$/);
                        return (
                          <div key={k} className={`turn ${isOut ? "out" : ""}`}>
                            {m ? <span className="t">T{m[1]}</span> : isOut ? null : <span className="t" style={{ background: "var(--night-3)" }}>·</span>}
                            <span>{(m ? m[2] : t).trim()}</span>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
                {r.result?.draft && (
                  <details style={{ marginTop: 10 }}>
                    <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>
                      <IMail className="sr" /> Email: {r.result.draft.subject}
                    </summary>
                    <div className="email" style={{ marginTop: 10 }}>{r.result.draft.body}</div>
                  </details>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
