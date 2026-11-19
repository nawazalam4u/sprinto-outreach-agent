// The 7-step pipeline for one domain. Emits live events so the UI can show every step.
// One bad domain never stops a batch: every failure becomes a status with a reason.

import { extractFacts, regexFacts, resetFactIds } from "./extract";
import { newUsage } from "./gemini";
import { findPoc } from "./poc";
import { emptyState, gatesFor, runAgentLoop, scoreSignals, deriveState, verdictFor, type LoopCtx } from "./qualify";
import { classifyLinks, fetchPage, normalizeDomain } from "./scrape";
import { gmailComposeUrl, scrub, sendEmail, senderName } from "./send";
import type { CompanyResult, ManualPoc, RunEvent, StepId, StyleExample, Verdict } from "./types";
import { painPoints, writeEmail } from "./write";

export type RunInput = { domain: string; autoSend: boolean; manualPoc?: ManualPoc | null; style?: StyleExample[] };

const STEP_TITLES: Record<StepId, string> = {
  1: "Scrape website",
  2: "Extract facts",
  3: "Qualify (agent loop)",
  4: "Find the person",
  5: "Two pain points",
  6: "Write and check email",
  7: "Send to my inbox",
};

const label = (v: Verdict) => v.replace("_", " ").toLowerCase();

export async function runPipeline(input: RunInput, emit: (e: RunEvent) => void): Promise<CompanyResult> {
  const t0 = Date.now();
  const domain = normalizeDomain(input.domain);
  resetFactIds();
  const usage = newUsage();
  const state = emptyState(domain);
  const result: CompanyResult = {
    domain,
    startedAt: new Date().toISOString(),
    state,
    pages: [],
    facts: [],
    loop: [],
    gates: [],
    signals: [],
    caps: [],
    reasons: [],
    contacts: [],
    poc: null,
    pocMethod: "",
    painPoints: [],
    draft: null,
    send: null,
    usage,
  };
  const step = (s: StepId, status: "running" | "done" | "skipped" | "error", detail?: string) =>
    emit({ type: "step", step: s, status, title: STEP_TITLES[s], detail });
  const log = (s: StepId) => (message: string) => emit({ type: "log", step: s, message });
  const skipRest = (from: StepId, why: string) => {
    for (let s = from; s <= 7; s++) step(s as StepId, "skipped", why);
  };

  const ctx: LoopCtx = {
    domain,
    state,
    pages: [],
    facts: [],
    loop: [],
    usage,
    links: {},
    homeHash: "",
    atsRead: false,
    securityTried: false,
    emit: log(3),
  };
  const sync = () => {
    result.pages = ctx.pages.map(({ url, kind, ok, outcome, via, words, error, ms }) => ({ url, kind, ok, outcome, via, words, error, ms }));
    result.facts = ctx.facts;
    result.loop = ctx.loop;
  };
  const finish = () => {
    sync();
    result.finishedAt = new Date().toISOString();
    result.ms = Date.now() - t0;
    emit({ type: "state", state });
    return result;
  };

  try {
    // ---------- 1. Scrape (single fetch of the homepage: what a fixed pipeline would read)
    step(1, "running");
    let home = await fetchPage(`https://${domain}`, "home");
    if (!home.ok) {
      const www = await fetchPage(`https://www.${domain}`, "home");
      if (www.ok) home = www;
    }
    state.pages_tried.push(home.url);
    ctx.pages.push(home);
    if (!home.ok) {
      step(1, "error", `${home.outcome}: ${home.error ?? "homepage unreadable"}`);
      skipRest(2, "Site unreadable");
      state.status = "insufficient_data";
      state.verdict = "INSUFFICIENT_DATA";
      result.reasons = [`Could not read ${domain} (${home.outcome}). Unreadable is unknown, not a no: logged for a human, batch continues.`];
      return finish();
    }
    state.pages_read.push("home");
    ctx.homeHash = home.hash;
    ctx.links = classifyLinks(home.links, domain);
    const found = Object.entries(ctx.links).map(([k, v]) => `${k} ${v.length}`).join(" · ");
    step(1, "done", `${home.words} clean words via ${home.via}${found ? ` · links: ${found}` : ""}`);

    // ---------- 2. Extract
    step(2, "running");
    ctx.facts.push(...regexFacts(home));
    ctx.facts.push(...(await extractFacts([home], domain, usage)));
    deriveState(state, ctx.facts, false);
    const v = ctx.facts.filter((f) => f.verified).length;
    step(2, "done", `${ctx.facts.length} facts, ${v} verified word-for-word against the page`);

    // fixed-pipeline verdict: what we'd decide from the homepage alone
    const fixed = scoreSignals({ state, facts: ctx.facts, pages: ctx.pages, atsRead: false, securityTried: false });
    state.fixed_low = fixed.low;
    state.fixed_high = fixed.high;
    state.fixed_verdict = verdictFor(gatesFor(state, ctx.facts), fixed.low, fixed.high);
    emit({ type: "state", state });

    // ---------- 3. Qualify with the agent loop
    step(3, "running", `Homepage alone: ${fixed.low}–${fixed.high} (${label(state.fixed_verdict)})`);
    const sc = await runAgentLoop(ctx);
    const gates = gatesFor(state, ctx.facts);
    const verdict = verdictFor(gates, sc.low, sc.high);
    Object.assign(state, { verdict, score_low: sc.low, score_high: sc.high });
    result.gates = gates;
    result.signals = sc.signals;
    result.caps = sc.caps;
    const failed = gates.find((g) => g.status === "fail");
    result.reasons = [
      failed ? `Disqualified: ${failed.detail}.` : `Score ${sc.low}${sc.high !== sc.low ? `–${sc.high}` : ""} of 100 against the 60 line → ${label(verdict)}.`,
      ...sc.caps,
      ...sc.signals.filter((s) => s.status === "yes").map((s) => `+${s.points} ${s.name}: ${s.why}`),
    ];
    if (state.fixed_verdict !== verdict) result.reasons.push(`The agent loop changed the verdict: homepage alone said ${label(state.fixed_verdict)}, research says ${label(verdict)}.`);
    sync();
    emit({ type: "state", state });
    step(3, "done", `${label(verdict)} · ${sc.low}${sc.high !== sc.low ? `–${sc.high}` : ""}/100 · ${ctx.loop.length} tool call${ctx.loop.length === 1 ? "" : "s"}${state.fixed_verdict !== verdict ? ` · overturned "${label(state.fixed_verdict)}"` : ""}`);

    if (verdict !== "PRIORITY" && verdict !== "QUALIFY") {
      state.status = verdict === "INSUFFICIENT_DATA" ? "insufficient_data" : "not_qualified";
      skipRest(4, verdict === "INSUFFICIENT_DATA" ? "Not enough evidence to qualify" : "Not qualified");
      return finish();
    }

    // ---------- 4. PoC
    step(4, "running");
    const { poc, contacts, method } = await findPoc(state, usage, input.manualPoc ?? null, log(4));
    result.poc = poc;
    result.contacts = contacts;
    result.pocMethod = method;
    if (!poc) {
      state.status = "no_contact";
      step(4, "error", `${method}: no named decision-maker found. Never invented: handed to you.`);
      skipRest(5, "No contact");
      return finish();
    }
    step(4, "done", `${poc.name}, ${poc.title} · ${method}`);

    // ---------- 5. Pain points
    step(5, "running");
    try {
      result.painPoints = await painPoints(state, poc, ctx.facts, usage);
    } catch (e) {
      step(5, "error", `AI unavailable: ${scrub((e as Error).message).slice(0, 80)}`);
      skipRest(6, "Held: AI unavailable, nothing sent");
      state.status = "held";
      result.send = { status: "held", reason: "AI model unavailable while writing; re-run later" };
      return finish();
    }
    step(5, "done", result.painPoints.map((p) => p.title).join(" · "));

    // ---------- 6. Draft, validate in code, AI review, rewrite (max 4)
    step(6, "running");
    let draft;
    try {
      draft = await writeEmail(state, poc, result.painPoints, ctx.facts, usage, input.style ?? [], senderName(), log(6), t0 + 240_000);
    } catch (e) {
      step(6, "error", `AI unavailable: ${scrub((e as Error).message).slice(0, 80)}`);
      step(7, "skipped", "Held: nothing is sent without a checked draft");
      state.status = "held";
      result.send = { status: "held", reason: "AI model unavailable while writing; re-run later" };
      return finish();
    }
    result.draft = draft;
    const last = draft.attempts[draft.attempts.length - 1];
    step(
      6,
      draft.passed ? "done" : "error",
      draft.passed
        ? `"${draft.subject}" · all ${draft.checks.length} rules pass · reviewer ${draft.review?.avg}/10 · draft ${last.n} of up to 4`
        : `No draft passed after ${draft.attempts.length} tries: held, nothing sent`,
    );

    // ---------- 7. Send or hold
    if (!draft.passed) {
      state.status = "held";
      result.send = { status: "held", reason: "No draft passed every rule and the reviewer bar" };
      step(7, "skipped", "Held: nothing is sent without a passing draft");
      return finish();
    }
    if (!input.autoSend) {
      state.status = "drafted";
      result.send = { status: "skipped", gmailComposeUrl: gmailComposeUrl(draft.subject, draft.body), reason: "Auto-send off" };
      step(7, "skipped", "Auto-send off: send it from the account drawer");
      return finish();
    }
    step(7, "running");
    const send = await sendEmail(draft.subject, draft.body, poc, state.company_name ?? domain);
    result.send = send;
    state.status = send.status === "sent" ? "sent" : send.status === "failed" ? "failed" : "drafted";
    step(
      7,
      send.status === "sent" ? "done" : "error",
      send.status === "sent" ? `Sent to your inbox (${send.to}) · intended for ${poc.name}` : send.status === "not_configured" ? "Email sending not connected on this server: Gmail draft link ready" : `Send failed: ${send.error}`,
    );
    return finish();
  } catch (e) {
    result.error = scrub((e as Error).message);
    state.status = "failed";
    emit({ type: "fatal", error: result.error });
    return finish();
  }
}
