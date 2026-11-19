"use client";

// Account dossier: Company (gates, rubric, evidence), Person, Email, Agent log, Review.
// Focus is trapped inside; Esc closes. Scraped text renders as plain text (React escapes it).

import { useEffect, useRef, useState } from "react";
import { BLOCKS } from "@/lib/icp";
import type { CompanyResult, Fact } from "@/lib/types";
import { ICheck, IMail, ISend, IX } from "./Icons";
import { useStore } from "./store";
import { Avatar, Journey, ScoreRing, StatusPill, VerdictPill, VERDICT_LABEL, fmtMs, stampFor, stepsFromResult } from "./ui";

const TABS = ["Company", "Person", "Email", "Agent log", "Review"] as const;
const BLOCK_COLOR: Record<string, string> = { firmographic: "var(--sky)", upmarket: "var(--lilac)", trigger: "var(--coral)", fit: "var(--mint)" };

function Ev({ ids, facts }: { ids: string[]; facts: Fact[] }) {
  if (!ids.length) return null;
  return (
    <>
      {ids.map((id) => {
        const f = facts.find((x) => x.id === id);
        return <span key={id} className="ev" title={f ? `${f.value} — "${f.quote}"` : id}>{id}</span>;
      })}
    </>
  );
}
const safeHref = (u: string) => (/^https?:\/\//i.test(u) ? u : undefined);

function RangeBar({ low, high }: { low: number; high: number }) {
  return (
    <div className="bar-track" role="img" aria-label={`${low} to ${high} of 100`}>
      <div className="range-band" style={{ left: `${low}%`, width: `${Math.max(1, high - low)}%` }} />
      <div className="bar-fill" style={{ width: `${low}%`, background: low >= 60 ? "var(--go)" : "var(--night-3)" }} />
      <div className="line60" style={{ left: "60%" }} />
    </div>
  );
}

function CompanyTab({ r }: { r: CompanyResult }) {
  const s = r.state;
  const flipped = s.fixed_verdict && s.verdict && s.fixed_verdict !== s.verdict;
  const [showAll, setShowAll] = useState(false);
  const facts = r.facts.filter((f) => f.quote);
  return (
    <>
      <section className="card">
        <h3 style={{ fontSize: 18 }}>Why this verdict</h3>
        <p style={{ margin: "6px 0 0", fontWeight: 600 }}>{r.reasons[0]}</p>
        {r.caps.map((c) => <p key={c} className="notice" style={{ marginTop: 8 }}>{c}</p>)}
        {s.score_low != null && (
          <div style={{ display: "grid", gap: 8, marginTop: 14 }}>
            {s.fixed_low != null && (
              <>
                <span className="small muted">Homepage only (a fixed pipeline): {s.fixed_low}–{s.fixed_high} · {s.fixed_verdict ? VERDICT_LABEL[s.fixed_verdict] : ""}</span>
                <RangeBar low={s.fixed_low} high={s.fixed_high ?? s.fixed_low} />
              </>
            )}
            <span className="small">
              After the agent loop: <b>{s.score_low}{s.score_high !== s.score_low ? `–${s.score_high}` : ""}</b> · {s.verdict ? VERDICT_LABEL[s.verdict] : ""}
              {flipped && <span className="pill t-hold" style={{ marginLeft: 8 }}>research changed the verdict</span>}
            </span>
            <RangeBar low={s.score_low} high={s.score_high ?? s.score_low} />
            <span className="small muted">Solid = proven points · striped = still unknown · red mark = 60, the qualify line.</span>
          </div>
        )}
      </section>

      {r.gates.length > 0 && (
        <section>
          <h3 style={{ fontSize: 17, marginBottom: 8 }}>Hard gates</h3>
          <div className="gates">
            {r.gates.map((g) => (
              <div key={g.name} className={`gate ${g.status}`}>
                <div className="gk">{g.name}</div>
                <div className="gv">{g.status === "pass" ? "Pass" : g.status === "fail" ? "Fail" : "Unknown"}</div>
                <div className="gd">{g.detail} <Ev ids={g.factIds} facts={r.facts} /></div>
              </div>
            ))}
          </div>
        </section>
      )}

      {r.signals.length > 0 && (
        <section className="card">
          <h3 style={{ fontSize: 17 }}>100-point rubric · points only with evidence</h3>
          {BLOCKS.map((b) => {
            const sig = r.signals.filter((x) => x.block === b.key);
            const got = sig.reduce((a, x) => a + x.points, 0);
            return (
              <div key={b.key} style={{ marginTop: 14 }}>
                <div className="blockhead">
                  <b><span style={{ display: "inline-block", width: 10, height: 10, borderRadius: 3, background: BLOCK_COLOR[b.key], marginRight: 6 }} />{b.name}</b>
                  <span className="num small">{got}/{b.max}</span>
                </div>
                {sig.map((x) => (
                  <div key={x.key} className="sig">
                    <span>
                      {x.name}
                      {x.external && <span className="small muted"> · external</span>}
                      <span className="why" style={{ display: "block" }}>{x.why} <Ev ids={x.factIds} facts={r.facts} /></span>
                    </span>
                    <span className="sigbar" aria-hidden>
                      <i style={{ width: x.status === "yes" ? "100%" : x.status === "unknown" ? "100%" : "0%", background: x.status === "yes" ? BLOCK_COLOR[b.key] : "repeating-linear-gradient(135deg, var(--line) 0 5px, transparent 5px 10px)" }} />
                    </span>
                    <span className="num small" style={{ textAlign: "right" }}>
                      {x.status === "yes" ? `+${x.points}` : x.status === "unknown" ? `0–${x.max}` : "0"}
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </section>
      )}

      <section>
        <div className="row between" style={{ marginBottom: 8 }}>
          <h3 style={{ fontSize: 17 }}>Evidence ledger · {facts.filter((f) => f.verified).length} verified</h3>
          {facts.length > 6 && <button className="btn sm" onClick={() => setShowAll((v) => !v)}>{showAll ? "Show fewer" : `Show all ${facts.length}`}</button>}
        </div>
        <p className="small muted" style={{ margin: "0 0 10px" }}>A fact counts only if its quote is on the page word for word, or comes from a cited data source. Faded = not found, never used.</p>
        <div style={{ display: "grid", gap: 8 }}>
          {(showAll ? facts : facts.slice(0, 6)).map((f) => (
            <div key={f.id} className={`factcard ${f.verified ? "" : "bad"}`}>
              <div className="row between">
                <span><span className="ev">{f.id}</span><b>{f.value}</b> <span className="small muted">· {f.field.replace(/_/g, " ")}</span></span>
                <span className="small">
                  {f.verified ? <span className="ok-c">✓ verified</span> : <span className="no-c">✗ not found</span>} <span className="muted">· {f.via.replace("_", " ")}</span>
                  {safeHref(f.url) && <> · <a href={safeHref(f.url)} target="_blank" rel="noreferrer noopener">source</a></>}
                </span>
              </div>
              <q>{f.quote}</q>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

function PersonTab({ r }: { r: CompanyResult }) {
  if (!r.poc)
    return <p className="empty">{r.state.status === "no_contact" ? "No named decision-maker was found, and the agent never invents one." : "The company did not qualify, so nobody was looked up."}</p>;
  return (
    <>
      <section className="card">
        <div className="row" style={{ gap: 16 }}>
          <Avatar name={r.poc.name} lg />
          <div>
            <h3 style={{ fontSize: 22 }}>{r.poc.name}</h3>
            <span className="muted">{r.poc.title}</span>
          </div>
        </div>
        <p style={{ margin: "14px 0 10px", color: "var(--ink-2)" }}><b>Why this person:</b> {r.poc.rank_reason}</p>
        <dl className="kv">
          <dt>Found via</dt>
          <dd>{r.pocMethod}</dd>
          <dt>Email</dt>
          <dd className="mono small">{r.poc.email ? `${r.poc.email} · ${r.poc.email_status}` : "not found: never guessed"}</dd>
          {r.poc.source_url && safeHref(r.poc.source_url) && (
            <>
              <dt>Source</dt>
              <dd><a href={r.poc.source_url} target="_blank" rel="noreferrer noopener">open</a></dd>
            </>
          )}
        </dl>
      </section>
      {r.painPoints.length > 0 && (
        <section className="grid g2">
          {r.painPoints.map((p, i) => (
            <div key={i} className={`card`} style={{ background: i ? "#f9d9e3" : "#fbd0c2", borderColor: "transparent" }}>
              <span className="label" style={{ color: "var(--ink-2)" }}>Pain {i + 1}</span>
              <h3 style={{ fontSize: 17, margin: "4px 0 6px" }}>{p.title}</h3>
              <p className="small" style={{ margin: 0, color: "var(--ink-2)" }}>{p.why} <Ev ids={p.factIds} facts={r.facts} /></p>
            </div>
          ))}
        </section>
      )}
      {r.contacts.length > 1 && (
        <section>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Others considered</h3>
          <div style={{ display: "grid", gap: 6 }}>
            {r.contacts.slice(1).map((c) => (
              <div key={c.name + c.title} className="row" style={{ background: "var(--card)", border: "1.5px solid var(--line)", borderRadius: 14, padding: "8px 12px", flexWrap: "nowrap" }}>
                <Avatar name={c.name} />
                <span style={{ flex: 1, minWidth: 0 }}><b>{c.name}</b> <span className="small muted">· {c.title}</span></span>
                <span className="num small muted">fit {c.role_score}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function EmailTab({ r }: { r: CompanyResult }) {
  const { saveEdit, upsert } = useStore();
  const [subject, setSubject] = useState(r.draft?.subject ?? "");
  const [body, setBody] = useState(r.draft?.body ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!r.draft) return <p className="empty">No email: {r.state.status === "not_qualified" || r.state.status === "insufficient_data" ? "the company did not qualify." : "no person was found."}</p>;
  const d = r.draft;
  const send = async () => {
    setBusy(true);
    setMsg("");
    saveEdit(r.domain, subject, body);
    const res = await fetch("/api/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ subject, body, poc: r.poc, company: r.state.company_name ?? r.domain }),
    })
      .then((x) => x.json())
      .catch((e) => ({ status: "failed", error: String(e) }));
    setBusy(false);
    if (res.status === "sent") {
      upsert({ ...r, draft: { ...d, subject, body }, send: res, state: { ...r.state, status: "sent" } });
      setMsg(`Sent to ${res.to}.`);
    } else if (res.status === "not_configured") setMsg("Email sending is not connected on this server. Use the Gmail draft link.");
    else setMsg(`Not sent: ${res.error ?? "unknown error"}`);
  };
  const gmail = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  return (
    <>
      <section className="card" style={{ background: d.passed ? "var(--go-bg)" : "var(--warn-bg)", borderColor: "transparent" }}>
        <div className="row between">
          <h3 style={{ fontSize: 18 }}>{d.passed ? "Passed every check" : "Held: no draft passed"}</h3>
          {d.review && <span className="pill t-info">Reviewer {d.review.avg}/10</span>}
        </div>
        {d.why_this_angle && <p style={{ margin: "6px 0 0" }}><b>Why this angle:</b> {d.why_this_angle}</p>}
        {d.hookFactId && <p className="small" style={{ margin: "6px 0 0" }}>Hook rests on <Ev ids={[d.hookFactId]} facts={r.facts} /> {r.facts.find((f) => f.id === d.hookFactId)?.value}</p>}
        {d.review && (
          <p className="small" style={{ margin: "6px 0 0", color: "var(--ink-2)" }}>
            Specificity {d.review.specificity} · relevance {d.review.relevance} · reply-likelihood {d.review.reply_likelihood}. {d.review.critique}
          </p>
        )}
      </section>
      <section style={{ display: "grid", gap: 10 }}>
        <div className="field">
          <label className="label" htmlFor="subj">Subject</label>
          <input id="subj" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="field">
          <label className="label" htmlFor="body">Body · your edits are remembered and shape the next drafts</label>
          <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 230, fontFamily: "var(--sans)", fontSize: 14.5 }} />
        </div>
        <div className="row">
          <button className="btn primary" onClick={send} disabled={busy || !d.passed}>
            <ISend /> {busy ? "Sending…" : r.state.status === "sent" ? "Send again to my inbox" : "Send to my inbox"}
          </button>
          <a className="btn" href={gmail} target="_blank" rel="noreferrer noopener"><IMail /> Open in Gmail</a>
          <button className="btn sm" onClick={() => { saveEdit(r.domain, subject, body); setMsg("Saved. Your edit will guide the next drafts."); }}>Save edit</button>
        </div>
        {!d.passed && <p className="small muted" style={{ margin: 0 }}>Held emails cannot be sent from here: nothing unchecked goes out.</p>}
        {msg && <p className="notice info" role="status">{msg}</p>}
        {r.send?.status === "sent" && <p className="small muted" style={{ margin: 0 }}>Last sent {r.send.at ? new Date(r.send.at).toLocaleString() : ""} to {r.send.to}. The footer names the intended person.</p>}
      </section>
      <section>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Rules checked in code · {d.checks.filter((c) => c.pass).length}/{d.checks.length}</h3>
        <ul className="rulelist">
          {d.checks.map((c) => (
            <li key={c.name}>
              {c.pass ? <ICheck className="ok-c" /> : <IX className="no-c" />}
              <span>{c.name}{c.detail && !c.pass ? <span className="muted"> ({c.detail})</span> : null}</span>
            </li>
          ))}
        </ul>
      </section>
      {d.attempts.length > 1 && (
        <section>
          <h3 style={{ fontSize: 16, marginBottom: 8 }}>Draft history · {d.attempts.length} of up to 4</h3>
          {d.attempts.map((a) => (
            <details key={a.n} style={{ marginTop: 6 }} className="factcard">
              <summary className="small" style={{ cursor: "pointer", fontWeight: 700 }}>
                Draft {a.n}: {a.checks.filter((c) => !c.pass).length ? `${a.checks.filter((c) => !c.pass).length} rule(s) failed` : `reviewer ${a.review?.avg ?? "–"}/10`}
                {a.review?.unsupported?.length ? " · unsupported claim" : ""}
                {a.passed ? " · kept" : ""}
              </summary>
              <div className="email small" style={{ marginTop: 8 }}>{a.body}</div>
              {a.review?.critique && <p className="small muted">Critique: {a.review.critique}</p>}
            </details>
          ))}
        </section>
      )}
    </>
  );
}

function LogTab({ r }: { r: CompanyResult }) {
  return (
    <>
      <section className="card">
        <h3 style={{ fontSize: 17 }}>Agent loop · {r.loop.length} tool call{r.loop.length === 1 ? "" : "s"}</h3>
        {r.loop.length === 0 ? (
          <p className="small muted">No tool calls needed: the homepage settled it, or a hard gate ended it.</p>
        ) : (
          <div className="turns">
            {r.loop.map((l) => (
              <div key={l.iteration} className="turn" style={{ gridTemplateColumns: "auto minmax(0,1fr)" }}>
                <span className="t">T{l.iteration}</span>
                <span>
                  <b className="mono">{l.tool}({l.args})</b> <span className="muted">· range {l.low}–{l.high} → {l.lowAfter}–{l.highAfter}</span>
                  <span style={{ display: "block" }}>Why: {l.reason}</span>
                  <span className="muted" style={{ display: "block" }}>Got: {l.result}</span>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
      <section>
        <h3 style={{ fontSize: 16, marginBottom: 8 }}>Pages and sources read</h3>
        <div className="tbl-wrap">
          <table className="tbl">
            <tbody>
              {r.pages.map((p, i) => (
                <tr key={i}>
                  <td className="small" style={{ overflowWrap: "anywhere" }}>{p.url}</td>
                  <td className="small muted hide-m">{p.kind}</td>
                  <td><span className={`pill ${p.outcome === "OK" ? "t-go" : p.outcome === "NOT_FOUND" ? "t-muted" : "t-wait"}`}>{p.outcome}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="small muted">{fmtMs(r.ms)} end to end · {r.usage.calls} AI calls · {(r.usage.inTokens + r.usage.outTokens).toLocaleString()} tokens · about ${r.usage.usd.toFixed(4)}</p>
    </>
  );
}

function ReviewTab({ r }: { r: CompanyResult }) {
  const { saveReview } = useStore();
  const [v, setV] = useState(r.review ?? {});
  const [saved, setSaved] = useState(false);
  return (
    <form className="card" onSubmit={(e) => { e.preventDefault(); saveReview(r.domain, v); setSaved(true); }} style={{ display: "grid", gap: 16, maxWidth: 520 }}>
      <p className="small muted" style={{ margin: 0 }}>Your judgement on the agent&apos;s work. It feeds the 30-day kill check: rewrite rate and agreement rate.</p>
      <div className="field">
        <label className="label" htmlFor="agree">Do you agree with the verdict?</label>
        <select id="agree" value={v.lead_agrees ?? ""} onChange={(e) => setV({ ...v, lead_agrees: e.target.value as "yes" | "no" | "" })}>
          <option value="">Not reviewed</option><option value="yes">Yes</option><option value="no">No</option>
        </select>
      </div>
      <div className="field">
        <label className="label" htmlFor="edit">How much did you edit the email?</label>
        <select id="edit" value={v.edit_level ?? ""} onChange={(e) => setV({ ...v, edit_level: e.target.value as "none" | "light" | "heavy" | "" })}>
          <option value="">Not reviewed</option><option value="none">Sent as is</option><option value="light">Light edit</option><option value="heavy">Rewrote it</option>
        </select>
      </div>
      <label className="check"><input type="checkbox" checked={Boolean(v.replied)} onChange={(e) => setV({ ...v, replied: e.target.checked })} /> The prospect replied</label>
      <div className="field">
        <label className="label" htmlFor="notes">Notes</label>
        <textarea id="notes" value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} style={{ minHeight: 90, fontFamily: "var(--sans)" }} />
      </div>
      <div className="row">
        <button className="btn dark" type="submit">Save review</button>
        {saved && <span className="small ok-c" role="status">Saved</span>}
      </div>
    </form>
  );
}

export default function Drawer() {
  const { open, setOpen, accounts } = useStore();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Company");
  const ref = useRef<HTMLDivElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const r = open ? accounts[open] : null;

  useEffect(() => {
    if (!r) return;
    lastFocus.current = document.activeElement as HTMLElement;
    setTab("Company");
    const t = setTimeout(() => ref.current?.querySelector<HTMLElement>("button.x")?.focus(), 30);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "Tab" && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input,select,textarea,summary,[tabindex]:not([tabindex="-1"])')];
        if (!f.length) return;
        if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
        else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
      }
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
      lastFocus.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!r) return null;
  const st = stampFor(r);
  return (
    <>
      <div className="scrim" onClick={() => setOpen(null)} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={ref}>
        <div className="dr-head">
          <button className="x" aria-label="Close" onClick={() => setOpen(null)}><IX /></button>
          <div className="who">
            <ScoreRing low={r.state.score_low} high={r.state.score_high} size={86} dark />
            <div style={{ minWidth: 0 }}>
              <div className="meta">{r.domain}</div>
              <h2 id="drawer-title">{r.state.company_name ?? r.domain}</h2>
              {r.state.one_liner && <div className="meta">{r.state.one_liner}</div>}
              <div className="row" style={{ marginTop: 8 }}>
                <VerdictPill v={r.state.verdict} />
                <StatusPill s={r.state.status} />
                {st && <span className="pill" style={{ background: "rgba(246,241,230,.12)", color: "var(--mango-2)" }}>{st.text}</span>}
              </div>
            </div>
          </div>
          <Journey steps={stepsFromResult(r)} dark />
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="dr-body" role="tabpanel">
          {r.error && <p className="notice">{r.error}</p>}
          {tab === "Company" && <CompanyTab r={r} />}
          {tab === "Person" && <PersonTab r={r} />}
          {tab === "Email" && <EmailTab key={r.domain + (r.draft?.subject ?? "")} r={r} />}
          {tab === "Agent log" && <LogTab r={r} />}
          {tab === "Review" && <ReviewTab key={r.domain} r={r} />}
        </div>
      </div>
    </>
  );
}
