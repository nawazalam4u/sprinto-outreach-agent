"use client";

// Account drawer: Company (verdicts + signals with evidence), Person, Email, Activity, Review.
// Focus is trapped inside; Esc closes. All scraped text renders as plain text (React escapes it).

import { useEffect, useRef, useState } from "react";
import { useStore } from "./store";
import { RangeBar, StatusPill, VerdictPill, VERDICT_LABEL, fmtMs } from "./ui";
import type { CompanyResult, Fact } from "@/lib/types";
import { BLOCKS } from "@/lib/icp";

const TABS = ["Company", "Person", "Email", "Activity", "Review"] as const;

function Ev({ ids, facts }: { ids: string[]; facts: Fact[] }) {
  if (!ids.length) return null;
  return (
    <>
      {ids.map((id) => {
        const f = facts.find((x) => x.id === id);
        return (
          <span key={id} className="ev" title={f ? `${f.value} — "${f.quote}"` : id}>
            {id}
          </span>
        );
      })}
    </>
  );
}

function safeHref(u: string) {
  return /^https?:\/\//i.test(u) ? u : undefined;
}

function CompanyTab({ r }: { r: CompanyResult }) {
  const s = r.state;
  const overturned = s.fixed_verdict && s.verdict && s.fixed_verdict !== s.verdict;
  const blocks = ["firmographic", "upmarket", "trigger", "fit"];
  const blockName: Record<string, string> = Object.fromEntries(BLOCKS.map((b) => [b.key, `${b.name} · ${b.max}`]));
  return (
    <div style={{ display: "grid", gap: 36 }}>
      <section>
        <h3>Why this company</h3>
        <ul style={{ paddingLeft: 18, margin: "10px 0 0", color: "var(--ink-2)" }}>
          {r.reasons.map((x, i) => (
            <li key={i}>{x}</li>
          ))}
        </ul>
      </section>
      {s.score_low != null && (
        <section>
          <h3>Score against the 60 line</h3>
          <div style={{ display: "grid", gap: 14, marginTop: 14 }}>
            {s.fixed_low != null && (
              <div>
                <div className="small muted">Homepage only (a fixed pipeline): {s.fixed_low}–{s.fixed_high} · {s.fixed_verdict ? VERDICT_LABEL[s.fixed_verdict] : ""}</div>
                <RangeBar low={s.fixed_low} high={s.fixed_high ?? s.fixed_low} />
              </div>
            )}
            <div>
              <div className="small">
                After the agent loop: <b>{s.score_low}–{s.score_high}</b> · {s.verdict ? VERDICT_LABEL[s.verdict] : ""}
                {overturned ? <span style={{ color: "var(--shu)" }}> · verdict changed by research</span> : null}
              </div>
              <RangeBar low={s.score_low} high={s.score_high ?? s.score_low} />
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              Dark bar = points proven by evidence. Pale band = points still unknown. Red line = 60, the qualify line.
            </p>
          </div>
        </section>
      )}
      {r.gates.length > 0 && (
        <section>
          <h3>Hard gates</h3>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <tbody>
                {r.gates.map((g) => (
                  <tr key={g.name} style={{ cursor: "default" }}>
                    <td style={{ width: 110 }}>
                      <span className={`pill ${g.status === "pass" ? "go" : g.status === "fail" ? "no" : "warn"}`}>{g.status}</span>
                    </td>
                    <td>
                      <b style={{ fontWeight: 500 }}>{g.name}</b>
                      <div className="small muted">{g.detail}</div>
                    </td>
                    <td className="r">
                      <Ev ids={g.factIds} facts={r.facts} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {r.signals.length > 0 && (
        <section>
          <h3>Rubric: 15 signals, points only with evidence</h3>
          {r.caps.map((c) => (
            <p key={c} className="notice" style={{ marginTop: 10 }}>{c}</p>
          ))}
          {blocks.map((b) => (
            <div key={b} style={{ marginTop: 18 }}>
              <div className="label">{blockName[b]}</div>
              <div className="table-wrap" style={{ borderTopWidth: 1 }}>
                <table>
                  <tbody>
                    {r.signals
                      .filter((x) => x.block === b)
                      .map((x) => (
                        <tr key={x.key} style={{ cursor: "default" }}>
                          <td className="num r" style={{ width: 64 }}>
                            {x.status === "yes" ? `+${x.points}` : x.status === "unknown" ? `0–${x.max}` : "0"}
                            <span className="muted">/{x.max}</span>
                          </td>
                          <td>
                            {x.name}
                            {x.external && <span className="small muted"> · external</span>}
                            <div className="small muted">{x.why}</div>
                          </td>
                          <td style={{ width: 90 }}>
                            <span className={`pill ${x.status === "yes" ? "go" : x.status === "unknown" ? "warn" : ""}`}>{x.status}</span>
                          </td>
                          <td className="r" style={{ width: 90 }}>
                            <Ev ids={x.factIds} facts={r.facts} />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </section>
      )}
      <section>
        <h3>Evidence ledger</h3>
        <p className="small muted" style={{ margin: "4px 0 10px" }}>
          A fact counts only if its quote was found word-for-word on the page (or Google returned a cited source). Unverified facts are shown, never used.
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Fact and quote</th>
                <th>Source</th>
              </tr>
            </thead>
            <tbody>
              {r.facts
                .filter((f) => f.quote)
                .map((f) => (
                  <tr key={f.id} style={{ cursor: "default", opacity: f.verified ? 1 : 0.55 }}>
                    <td className="mono small">{f.id}</td>
                    <td>
                      <span className="small muted">{f.field.replace(/_/g, " ")} · </span>
                      {f.value}
                      <blockquote className="q">“{f.quote}”</blockquote>
                    </td>
                    <td className="small" style={{ minWidth: 120 }}>
                      {f.verified ? <span className="ok-mark">✓ verified</span> : <span className="no-mark">✗ not found</span>}
                      <div className="muted">{f.via.replace("_", " ")}</div>
                      {safeHref(f.url) && (
                        <a href={safeHref(f.url)} target="_blank" rel="noreferrer noopener">
                          open
                        </a>
                      )}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function PersonTab({ r }: { r: CompanyResult }) {
  if (!r.poc) return <p className="muted">No contact: {r.state.status === "no_contact" ? "no named decision-maker was found, and the system never invents one." : "the company did not qualify, so no person was looked up."}</p>;
  return (
    <div style={{ display: "grid", gap: 32 }}>
      <section>
        <div className="label">Why this person</div>
        <h3 style={{ fontSize: 22, fontFamily: "var(--mincho)", fontWeight: 500, marginTop: 6 }}>
          {r.poc.name} <span className="muted" style={{ fontSize: 16 }}>· {r.poc.title}</span>
        </h3>
        <p style={{ color: "var(--ink-2)" }}>{r.poc.rank_reason}</p>
        <dl className="kv">
          <dt>Found via</dt>
          <dd>{r.pocMethod}</dd>
          <dt>Email</dt>
          <dd className="mono small">{r.poc.email || "not found (Hunter key needed): never guessed"}{r.poc.email ? ` · ${r.poc.email_status}` : ""}</dd>
          {r.poc.source_url && safeHref(r.poc.source_url) && (
            <>
              <dt>Source</dt>
              <dd>
                <a href={r.poc.source_url} target="_blank" rel="noreferrer noopener">
                  open source
                </a>
              </dd>
            </>
          )}
        </dl>
      </section>
      {r.painPoints.length > 0 && (
        <section>
          <div className="label">Their two likely pains</div>
          {r.painPoints.map((p, i) => (
            <div key={i} style={{ marginTop: 14 }}>
              <b style={{ fontWeight: 500 }}>
                {i + 1}. {p.title}
              </b>{" "}
              <Ev ids={p.factIds} facts={r.facts} />
              <p style={{ margin: "4px 0 0", color: "var(--ink-2)" }}>{p.why}</p>
            </div>
          ))}
        </section>
      )}
      {r.contacts.length > 1 && (
        <section>
          <div className="label">Other people considered</div>
          <div className="table-wrap" style={{ marginTop: 8 }}>
            <table>
              <tbody>
                {r.contacts.slice(1).map((c) => (
                  <tr key={c.name} style={{ cursor: "default" }}>
                    <td>{c.name}</td>
                    <td className="muted">{c.title}</td>
                    <td className="num r">{c.role_score}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

function EmailTab({ r }: { r: CompanyResult }) {
  const { saveEdit, upsert } = useStore();
  const [subject, setSubject] = useState(r.draft?.subject ?? "");
  const [body, setBody] = useState(r.draft?.body ?? "");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  if (!r.draft) return <p className="muted">No email: {r.state.status === "not_qualified" || r.state.status === "insufficient_data" ? "the company did not qualify." : "no contact was found."}</p>;
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
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div className="label">Why this email</div>
          <span className={`pill ${d.passed ? "go" : "warn"}`}>{d.passed ? "Passed every check" : "Held: no draft passed"}</span>
        </div>
        {d.why_this_angle && <p style={{ color: "var(--ink-2)", margin: "8px 0 0" }}>{d.why_this_angle}</p>}
        {d.hookFactId && (
          <p className="small" style={{ margin: "8px 0 0" }}>
            Hook rests on <Ev ids={[d.hookFactId]} facts={r.facts} /> {r.facts.find((f) => f.id === d.hookFactId)?.value}
          </p>
        )}
        {d.review && (
          <p className="small muted" style={{ margin: "8px 0 0" }}>
            AI reviewer: specificity {d.review.specificity} · relevance {d.review.relevance} · reply-likelihood {d.review.reply_likelihood} → <b>{d.review.avg}/10</b> (pass line 7). {d.review.critique}
          </p>
        )}
      </section>
      <section style={{ display: "grid", gap: 10 }}>
        <div className="field">
          <label htmlFor="subj">SUBJECT</label>
          <input id="subj" type="text" value={subject} onChange={(e) => setSubject(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="body">BODY · edits are remembered and shape the next drafts</label>
          <textarea id="body" value={body} onChange={(e) => setBody(e.target.value)} style={{ minHeight: 230, fontFamily: "var(--sans)", fontSize: 14 }} />
        </div>
        <div className="row">
          <button className="btn" onClick={send} disabled={busy || !d.passed}>
            {busy ? "Sending…" : r.state.status === "sent" ? "Send again to my inbox" : "Send to my inbox"}
          </button>
          {r.send?.gmailComposeUrl && (
            <a className="btn ghost" href={r.send.gmailComposeUrl} target="_blank" rel="noreferrer noopener">
              Open as Gmail draft
            </a>
          )}
          <button className="btn ghost sm" onClick={() => (saveEdit(r.domain, subject, body), setMsg("Saved. Your edit will guide the next drafts."))}>
            Save edit
          </button>
        </div>
        {!d.passed && <p className="small muted">Held emails cannot be sent from here: fix the draft and re-run, so nothing unchecked goes out.</p>}
        {msg && <p className="notice info" role="status">{msg}</p>}
        {r.send?.status === "sent" && <p className="small muted">Last sent {r.send.at ? new Date(r.send.at).toLocaleString() : ""} to {r.send.to} (your inbox only; the prospect is named in the footer).</p>}
      </section>
      <section>
        <div className="label">Rules checked in code ({d.checks.filter((c) => c.pass).length}/{d.checks.length})</div>
        <ul className="list-rules" style={{ marginTop: 10 }}>
          {d.checks.map((c) => (
            <li key={c.name}>
              <span className={c.pass ? "ok-mark" : "no-mark"} aria-hidden>
                {c.pass ? "✓" : "✗"}
              </span>
              <span>
                {c.name}
                {c.detail && !c.pass ? <span className="muted"> ({c.detail})</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </section>
      {d.attempts.length > 1 && (
        <section>
          <div className="label">Draft history ({d.attempts.length} of up to 4)</div>
          {d.attempts.map((a) => (
            <details key={a.n} style={{ marginTop: 8 }}>
              <summary className="small" style={{ cursor: "pointer" }}>
                Draft {a.n}: {a.checks.filter((c) => !c.pass).length ? `${a.checks.filter((c) => !c.pass).length} rule(s) failed` : `reviewer ${a.review?.avg ?? "—"}/10`} {a.passed ? "· kept" : ""}
              </summary>
              <div className="email small" style={{ marginTop: 8 }}>{a.body}</div>
              {a.review?.critique && <p className="small muted">Critique: {a.review.critique}</p>}
            </details>
          ))}
        </section>
      )}
    </div>
  );
}

function ActivityTab({ r }: { r: CompanyResult }) {
  return (
    <div style={{ display: "grid", gap: 28 }}>
      <section>
        <div className="label">Agent loop</div>
        {r.loop.length === 0 ? (
          <p className="muted small">No tool calls needed: the homepage settled the verdict (or a gate ended it).</p>
        ) : (
          <ol style={{ paddingLeft: 18, margin: "10px 0 0" }}>
            {r.loop.map((l) => (
              <li key={l.iteration} style={{ marginBottom: 12 }}>
                <span className="mono small">
                  {l.tool}({l.args})
                </span>{" "}
                <span className="small muted">
                  range {l.low}–{l.high} → {l.lowAfter}–{l.highAfter}
                </span>
                <div className="small" style={{ color: "var(--ink-2)" }}>Why: {l.reason}</div>
                <div className="small muted">Result: {l.result}</div>
              </li>
            ))}
          </ol>
        )}
      </section>
      <section>
        <div className="label">Pages read</div>
        <div className="table-wrap" style={{ marginTop: 8 }}>
          <table>
            <tbody>
              {r.pages.map((p, i) => (
                <tr key={i} style={{ cursor: "default" }}>
                  <td className="small" style={{ overflowWrap: "anywhere" }}>{p.url}</td>
                  <td className="small muted">{p.kind}</td>
                  <td>
                    <span className={`pill ${p.outcome === "OK" ? "go" : p.outcome === "NOT_FOUND" ? "" : "warn"}`}>{p.outcome}</span>
                  </td>
                  <td className="small muted r">{p.via}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section>
        <div className="label">Run cost</div>
        <p className="small">
          {fmtMs(r.ms)} end to end · {r.usage.calls} Gemini calls · {(r.usage.inTokens + r.usage.outTokens).toLocaleString()} tokens · ≈ ${r.usage.usd.toFixed(4)}
        </p>
      </section>
    </div>
  );
}

function ReviewTab({ r }: { r: CompanyResult }) {
  const { saveReview } = useStore();
  const [v, setV] = useState(r.review ?? {});
  const [saved, setSaved] = useState(false);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        saveReview(r.domain, v);
        setSaved(true);
      }}
      style={{ display: "grid", gap: 18, maxWidth: 460 }}
    >
      <p className="small muted" style={{ margin: 0 }}>
        Your judgement on the system&apos;s work. This feeds the 30-day kill check (rewrite rate, agreement rate).
      </p>
      <div className="field">
        <label htmlFor="agree">DO YOU AGREE WITH THE VERDICT?</label>
        <select id="agree" value={v.lead_agrees ?? ""} onChange={(e) => setV({ ...v, lead_agrees: e.target.value as "yes" | "no" | "" })}>
          <option value="">Not reviewed</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      </div>
      <div className="field">
        <label htmlFor="edit">HOW MUCH DID YOU EDIT THE EMAIL?</label>
        <select id="edit" value={v.edit_level ?? ""} onChange={(e) => setV({ ...v, edit_level: e.target.value as "none" | "light" | "heavy" | "" })}>
          <option value="">Not reviewed</option>
          <option value="none">Sent as is</option>
          <option value="light">Light edit</option>
          <option value="heavy">Rewrote it</option>
        </select>
      </div>
      <label className="check">
        <input type="checkbox" checked={Boolean(v.replied)} onChange={(e) => setV({ ...v, replied: e.target.checked })} /> The prospect replied
      </label>
      <div className="field">
        <label htmlFor="notes">NOTES</label>
        <textarea id="notes" value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} style={{ minHeight: 90, fontFamily: "var(--sans)" }} />
      </div>
      <div className="row">
        <button className="btn" type="submit">
          Save review
        </button>
        {saved && <span className="small muted" role="status">Saved</span>}
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
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
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
  return (
    <>
      <div className="scrim" onClick={() => setOpen(null)} aria-hidden />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" ref={ref}>
        <div className="head">
          <button className="x" aria-label="Close" onClick={() => setOpen(null)}>
            ✕
          </button>
          <div className="small muted">{r.domain}</div>
          <h2 id="drawer-title" className="sec" style={{ marginTop: 2, paddingRight: 40 }}>
            {r.state.company_name ?? r.domain}
          </h2>
          {r.state.one_liner && <p className="small muted" style={{ margin: "4px 0 0" }}>{r.state.one_liner}</p>}
          <div className="row" style={{ marginTop: 10 }}>
            <VerdictPill v={r.state.verdict} />
            <StatusPill s={r.state.status} />
          </div>
          <div className="tabs" role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="body" role="tabpanel">
          {r.error && <p className="notice">{r.error}</p>}
          {tab === "Company" && <CompanyTab r={r} />}
          {tab === "Person" && <PersonTab r={r} />}
          {tab === "Email" && <EmailTab key={r.domain + (r.draft?.subject ?? "")} r={r} />}
          {tab === "Activity" && <ActivityTab r={r} />}
          {tab === "Review" && <ReviewTab key={r.domain} r={r} />}
        </div>
      </div>
    </>
  );
}
