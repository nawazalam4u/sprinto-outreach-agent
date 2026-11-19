"use client";

import Link from "next/link";
import { useLink, useStore } from "./components/store";
import { IAlert, IBook, ICheck, IClock, IFlag, ILock, IMail, IPlay, ISearch, IShield, STEP_ICONS, ITarget } from "./components/Icons";
import { BadgeShelf, BADGES, earned, Reveal, ScoreRing, VERDICT_LABEL, fmtMs } from "./components/ui";
import type { CompanyResult } from "@/lib/types";

const MANUAL_MIN = 17.5; // midpoint of the case's 15-20 minutes per company

const LEVELS = [
  ["Scrape", "Reads the homepage. Respects robots.txt. JS-only sites go through a real browser."],
  ["Extract", "Pulls facts with exact quotes. Code throws out any quote not on the page."],
  ["Qualify", "Scores 0-100 as a range. While 60 is inside it, the agent picks a tool and digs."],
  ["Person", "Picks the owner of the audit by company size. Never sales, never invented."],
  ["Pains", "Two pains for that person, each tied to a quoted fact."],
  ["Email", "16 rules in code, then a fact-checking reviewer. Fails? Rewrite, up to 4 times."],
  ["Send", "To your own inbox only. The footer names who it was for."],
];

function RangeBar({ low, high }: { low: number; high: number }) {
  return (
    <div className="bar-track" role="img" aria-label={`${low} to ${high} out of 100`}>
      <div className="range-band" style={{ left: `${low}%`, width: `${Math.max(1, high - low)}%` }} />
      <div className="bar-fill" style={{ width: `${low}%`, background: low >= 60 ? "var(--go)" : "var(--night-3)" }} />
      <div className="line60" style={{ left: "60%" }} />
    </div>
  );
}

function Overturn({ r }: { r: CompanyResult }) {
  const link = useLink(r.domain);
  const s = r.state;
  return (
    <button className={`mission ${link.className}`} onClick={link.onClick} onMouseEnter={link.onMouseEnter} onMouseLeave={link.onMouseLeave} onFocus={link.onFocus} onBlur={link.onBlur} style={{ gridTemplateColumns: "56px minmax(0,1fr)", alignItems: "center" }}>
      <ScoreRing low={s.score_low} high={s.score_high} size={56} />
      <span style={{ display: "grid", gap: 6 }}>
        <span className="row between">
          <b style={{ fontFamily: "var(--display)" }}>{s.company_name ?? r.domain}</b>
          <span className="small"><span className="muted">{s.fixed_verdict ? VERDICT_LABEL[s.fixed_verdict] : ""}</span> → <b>{s.verdict ? VERDICT_LABEL[s.verdict] : ""}</b></span>
        </span>
        <span className="small muted">Homepage only: {s.fixed_low}–{s.fixed_high}</span>
        <RangeBar low={s.fixed_low ?? 0} high={s.fixed_high ?? 0} />
        <span className="small muted">After {r.loop.length} tool call{r.loop.length === 1 ? "" : "s"}: {s.score_low}{s.score_high !== s.score_low ? `–${s.score_high}` : ""}</span>
        <RangeBar low={s.score_low ?? 0} high={s.score_high ?? 0} />
      </span>
    </button>
  );
}

function NeedRow({ r, why, Icon, tone }: { r: CompanyResult; why: string; Icon: (p: { className?: string }) => React.ReactElement; tone: string }) {
  const link = useLink(r.domain);
  return (
    <button className={`mission ${link.className}`} onClick={link.onClick} onMouseEnter={link.onMouseEnter} onMouseLeave={link.onMouseLeave} onFocus={link.onFocus} onBlur={link.onBlur}>
      <span className="ic" style={{ background: tone }}><Icon /></span>
      <span><b style={{ fontFamily: "var(--display)" }}>{r.state.company_name ?? r.domain}</b> <span className="small muted">· {why}</span></span>
      <span className="xpt">OPEN</span>
    </button>
  );
}

export default function Home() {
  const { list, ready } = useStore();
  const n = list.length;
  const timed = list.filter((r) => r.ms);
  const avgMs = timed.reduce((s, r) => s + (r.ms ?? 0), 0) / Math.max(1, timed.length);
  const avgMin = avgMs / 60000;
  const saved = Math.max(0, n * MANUAL_MIN - (n * avgMs) / 60000);
  const pctSaved = n ? Math.round((1 - avgMin / MANUAL_MIN) * 100) : 0;
  const sent = list.filter((r) => r.state.status === "sent");
  const qualified = list.filter((r) => r.state.verdict === "PRIORITY" || r.state.verdict === "QUALIFY");
  const held = list.filter((r) => r.state.status === "held");
  const excluded = list.filter((r) => r.state.verdict === "DISQUALIFIED" || r.state.verdict === "REJECT" || r.state.verdict === "NURTURE");
  const unclear = list.filter((r) => r.state.status === "insufficient_data" || r.state.status === "failed" || r.state.status === "no_contact");
  const overturned = list.filter((r) => r.state.fixed_verdict && r.state.verdict && r.state.fixed_verdict !== r.state.verdict);
  const loopCalls = list.reduce((s, r) => s + r.loop.length, 0);
  const emails = list.filter((r) => r.draft);
  const reviewed = emails.filter((r) => r.draft?.review);
  const avgReview = reviewed.reduce((s, r) => s + (r.draft!.review!.avg ?? 0), 0) / Math.max(1, reviewed.length);
  const badges = earned(list);
  const level = sent.length >= 5 ? "LEVEL 4 · CLOSER" : sent.length >= 2 ? "LEVEL 3 · HUNTER" : sent.length >= 1 ? "LEVEL 2 · SCOUT" : "LEVEL 1 · ROOKIE";

  const passedGates = list.filter((r) => r.gates.length && !r.gates.some((g) => g.status === "fail"));
  const withPoc = qualified.filter((r) => r.poc);
  const passedEmail = withPoc.filter((r) => r.draft?.passed);
  const river = [
    ["Researched", n],
    ["Passed gates", passedGates.length],
    ["Scored 60+", qualified.length],
    ["Person found", withPoc.length],
    ["Email passed", passedEmail.length],
    ["In your inbox", sent.length],
  ] as const;

  const sample = {
    sent: sent[0],
    out: list.find((r) => r.state.compliance_tool) ?? list.find((r) => r.state.verdict === "DISQUALIFIED"),
    flip: overturned[0],
  };

  const needs: { r: CompanyResult; why: string; Icon: typeof IAlert; tone: string }[] = [
    ...held.map((r) => ({ r, why: "email held: a draft failed a check", Icon: IShield, tone: "var(--warn-bg)" })),
    ...list.filter((r) => r.state.status === "drafted").map((r) => ({ r, why: "passed, waiting for you to send", Icon: IMail, tone: "var(--info-bg)" })),
    ...list.filter((r) => r.state.status === "no_contact").map((r) => ({ r, why: "qualified, but nobody named was found", Icon: ISearch, tone: "var(--wait-bg)" })),
    ...list.filter((r) => r.state.status === "insufficient_data" || r.state.status === "failed").map((r) => ({ r, why: r.pages[0]?.outcome && r.pages[0].outcome !== "OK" ? `site unreadable (${r.pages[0].outcome.toLowerCase()})` : "evidence too thin to call", Icon: IAlert, tone: "var(--hold-bg)" })),
    ...sent.filter((r) => r.review?.replied === undefined).map((r) => ({ r, why: "sent: log whether they replied", Icon: IFlag, tone: "var(--go-bg)" })),
  ];

  return (
    <div>
      <section className="hero">
        <span className="eyebrow">Case 02 · Sprinto · cold outreach at scale</span>
        <h1>
          Every prospect, <em>researched.</em> Every email, <em>earned.</em>
        </h1>
        <p className="lead">
          Paste company domains. The agent reads each site, decides if it fits Sprinto, digs deeper only when it is unsure, finds the person who owns the audit, and sends a cited email to your inbox. 15 to 20 minutes of research becomes about a minute.
        </p>
        <div className="row">
          <Link href="/run?demo=1" className="btn primary lg pulse"><IPlay /> Run the demo</Link>
          <Link href="/brief" className="btn ghost-n lg"><IBook /> Read the brief</Link>
        </div>
        {ready && n > 0 && (
          <div className="float-stack" aria-hidden>
            {sample.sent && (
              <div className="fcard">
                <span className="pill t-go">Sent · {sample.sent.draft?.review?.avg}/10</span>
                <b style={{ marginTop: 6 }}>{sample.sent.state.company_name}</b>
                to {sample.sent.poc?.name}, {sample.sent.poc?.title}
              </div>
            )}
            {sample.out && (
              <div className="fcard">
                <span className="pill t-stop">Kept out</span>
                <b style={{ marginTop: 6 }}>{sample.out.state.company_name ?? sample.out.domain}</b>
                {sample.out.gates.find((g) => g.status === "fail")?.detail ?? "Disqualified"}
              </div>
            )}
            {sample.flip && (
              <div className="fcard">
                <span className="pill t-hold">Loop flipped it</span>
                <b style={{ marginTop: 6 }}>{sample.flip.state.company_name}</b>
                {sample.flip.state.fixed_low}–{sample.flip.state.fixed_high} → {sample.flip.state.score_low} after {sample.flip.loop.length} tool calls
              </div>
            )}
          </div>
        )}
      </section>

      <div className="levels" aria-label="The 7 steps">
        {LEVELS.map(([t, d], i) => {
          const Icon = STEP_ICONS[i];
          return (
            <div key={t} className={`lvl c${i + 1}`}>
              <div className="k">STEP {i + 1}</div>
              <b>{t}</b>
              <p>{d}</p>
              <Icon />
            </div>
          );
        })}
      </div>

      {ready && n === 0 && (
        <div className="empty sec">No runs yet. <Link href="/run?demo=1">Run the demo list</Link> to see the agent work.</div>
      )}

      {ready && n > 0 && (
        <>
          <section className="sec quest">
            <ScoreRing low={pctSaved} high={pctSaved} size={112} dark label="% time saved" />
            <div style={{ position: "relative", zIndex: 1 }}>
              <span className="lvlname">{level}</span>
              <h2>
                {n} companies in <em>{fmtMs(avgMs)}</em> each
              </h2>
              <div className="xp" role="img" aria-label={`${Math.round(saved)} of ${Math.round(n * MANUAL_MIN)} minutes of manual research saved`}>
                <i style={{ width: `${Math.min(100, pctSaved)}%` }} />
              </div>
              <div className="rules">
                <b>{Math.round(saved)} minutes</b> of research saved against {MANUAL_MIN} min by hand · <b>{badges.size}/{BADGES.length}</b> badges · {sent.length} email{sent.length === 1 ? "" : "s"} in your inbox
              </div>
            </div>
            <BadgeShelf list={list} />
          </section>

          <div className="tiles sec" style={{ marginTop: 14 }}>
            <div className="tile n"><IClock /><div className="v">{avgMin.toFixed(1)}m</div><div className="l">per company</div><div className="d">vs {MANUAL_MIN} by hand</div></div>
            <div className="tile c2"><ICheck /><div className="v">{qualified.length}</div><div className="l">qualified</div><div className="d">scored 60+ of {n}</div></div>
            <div className="tile c1"><IMail /><div className="v">{sent.length}</div><div className="l">sent to inbox</div><div className="d">passed 16 rules + review</div></div>
            <div className="tile c4"><IShield /><div className="v">{held.length}</div><div className="l">held</div><div className="d">a check failed, not sent</div></div>
            <div className="tile c3"><ILock /><div className="v">{excluded.length}</div><div className="l">kept out</div><div className="d">wrong fit, rival, or customer</div></div>
            <div className="tile c5"><ITarget /><div className="v">{overturned.length}</div><div className="l">verdicts flipped</div><div className="d">by {loopCalls} agent tool calls</div></div>
          </div>

          <Reveal>
            <div className="sec-title">
              <h2>The funnel, <em>with reasons</em></h2>
              <span className="sub">Most companies should not get an email. Every drop has a written reason you can disagree with.</span>
            </div>
            <div className="card" style={{ display: "grid", gridTemplateColumns: `repeat(${river.length}, minmax(0,1fr))`, padding: 0, overflow: "hidden" }}>
              {river.map(([l, v], i) => (
                <div key={l} style={{ padding: "14px 16px", borderRight: i < river.length - 1 ? "1.5px dashed var(--line)" : 0, position: "relative" }}>
                  <b style={{ fontFamily: "var(--display)", fontSize: 28, display: "block", lineHeight: 1 }}>{v}</b>
                  <span className="small" style={{ fontWeight: 600, color: "var(--ink-2)" }}>{l}</span>
                  <i style={{ position: "absolute", left: 0, bottom: 0, height: 5, width: `${(v / Math.max(1, n)) * 100}%`, background: "linear-gradient(90deg, var(--mint), var(--mango))" }} />
                </div>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 8 }}>
              {unclear.length ? `${unclear.length} could not be called either way and went to "Needs you". ` : ""}Bars under each number are drawn to scale against the {n} researched.
            </p>
          </Reveal>

          <Reveal>
            <div className="grid g2" style={{ alignItems: "start" }}>
              <div>
                <div className="sec-title">
                  <h2>One page is <em>not enough</em></h2>
                  <span className="sub">A fixed pipeline judges from the homepage. The agent keeps digging while the 60 line sits inside the score range.</span>
                </div>
                <div style={{ display: "grid", gap: 10 }}>
                  {overturned.length ? overturned.slice(0, 4).map((r) => <Overturn key={r.domain} r={r} />) : <p className="muted">No verdict changed in this set.</p>}
                </div>
                <p className="small muted" style={{ marginTop: 8 }}>Solid bar = proven points · striped = still unknown · red mark = 60, the qualify line.</p>
              </div>
              <div>
                <div className="sec-title">
                  <h2>Nothing unchecked <em>goes out</em></h2>
                  <span className="sub">16 rules in code, then a reviewer that fact-checks and scores. Pass line 7/10.</span>
                </div>
                <div className="card" style={{ display: "grid", gap: 14 }}>
                  {emails.length === 0 && <p className="muted">No emails written yet.</p>}
                  {emails.map((r) => (
                    <div key={r.domain}>
                      <div className="row between small">
                        <span><b>{r.state.company_name ?? r.domain}</b> <span className={`pill ${r.draft!.passed ? (r.state.status === "sent" ? "t-go" : "t-info") : "t-warn"}`}>{r.draft!.passed ? (r.state.status === "sent" ? "sent" : "passed") : "held"}</span></span>
                        <span className="num">{r.draft!.review ? `${r.draft!.review.avg}/10` : "–"}</span>
                      </div>
                      <div className="bar-track" style={{ height: 9, marginTop: 6 }}>
                        <div className="bar-fill" style={{ width: `${(r.draft!.review?.avg ?? 0) * 10}%`, background: r.draft!.passed ? "var(--go)" : "var(--coral)" }} />
                        <div className="line60" style={{ left: "70%" }} />
                      </div>
                    </div>
                  ))}
                  {reviewed.length > 0 && <p className="small muted" style={{ margin: 0 }}>Average reviewer score {avgReview.toFixed(1)}/10 · red mark = 7, the pass line.</p>}
                </div>
              </div>
            </div>
          </Reveal>

          <Reveal>
            <div className="sec-title">
              <h2>Needs <em>you</em></h2>
              <span className="sub">The agent decides everything it can. These are the {needs.length} places where your judgement adds something it cannot.</span>
            </div>
            <div style={{ display: "grid", gap: 8 }}>
              {needs.length ? needs.map((x, i) => <NeedRow key={x.r.domain + i} {...x} />) : <p className="muted">Nothing waiting.</p>}
            </div>
          </Reveal>
        </>
      )}
    </div>
  );
}
