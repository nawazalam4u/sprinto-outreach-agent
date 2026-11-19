// Steps 5 + 6: two pain points for THIS person, then the email.
// The model writes; CODE validates every rule; an AI reviewer scores the survivors.
// Up to 4 drafts. Keep the best passing one. If none passes, the email is HELD, never sent.

import { BANNED_PHRASES, SPRINTO_FACTS } from "./icp";
import { geminiJson, type Usage } from "./gemini";
import { monthsAgo } from "./qualify";
import type { Check, CompanyState, Contact, Draft, DraftAttempt, Fact, PainPoint, StyleExample } from "./types";

const MAX_DRAFTS = 4;
const REVIEW_PASS = 7;

const usable = (facts: Fact[]) =>
  facts.filter((f) => f.verified && f.quote && !f.value.startsWith("name:") && !f.value.startsWith("oneliner:"));

function factSheet(facts: Fact[]) {
  return usable(facts)
    .slice(0, 40)
    .map((f) => `${f.id} [${f.field}] ${f.value} | quote: "${f.quote.slice(0, 160)}" | ${f.via === "web_search" ? "news/web" : "their site"}`)
    .join("\n");
}

export async function painPoints(state: CompanyState, poc: Contact, facts: Fact[], usage: Usage): Promise<PainPoint[]> {
  const { data } = await geminiJson<{ pain_points: { title: string; why: string; fact_ids: string[] }[] }>({
    usage,
    system: "You are a senior B2B sales strategist for Sprinto (compliance automation). You reason from evidence only and never invent facts.",
    prompt: `Company: ${state.company_name ?? state.domain} (${state.domain})
What they sell: ${state.one_liner ?? "see facts"}
Stage: ${state.funding_stage ?? "unknown"} · headcount: ${state.headcount ?? "unknown"} · certifications: ${state.certifications.join(", ") || "none published"} (${state.certification_status})
Person: ${poc.name}, ${poc.title}

Evidence ledger (cite by id):
${factSheet(facts)}

Name the TWO most likely compliance pain points for THIS person in THIS role now.
Each must: cite at least one evidence id, name the data their product handles, and name who their buyer is (because the buyer is who demands proof of security).
Examples of what lands on this desk: enterprise deals waiting on a security questionnaire, SOC 2 / ISO 27001 prep pulling engineers off the roadmap, evidence living in spreadsheets, a new EU customer asking for GDPR proof.

Return JSON: {"pain_points":[{"title":"max 10 words","why":"1-2 sentences: data they handle + their buyer + why it hurts this person","fact_ids":["E3"]}]} (exactly 2).`,
  });
  return (data.pain_points ?? []).slice(0, 2).map((p) => ({
    title: p.title,
    why: p.why,
    factIds: (p.fact_ids ?? []).filter((id) => facts.some((f) => f.id === id)),
  }));
}

const SPELLED = /\b(two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|thousand|million|billion)\b/i;
const HEDGES = /\b(might|maybe|perhaps|possibly|probably|likely|could be|i think|i guess|seems)\b/gi;
const FRAMEWORKS = /\b(soc\s?2|iso\s?27001|gdpr|hipaa|pci(\s|-)?dss|iso\s?42001|dora|nis2)\b/gi;
const SCRAPE_TELLS = ["your website", "your site", "endpoint", "404", "scrap", "crawl", "i noticed on", "according to your", "restructuring", "layoff"];
const STOP = new Set(["the", "and", "for", "with", "that", "your", "from", "this", "their", "into", "platform", "software", "teams", "company", "companies", "solution", "tool"]);

export function productTerms(state: CompanyState, facts: Fact[]): string[] {
  const src = [state.one_liner ?? "", ...facts.filter((f) => f.field === "product" && !f.value.startsWith("name:")).map((f) => f.value)].join(" ");
  return [...new Set(src.toLowerCase().replace(/^oneliner:/, "").match(/[a-z][a-z-]{3,}/g) ?? [])].filter((w) => !STOP.has(w));
}

export function validateDraft(
  d: { subject: string; body: string; hook_fact_id?: string | null },
  poc: Contact,
  state: CompanyState,
  facts: Fact[],
): Check[] {
  const body = (d.body ?? "").trim();
  const subject = (d.subject ?? "").trim();
  const lower = body.toLowerCase();
  const words = body.split(/\s+/).filter(Boolean).length;
  const hook = facts.find((f) => f.id === d.hook_fact_id);
  const company = (state.company_name ?? state.domain.split(".")[0]).toLowerCase();
  const terms = productTerms(state, facts);
  const firstSentence = body.split(/(?<=[.?])\s/)[0]?.toLowerCase() ?? "";
  const evidenceText = facts.filter((f) => f.verified).map((f) => `${f.value} ${f.quote}`).join(" ");
  // framework names (SOC 2, ISO 27001) and meeting lengths are not factual claims
  const claimText = body.replace(/soc\s?2|iso\s?\/?\s?(iec\s?)?27001(:20\d\d)?|pci[\s-]?dss|type\s?(ii|2|i|1)\b|\d+[- ]?(minute|min)s?\b/gi, "");
  const numbers = (claimText.match(/\d[\d,.%]*/g) ?? []).map((n) => n.replace(/[.,]$/, ""));
  const badNumbers = numbers.filter((n) => !evidenceText.includes(n));
  const hedges = body.match(HEDGES) ?? [];
  const frameworks = new Set((body.match(FRAMEWORKS) ?? []).map((x) => x.toLowerCase().replace(/\s/g, "")));
  const fundingFresh = (monthsAgo(state.funding_date) ?? 99) <= 6;
  const banned = [...BANNED_PHRASES, ...SCRAPE_TELLS].filter((p) => lower.includes(p));

  return [
    { name: "Addressed to the person by first name", pass: new RegExp(`\\b${poc.first_name}\\b`).test(body.slice(0, 40)), detail: poc.first_name },
    { name: "No greeting line (Hi / Hello / Dear)", pass: !/^(hi|hey|hello|dear|greetings)\b/i.test(body) },
    { name: "110 words or fewer", pass: words <= 110 && words >= 45, detail: `${words} words` },
    { name: "Exactly one question", pass: (body.match(/\?/g) ?? []).length === 1 },
    { name: "No exclamation marks", pass: !/!/.test(body + subject) },
    { name: "No markdown or placeholders", pass: !/[*_#`]|\[[^\]]*\]|\{[^}]*\}|<[^>]+>/.test(body + subject) },
    { name: "First sentence uses a term from their product", pass: terms.some((t) => firstSentence.includes(t)), detail: terms.slice(0, 5).join(", ") },
    { name: "Subject names the company plus a hook or product word", pass: subject.toLowerCase().includes(company) && subject.split(/\s+/).length >= 2 && subject.split(/\s+/).length <= 9 },
    { name: "Hook rests on a verified, quoted fact", pass: Boolean(hook?.verified && hook.quote), detail: hook ? `${hook.id}: ${hook.value}` : "none cited" },
    { name: "Every number appears in the evidence", pass: badNumbers.length === 0, detail: badNumbers.join(", ") || undefined },
    { name: "No spelled-out numbers", pass: !SPELLED.test(body) },
    { name: "At most one hedge word", pass: hedges.length <= 1, detail: hedges.join(", ") || undefined },
    { name: "No list of 3+ frameworks", pass: frameworks.size < 3 },
    { name: '"Recent" only with funding dated in the last 6 months', pass: !/\brecent(ly)?\b/i.test(body) || fundingFresh },
    { name: "Mentions Sprinto", pass: /sprinto/i.test(body) },
    { name: "No banned or scraping-revealing phrases", pass: banned.length === 0, detail: banned.join(", ") || undefined },
  ];
}

type Gen = { subject: string; body: string; hook: string; hook_fact_id: string; why_this_angle: string };
type Review = { specificity: number; relevance: number; reply_likelihood: number; critique: string };

async function review(d: Gen, poc: Contact, state: CompanyState, usage: Usage): Promise<DraftAttempt["review"]> {
  const { data } = await geminiJson<Review>({
    usage,
    system: "You are a demanding VP of Sales reviewing cold emails before they go out. You are hard to impress.",
    prompt: `Recipient: ${poc.name}, ${poc.title} at ${state.company_name ?? state.domain} (${state.one_liner ?? ""}).
Subject: ${d.subject}
Body:
${d.body}

Score 0-10 each:
- specificity: could this email only have been sent to this company? (generic = low)
- relevance: does the pain match what this role worries about now?
- reply_likelihood: would a busy ${poc.title} reply?
Then a critique: the single most important fix, in one or two sentences.
Return JSON: {"specificity":n,"relevance":n,"reply_likelihood":n,"critique":"..."}`,
  });
  const s = (n: unknown) => Math.max(0, Math.min(10, Number(n) || 0));
  const r = { specificity: s(data.specificity), relevance: s(data.relevance), reply_likelihood: s(data.reply_likelihood), critique: String(data.critique ?? "") };
  return { ...r, avg: Math.round(((r.specificity + r.relevance + r.reply_likelihood) / 3) * 10) / 10 };
}

// The angle follows from what they already have: get it, finish it, or keep it and add the next one.
export function angleFor(state: CompanyState): string {
  const c = state.certifications.join(" ").toLowerCase();
  if (c.includes("soc") && c.includes("27001"))
    return "They are certified. Sell staying continuously audit-ready and answering security questionnaires fast with a trust centre, without engineers collecting evidence.";
  if (c.includes("soc"))
    return "They already hold SOC 2. Sell keeping it continuous with less engineering time, and reusing the same evidence for the next framework their buyers ask for (ISO 27001 for EU/UK, HIPAA for health).";
  if (c.includes("27001")) return "They hold ISO 27001. Sell adding SOC 2 for US enterprise buyers by reusing the same controls and evidence.";
  if (state.certification_status === "in_progress") return "Their audit is in progress. Sell getting it done faster and with fewer engineering hours.";
  return "No certification is published. Sell getting SOC 2 before it blocks the next enterprise deal, without pulling engineers off the roadmap.";
}

export async function writeEmail(
  state: CompanyState,
  poc: Contact,
  pains: PainPoint[],
  facts: Fact[],
  usage: Usage,
  style: StyleExample[],
  senderName: string,
  emit: (m: string) => void = () => {},
): Promise<Draft> {
  const company = state.company_name ?? state.domain;
  const styleBlock = style.length
    ? `\nThe Growth Lead edited earlier drafts like this. Learn the preference (do not copy content):\n${style
        .slice(-3)
        .map((s, i) => `Edit ${i + 1}\nBEFORE: ${s.before.slice(0, 500)}\nAFTER: ${s.after.slice(0, 500)}`)
        .join("\n\n")}\n`
    : "";

  const angle = angleFor(state);
  const base = `Write a cold email from ${senderName} (Sprinto) to ${poc.name}, ${poc.title} at ${company}.
What they sell: ${state.one_liner ?? "see evidence"}
Their certification status: ${state.certifications.length ? `already hold ${state.certifications.join(", ")}` : state.certification_status === "in_progress" ? "a certification is in progress" : "no certification published"}.
THE ANGLE (decided from the evidence, follow it): ${angle}

Structure, 4 short sentences plus sign-off:
1. "${poc.first_name}," + what they sell in their own words + the hook (one specific fact from the evidence).
2. The INSIGHT: why THEIR business model makes compliance painful in a specific way (e.g. deploying into customers' cloud means every client runs its own security review; healthcare buyers mean HIPAA; EU customers mean ISO 27001 / GDPR). This sentence is what makes it not a template.
3. One Sprinto proof line that answers exactly that insight.
4. One specific question about THEIR situation that is easy to answer (e.g. "How are you handling security reviews for on-prem deployments today?"), not a generic meeting request.

Pain points:
${pains.map((p, i) => `${i + 1}. ${p.title}: ${p.why} (evidence ${p.factIds.join(", ")})`).join("\n")}

Evidence you may use about them (cite the hook by id). Use ONLY these facts:
${factSheet(facts)}

Proof line: use AT MOST ONE of these Sprinto facts, reworded plainly. No other claims about Sprinto:
${SPRINTO_FACTS.map((f) => `- ${f}`).join("\n")}
${styleBlock}
Rules (checked by code, the email is rejected if any fails):
- Start with "${poc.first_name}," then, in the same first sentence, join what they sell (use a word from their product) with the hook: one specific true fact from the evidence.
- No greeting word (no Hi / Hello / Dear). No exclamation marks. No markdown.
- Exactly ONE question in the whole email: the closing one.
- 60-100 words including the sign-off line "${senderName}".
- Numbers only if they appear in the evidence, written as digits. No spelled-out numbers.
- Never mention their website, pages, scraping, or "I noticed". Never say "recent" unless the funding fact is dated within 6 months.
- Name ONE framework their buyers are likely to ask for (usually SOC 2; ISO 27001 for EU/UK buyers). Never put evidence ids like [E3] in the email.
- Stay positive and factual: never mention layoffs, restructuring, incidents or anything that could read as a dig.
- Never claim they lack something the evidence says they have.
- At most one hedge word. Name at most two frameworks.
- Subject: 3-7 words, must contain "${company}" plus a hook or product word.

Return JSON: {"subject":"...","body":"...","hook":"the hook phrase","hook_fact_id":"E#","why_this_angle":"1-2 sentences: why this hook and pain for this person"}`;

  const attempts: DraftAttempt[] = [];
  let prompt = base;
  for (let n = 1; n <= MAX_DRAFTS; n++) {
    const { data } = await geminiJson<Gen>({
      usage,
      temperature: 0.5 + n * 0.1,
      system: "You are Sprinto's best SDR. You write short, specific, human cold emails that busy technical leaders answer. You never invent facts.",
      prompt,
    });
    // evidence ids belong in the dossier, never in the email: strip them deterministically
    const clean = (t: string) => t.replace(/\s*\[(E\d+(\s*,\s*E\d+)*)\]/g, "").replace(/\r/g, "").trim();
    const d: Gen = { ...data, subject: clean(data.subject ?? ""), body: clean(data.body ?? "") };
    const checks = validateDraft(d, poc, state, facts);
    const failed = checks.filter((c) => !c.pass);
    let rev: DraftAttempt["review"] = null;
    if (!failed.length) rev = await review(d, poc, state, usage);
    const passed = !failed.length && (rev?.avg ?? 0) >= REVIEW_PASS;
    attempts.push({ n, subject: d.subject, body: d.body, hookFactId: d.hook_fact_id ?? null, checks, review: rev, passed });
    emit(`Draft ${n}: ${failed.length ? `${failed.length} rule(s) failed: ${failed.map((c) => c.name).join("; ")}` : `rules pass · reviewer ${rev?.avg}/10`}${passed ? " ✓" : ""}`);
    if (passed) {
      return {
        subject: d.subject,
        body: d.body,
        hook: d.hook ?? "",
        hookFactId: d.hook_fact_id ?? null,
        why_this_angle: d.why_this_angle ?? "",
        checks,
        review: rev,
        attempts,
        passed: true,
      };
    }
    prompt = `${base}\n\nYour previous draft was rejected. Fix exactly this:\n${
      failed.length ? failed.map((c) => `- ${c.name}${c.detail ? ` (${c.detail})` : ""}`).join("\n") : `- Reviewer (${rev?.avg}/10): ${rev?.critique}`
    }\nPrevious draft:\nSubject: ${d.subject}\n${d.body}`;
  }
  // none passed: keep the best attempt for the human, but it is HELD
  const best = [...attempts].sort((a, b) => b.checks.filter((c) => c.pass).length - a.checks.filter((c) => c.pass).length || (b.review?.avg ?? 0) - (a.review?.avg ?? 0))[0];
  return {
    subject: best.subject,
    body: best.body,
    hook: "",
    hookFactId: best.hookFactId,
    why_this_angle: "",
    checks: best.checks,
    review: best.review,
    attempts,
    passed: false,
  };
}
