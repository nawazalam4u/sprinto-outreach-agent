"use client";

import { useEffect, useRef, useState } from "react";
import { useStore } from "../components/store";
import { StatusPill, VerdictPill, fmtMs } from "../components/ui";
import type { CompanyResult, CompanyState, ManualPoc, RunEvent, StepId } from "@/lib/types";

// A mix that shows every outcome: qualifies, already a Sprinto customer, a rival vendor, not B2B, nurture
const SAMPLE = ["reflex.dev", "airmeet.com", "rime.ai", "plane.so", "vanta.com", "zomato.com", "spendflo.com"];
const STEP_NAMES = ["Scrape", "Extract", "Qualify", "Person", "Pains", "Email", "Send"];
const MAX = 15;

type Live = {
  domain: string;
  steps: Record<number, { status: string; detail?: string }>;
  log: string[];
  state?: CompanyState;
  result?: CompanyResult;
  error?: string;
  t0: number;
};

type Health = { gemini: boolean; hunter: boolean; email: boolean; recipient: string | null; model: string; sender: string };

function parse(text: string): { domain: string; manual: ManualPoc | null }[] {
  const out: { domain: string; manual: ManualPoc | null }[] = [];
  for (const line of text.split(/\n+/)) {
    const parts = line.split(",").map((s) => s.trim()).filter(Boolean);
    if (!parts.length) continue;
    if (parts.length >= 3 && parts[1].includes(" ")) {
      // "domain, Full Name, Title, email" = a hard-coded PoC (Option B: Apollo lookup)
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
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  const items = parse(text);

  const update = (i: number, fn: (l: Live) => Live) => setRuns((rs) => rs.map((r, j) => (j === i ? fn(r) : r)));

  async function runOne(i: number, domain: string, manual: ManualPoc | null) {
    const res = await fetch("/api/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ domain, autoSend, manualPoc: manual, style }),
    });
    if (!res.ok || !res.body) {
      const j = await res.json().catch(() => ({}));
      update(i, (l) => ({ ...l, error: j.error ?? `HTTP ${res.status}` }));
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
        else if (e.type === "log" && e.message) update(i, (l) => ({ ...l, log: [...l.log, e.message].slice(-60) }));
        else if (e.type === "state") update(i, (l) => ({ ...l, state: e.state }));
        else if (e.type === "fatal") update(i, (l) => ({ ...l, error: e.error }));
        else if (e.type === "result") {
          update(i, (l) => ({ ...l, result: e.result, state: e.result.state }));
          upsert(e.result);
        }
      }
    }
  }

  async function start() {
    setErr("");
    if (!items.length) return setErr("Add at least one domain, like acme.com");
    if (items.length > MAX) return setErr(`Up to ${MAX} domains per run`);
    stop.current = false;
    setBusy(true);
    const t0 = Date.now();
    const list = items.map((x) => ({ domain: x.domain, steps: {}, log: [], t0: Date.now() }) as Live);
    setRuns(list);
    for (let i = 0; i < items.length; i++) {
      if (stop.current) break;
      update(i, (l) => ({ ...l, t0: Date.now() }));
      try {
        await runOne(i, items[i].domain, items[i].manual);
      } catch (e) {
        update(i, (l) => ({ ...l, error: (e as Error).message })); // one bad domain never stops the batch
      }
    }
    addRun({ id: String(t0), at: new Date(t0).toISOString(), domains: items.map((x) => x.domain), ms: Date.now() - t0 });
    setBusy(false);
  }

  const done = runs.filter((r) => r.result);
  return (
    <div>
      <h1 className="display" style={{ fontSize: "clamp(30px,4.4vw,46px)" }}>
        Give it domains. <em>It decides the rest.</em>
      </h1>
      <p className="lede">
        One domain per line. Each company goes through all seven steps with no questions asked. Qualified leads get a checked email sent to your own inbox. Weak or unclear ones are held, with the reason written down.
      </p>

      <div className="grid-2" style={{ marginTop: 40, alignItems: "start" }}>
        <div className="field">
          <label htmlFor="domains">DOMAINS · up to {MAX}</label>
          <textarea
            id="domains"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={"acme.com\nexample.io\n\nOptional hard-coded person (Option B):\nacme.com, Priya Shah, CTO, priya@acme.com"}
            spellCheck={false}
          />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="small muted">{items.length} valid domain{items.length === 1 ? "" : "s"}</span>
            <button className="btn ghost sm" onClick={() => setText(SAMPLE.join("\n"))} type="button">
              Use a sample list
            </button>
          </div>
        </div>
        <div style={{ display: "grid", gap: 18 }}>
          <label className="check">
            <input type="checkbox" checked={autoSend} onChange={(e) => setAutoSend(e.target.checked)} />
            Send passing emails automatically (to my inbox only)
          </label>
          <dl className="kv small">
            <dt>Gemini</dt>
            <dd>{health ? (health.gemini ? `connected · ${health.model}` : "not set on the server") : "…"}</dd>
            <dt>Find the person</dt>
            <dd>{health ? (health.hunter ? "Hunter.io Domain Search + Email Finder" : "Google Search via Gemini (no Hunter key: emails not guessed)") : "…"}</dd>
            <dt>Email delivery</dt>
            <dd>{health ? (health.email ? `Resend → ${health.recipient}` : "not connected: you get a Gmail draft link instead") : "…"}</dd>
            <dt>Learned edits</dt>
            <dd>{style.length ? `${style.length} of your edits guide new drafts` : "none yet"}</dd>
          </dl>
          <div className="row">
            <button className="btn" onClick={start} disabled={busy || !items.length}>
              {busy ? "Running…" : `Run ${items.length || ""} ${items.length === 1 ? "company" : "companies"}`}
            </button>
            {busy && (
              <button className="btn ghost" onClick={() => (stop.current = true)}>
                Stop after current
              </button>
            )}
          </div>
          {err && <p className="notice" role="alert">{err}</p>}
        </div>
      </div>

      {runs.length > 0 && (
        <section style={{ marginTop: 64 }} aria-live="polite">
          <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
            <h2 className="sec">This run</h2>
            <span className="small muted">
              {done.length}/{runs.length} done
              {done.length ? ` · avg ${fmtMs(done.reduce((s, r) => s + (r.result?.ms ?? 0), 0) / done.length)} per company vs 15–20 min by hand` : ""}
            </span>
          </div>
          {runs.map((r) => (
            <article key={r.domain} className="runcard">
              <header>
                <h3 style={{ fontSize: 18, fontWeight: 500 }}>
                  {r.state?.company_name ?? r.domain} <span className="small muted">{r.domain}</span>
                </h3>
                <div className="row">
                  {r.state?.verdict && <VerdictPill v={r.state.verdict} />}
                  {r.result && <StatusPill s={r.result.state.status} />}
                  {r.result && (
                    <button className="btn ghost sm" onClick={() => setOpen(r.domain)}>
                      Why? Open dossier
                    </button>
                  )}
                </div>
              </header>
              <ol className="steps">
                {STEP_NAMES.map((n, k) => {
                  const s = r.steps[k + 1];
                  return (
                    <li key={n} className={s?.status ?? ""}>
                      <b>
                        {k + 1} · {n}
                      </b>
                      <span className="d">{s?.detail ?? (s?.status === "running" ? "" : "")}</span>
                    </li>
                  );
                })}
              </ol>
              {r.error && <p className="notice" style={{ marginTop: 14 }}>{r.error}</p>}
              {r.log.length > 0 && <div className="log">{r.log.join("\n")}</div>}
              {r.result?.draft && (
                <details style={{ marginTop: 14 }}>
                  <summary className="small" style={{ cursor: "pointer" }}>
                    Email: {r.result.draft.subject}
                  </summary>
                  <div className="email" style={{ marginTop: 10 }}>{r.result.draft.body}</div>
                </details>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

export type { StepId };
