// Step 3: qualification. The model extracts facts; Python-style rules in CODE compute
// a 100-point rubric with low/high bounds (unknown signals widen the range).
// The agent loop runs while the 60-point Go line sits inside [low, high]: the model picks
// ONE tool per turn (fetch_page, web_research, job_postings), code runs it and re-scores.

import { CAPS, COMPETITOR_TOOLS, LOOP_LIMITS, SIGNALS, VERDICT_LINES } from "./icp";
import { extractFacts, nextFactId, regexFacts } from "./extract";
import { geminiJson, type Usage } from "./gemini";
import { fetchAtsJobs, fetchPage, rootOf, type FetchResult } from "./scrape";
import type { CompanyState, Fact, GateResult, LoopStep, PageDoc, SignalResult, Verdict } from "./types";

export function emptyState(domain: string): CompanyState {
  return {
    domain,
    company_name: null,
    one_liner: null,
    is_b2b_saas: "unknown",
    certification_status: "unknown",
    certifications: [],
    compliance_tool: null,
    funding_stage: null,
    funding_date: null,
    headcount: null,
    open_roles: null,
    enterprise_signals: [],
    compliance_triggers: [],
    regulated_data: false,
    pages_read: [],
    pages_tried: [],
    tool_calls: 0,
    searches: 0,
    search_ok: false,
    profile_read: false,
    loop_iterations: 0,
    verdict: null,
    fixed_verdict: null,
    score_low: null,
    score_high: null,
    fixed_low: null,
    fixed_high: null,
    status: "running",
  };
}

export function parseHeadcount(v: string): number | null {
  const s = v.replace(/,/g, "");
  const range = s.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
  if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
  const plus = s.match(/(\d+)\s*\+/);
  if (plus) return Number(plus[1]);
  const k = s.match(/(\d+(?:\.\d+)?)\s*k\b/i);
  if (k) return Math.round(Number(k[1]) * 1000);
  const n = s.match(/\d+/);
  return n ? Number(n[0]) : null;
}

const uniq = (a: string[]) => [...new Set(a.map((x) => x.trim()).filter(Boolean))];
const IN_PROGRESS = /progress|working toward|pursuing|underway|undergoing|preparing for/i;
const HIRING = /hiring|role|engineer|manager|analyst|lead\b|head of/i;

// Fold VERIFIED facts into the state object. Unverified facts are shown, never decide anything.
export function deriveState(state: CompanyState, facts: Fact[], securityRead: boolean) {
  const ok = facts.filter((f) => f.verified);
  const by = (field: Fact["field"]) => ok.filter((f) => f.field === field);

  const name = ok.find((f) => f.value.startsWith("name:"));
  const one = ok.find((f) => f.value.startsWith("oneliner:"));
  if (name) state.company_name = name.value.slice(5);
  if (one) state.one_liner = one.value.slice(9);

  const b2b = by("b2b_saas").map((f) => f.value.toLowerCase());
  if (b2b.some((v) => v.startsWith("yes"))) state.is_b2b_saas = "yes";
  else if (b2b.some((v) => v.startsWith("no"))) state.is_b2b_saas = "no";

  state.certifications = uniq(by("certification").map((f) => (/27001/.test(f.value) ? "ISO 27001" : /soc/i.test(f.value) ? "SOC 2" : f.value)));
  const tool = by("compliance_tool").find((f) => COMPETITOR_TOOLS.some((t) => f.value.toLowerCase().includes(t.toLowerCase())));
  state.compliance_tool = tool ? (COMPETITOR_TOOLS.find((t) => tool.value.toLowerCase().includes(t.toLowerCase())) ?? tool.value) : null;

  // a trigger is a reason to buy compliance; layoffs or restructuring never count
  state.compliance_triggers = uniq(by("compliance_trigger").map((f) => f.value)).filter((t) => !/layoff|restructur|lay off|job cuts|downsiz/i.test(t));
  const inProgress = state.compliance_triggers.some((t) => IN_PROGRESS.test(t));
  if (state.certifications.length) state.certification_status = "certified";
  else if (inProgress) state.certification_status = "in_progress";
  else if (securityRead || state.search_ok) state.certification_status = "none_found";
  else state.certification_status = "unknown";

  const stage = by("funding_stage")[0];
  if (stage) state.funding_stage = stage.value;
  const fdate = by("funding_date")[0];
  if (fdate) state.funding_date = fdate.value;
  const hc = by("headcount")[0];
  if (hc) state.headcount = parseHeadcount(hc.value);
  const roles = by("open_roles")[0];
  if (roles) state.open_roles = parseHeadcount(roles.value);
  state.enterprise_signals = uniq(by("enterprise_signal").map((f) => f.value)).slice(0, 6);
  state.regulated_data = by("regulated_data").length > 0;
}

// ---------------- Rubric (all in code) ----------------

export type ScoreCtx = {
  state: CompanyState;
  facts: Fact[];
  pages: PageDoc[];
  atsRead: boolean;
  securityTried: boolean; // a security/trust page was attempted (OK or NOT_FOUND, not blocked)
};

function monthsAgo(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (!Number.isNaN(d.getTime())) return (Date.now() - d.getTime()) / (30.4 * 864e5);
  const y = Number(dateStr.match(/20\d\d/)?.[0] ?? NaN);
  if (Number.isNaN(y)) return null;
  const m = dateStr.match(/jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec/i);
  const month = m ? "janfebmaraprmayjunjulaugsepoctnovdec".indexOf(m[0].toLowerCase()) / 3 : 6;
  return (Date.now() - new Date(y, month, 15).getTime()) / (30.4 * 864e5);
}
export { monthsAgo };

export function scoreSignals(c: ScoreCtx): { signals: SignalResult[]; low: number; high: number; caps: string[] } {
  const { state, facts } = c;
  const ok = facts.filter((f) => f.verified);
  const idsOf = (pred: (f: Fact) => boolean) => ok.filter(pred).map((f) => f.id).slice(0, 4);
  const read = (kind: string) => c.pages.some((p) => p.kind === kind && p.ok);
  const searched = state.search_ok;
  const profiled = state.profile_read;
  const allText = ok.map((f) => `${f.value} ${f.quote}`).join(" ") + " " + c.pages.map((p) => p.raw ?? p.text).join(" ");

  const out: SignalResult[] = [];
  const put = (key: string, status: SignalResult["status"], why: string, factIds: string[] = []) => {
    const def = SIGNALS.find((s) => s.key === key)!;
    out.push({ key, block: def.block, name: def.name, max: def.max, points: status === "yes" ? def.max : 0, status, external: def.external, why, factIds });
  };
  const ext = (found: boolean) => (found ? "yes" : searched ? "no" : "unknown");

  // Firmographic (external)
  const st = (state.funding_stage ?? "").toLowerCase();
  if (st) put("stage_ac", /series\s?[abc]\b/.test(st) ? "yes" : "no", state.funding_stage!, idsOf((f) => f.field === "funding_stage"));
  else put("stage_ac", ext(false), searched ? "No funding round found in search" : "Funding is rarely on the website: unknown", []);

  const hc = state.headcount;
  if (hc != null) put("headcount_band", hc >= 20 && hc <= 500 ? "yes" : "no", `~${hc} people`, idsOf((f) => f.field === "headcount"));
  else put("headcount_band", searched || profiled ? "no" : "unknown", searched || profiled ? "Headcount not found" : "Headcount not on the website: unknown");

  const mo = monthsAgo(state.funding_date);
  if (mo != null) put("recent_funding", mo <= 18 ? "yes" : "no", `Last round ${state.funding_date}`, idsOf((f) => f.field === "funding_date"));
  else put("recent_funding", ext(false), searched ? "No dated round found" : "Unknown until searched");

  if (state.open_roles != null) put("growing_team", state.open_roles >= 5 ? "yes" : "no", `${state.open_roles} open roles`, idsOf((f) => f.field === "open_roles"));
  else put("growing_team", c.atsRead || read("careers") ? "no" : "unknown", c.atsRead || read("careers") ? "Careers read, no count of 5+" : "Careers not read yet");

  // Upmarket pull (website)
  if (state.enterprise_signals.length) put("enterprise_tier", "yes", state.enterprise_signals.slice(0, 2).join(" · "), idsOf((f) => f.field === "enterprise_signal"));
  else put("enterprise_tier", read("pricing") ? "no" : "unknown", read("pricing") ? "Pricing page read: no enterprise tier or SSO" : "Pricing page not read yet");

  const logos = ok.filter((f) => f.field === "customer_logo");
  if (logos.length) put("enterprise_logos", "yes", logos.slice(0, 3).map((f) => f.value).join(", "), logos.map((f) => f.id).slice(0, 4));
  else put("enterprise_logos", read("customers") || read("home") ? "no" : "unknown", "No named enterprise customers found");

  if (read("security")) put("security_page", "yes", "Security / trust page exists", []);
  else put("security_page", c.securityTried ? "no" : "unknown", c.securityTried ? "No security or trust page" : "Not checked yet");

  // Compliance trigger
  const prog = state.compliance_triggers.find((t) => IN_PROGRESS.test(t));
  put(
    "cert_in_progress",
    prog ? "yes" : read("security") || c.securityTried || searched ? "no" : "unknown",
    prog ?? "No in-progress audit stated",
    prog ? idsOf((f) => f.field === "compliance_trigger" && IN_PROGRESS.test(f.value)) : [],
  );
  const hire = state.compliance_triggers.find((t) => !IN_PROGRESS.test(t) && HIRING.test(t) && /secur|complian|grc|risk|privacy|trust/i.test(t));
  put(
    "security_hiring",
    hire ? "yes" : c.atsRead || read("careers") || searched ? "no" : "unknown",
    hire ?? (c.atsRead || read("careers") ? "No security/compliance roles open" : "Job postings not read yet"),
    hire ? idsOf((f) => f.field === "compliance_trigger" && f.value === hire) : [],
  );
  put("regulated_data", state.regulated_data ? "yes" : "no", state.regulated_data ? "Handles regulated data" : "No regulated data stated", idsOf((f) => f.field === "regulated_data"));
  const eu = ok.find((f) => /\b(gdpr|eu|europe|european|germany|france|netherlands|spain|ireland|united kingdom|uk|london|berlin|paris|amsterdam)\b/i.test(`${f.value} ${f.quote}`) && f.field !== "certification");
  put("eu_exposure", eu ? "yes" : "no", eu ? eu.value : "No EU / GDPR exposure stated", eu ? [eu.id] : []);
  const q = /security (review|questionnaire|assessment)s?|vendor (risk|assessment|questionnaire)|data processing (agreement|addendum)|\bDPA\b/i.exec(allText);
  put("questionnaire", q ? "yes" : "no", q ? `Mentions "${q[0]}"` : "No security-review language");
  const other = state.compliance_triggers.find((t) => !IN_PROGRESS.test(t) && t !== hire);
  put("other_trigger", other ? "yes" : "no", other ?? "None", other ? idsOf((f) => f.field === "compliance_trigger" && f.value === other) : []);

  // Fit: the certification gap
  const certs = state.certifications.join(" ").toLowerCase();
  const certKnown = state.certification_status !== "unknown";
  put("no_cert", certs.includes("soc") ? "no" : certKnown ? "yes" : "unknown", certs.includes("soc") ? "Already holds SOC 2" : certKnown ? "No SOC 2 published" : "Certification status unknown", idsOf((f) => f.field === "certification"));
  put("no_iso", certs.includes("27001") ? "no" : certKnown ? "yes" : "unknown", certs.includes("27001") ? "Already holds ISO 27001" : certKnown ? "No ISO 27001 published" : "Unknown", idsOf((f) => f.field === "certification" && /27001/.test(f.value)));

  let low = out.reduce((s, x) => s + x.points, 0);
  let high = low + out.filter((x) => x.status === "unknown").reduce((s, x) => s + x.max, 0);
  const caps: string[] = [];
  const upmarket = out.filter((x) => x.block === "upmarket");
  if (upmarket.every((x) => x.status === "no")) {
    caps.push(`No upmarket pull: capped at ${CAPS.noUpmarket}`);
    low = Math.min(low, CAPS.noUpmarket);
    high = Math.min(high, CAPS.noUpmarket);
  }
  if (certs.includes("soc") && certs.includes("27001")) {
    caps.push(`Already holds SOC 2 and ISO 27001: capped at ${CAPS.fullyCertified}`);
    low = Math.min(low, CAPS.fullyCertified);
    high = Math.min(high, CAPS.fullyCertified);
  }
  return { signals: out, low, high, caps };
}

export function gatesFor(state: CompanyState, facts: Fact[]): GateResult[] {
  const ids = (field: Fact["field"]) => facts.filter((f) => f.verified && f.field === field).map((f) => f.id).slice(0, 3);
  const isVendor = COMPETITOR_TOOLS.some((t) => rootOf(state.domain).split(".")[0] === t.toLowerCase().replace(/\s/g, ""));
  const tooBig = /public|ipo|listed/i.test(state.funding_stage ?? "") || (state.headcount ?? 0) > 2000;
  const tooSmall = state.headcount != null && state.headcount < 5;
  return [
    {
      name: "Sells software to businesses",
      status: state.is_b2b_saas === "yes" ? "pass" : state.is_b2b_saas === "no" ? "fail" : "unknown",
      detail: state.is_b2b_saas === "yes" ? "The product names a business buyer" : state.is_b2b_saas === "no" ? "Not B2B software: nothing for Sprinto to certify" : "Who buys it is not established",
      factIds: [...ids("b2b_saas"), ...ids("buyer")].slice(0, 3),
    },
    {
      name: "Not already on Sprinto or a rival tool",
      status: isVendor || state.compliance_tool ? "fail" : "pass",
      detail: isVendor
        ? "This company is itself a compliance-automation vendor"
        : state.compliance_tool === "Sprinto"
          ? "Existing Sprinto customer (trust centre hosted on Sprinto)"
          : state.compliance_tool
            ? `Uses ${state.compliance_tool}: a renewal target, not cold outreach`
            : "No Sprinto / Vanta / Drata / Secureframe trust centre found",
      factIds: ids("compliance_tool"),
    },
    {
      name: "Inside the size band",
      status: tooBig || tooSmall ? "fail" : state.headcount == null && !state.funding_stage ? "unknown" : "pass",
      detail: tooBig ? "Public or 2,000+ people: has an in-house GRC team" : tooSmall ? "Fewer than 5 people: no enterprise buyers yet" : state.headcount == null && !state.funding_stage ? "Size not published" : `${state.funding_stage ?? ""}${state.headcount ? ` ~${state.headcount} people` : ""}`.trim(),
      factIds: [...ids("headcount"), ...ids("funding_stage")].slice(0, 3),
    },
  ];
}

export function verdictFor(gates: GateResult[], low: number, high: number): Verdict {
  if (gates.some((g) => g.status === "fail")) return "DISQUALIFIED";
  if (gates[0].status === "unknown") return "INSUFFICIENT_DATA";
  if (low >= VERDICT_LINES.priority) return "PRIORITY";
  if (low >= VERDICT_LINES.qualify) return "QUALIFY";
  if (high < VERDICT_LINES.qualify) return high >= VERDICT_LINES.nurture ? "NURTURE" : "REJECT";
  return "INSUFFICIENT_DATA"; // the Go line sits inside [low, high]: not enough to decide
}

// ---------------- Agent loop ----------------

export type Emit = (msg: string) => void;

export type LoopCtx = {
  domain: string;
  state: CompanyState;
  pages: PageDoc[];
  facts: Fact[];
  loop: LoopStep[];
  usage: Usage;
  links: Record<string, string[]>;
  homeHash: string;
  atsRead: boolean;
  securityTried: boolean;
  emit: Emit;
};

const ALLOWED_PATHS = ["/pricing", "/security", "/trust", "/customers", "/about", "/careers", "/company", "/enterprise", "/plans", "/jobs"];

// Tool descriptions follow the four golden rules (what / when / when not / returns).
const TOOLS = `TOOLS (pick exactly ONE):
1. fetch_page(path)
   What: reads one page of the company's own website and extracts facts from it.
   When: the unknown signal is normally stated on the company site: /pricing (enterprise plan, SSO/SAML, SLA), /security or /trust (certifications, audits in progress), /customers (named enterprise customers), /about or /company (what they sell, size, location), /careers (open roles).
   When NOT: for funding stage, funding date or headcount (rarely on the site), or a path already tried. Only these paths: ${ALLOWED_PATHS.join(", ")}.
   Returns: the page outcome (OK / NOT_FOUND / BLOCKED / TIMEOUT / EMPTY_SHELL) and the facts found.
2. web_research(query)
   What: a Google Search (Gemini grounding) about this company, answered with cited sources.
   When: signals the website cannot settle: funding stage and date, headcount, security/compliance hiring, certification news.
   When NOT: for anything the website states (pricing tiers, product); never more than 2 per company.
   Returns: facts with source links, or nothing if sources are silent.
3. job_postings()
   What: reads the company's public job board through the Greenhouse / Lever / Ashby APIs.
   When: open-role count or security/compliance hiring is unknown AND a careers link exists.
   When NOT: when no careers page or job board is linked, or it was already read.
   Returns: number of open roles and their titles, or "no board found".
4. company_profile()
   What: a structured company record from Hunter.io (data provider): employee count, total money raised, HQ location, private or public.
   When: headcount, stage or EU exposure is unknown. Cheapest and most reliable source for size: prefer it before web_research.
   When NOT: if already read, or for product, pricing, certifications or hiring.
   Returns: employees, total raised (a stage ESTIMATE, labelled as such), location, company type.`;

async function toolFetch(ctx: LoopCtx, path: string): Promise<string> {
  const p = ALLOWED_PATHS.includes(path) ? path : null;
  if (!p) return `refused: ${path} is not an allowed path`;
  const kind = /security|trust/.test(p) ? "security" : /careers|jobs/.test(p) ? "careers" : /pricing|plans|enterprise/.test(p) ? "pricing" : /customers/.test(p) ? "customers" : "about";
  // prefer the link the site itself uses for this kind
  const linked = (ctx.links[kind] ?? []).filter((u) => !ctx.state.pages_tried.includes(u));
  const candidates = [...linked.slice(0, 1), `https://${ctx.domain}${p}`];
  if (kind === "security") candidates.push(`https://trust.${rootOf(ctx.domain)}`);
  let last: FetchResult | null = null;
  for (const url of [...new Set(candidates)].slice(0, 3)) {
    if (ctx.state.pages_tried.includes(url)) continue;
    ctx.state.pages_tried.push(url);
    const page = await fetchPage(url, kind, ctx.homeHash);
    last = page;
    if (page.ok) {
      if (kind === "security") ctx.securityTried = true;
      await absorb(ctx, page);
      ctx.state.pages_read.push(kind);
      const nf = ctx.facts.filter((f) => f.url === page.url && f.verified).length;
      return `${page.outcome} ${page.finalUrl} (${page.words} words via ${page.via}): ${nf} verified facts`;
    }
    ctx.pages.push(page);
    if (page.outcome === "BLOCKED" || page.outcome === "TIMEOUT") break; // unknown, never "absent"
  }
  if (kind === "security" && last?.outcome === "NOT_FOUND") ctx.securityTried = true; // a missing page is real absence
  return `${last?.outcome ?? "ERROR"} ${last?.url ?? path}${last?.outcome === "BLOCKED" || last?.outcome === "TIMEOUT" ? " (unreadable: treated as unknown, not as absent)" : ""}`;
}

async function toolJobs(ctx: LoopCtx): Promise<string> {
  const careerLinks = ctx.links.careers ?? [];
  let links = careerLinks;
  if (!links.some((u) => /greenhouse|lever\.co|ashbyhq/i.test(u))) {
    // read the careers page to find the board it links to
    const url = careerLinks[0] ?? `https://${ctx.domain}/careers`;
    if (!ctx.state.pages_tried.includes(url)) {
      ctx.state.pages_tried.push(url);
      const page = await fetchPage(url, "careers", ctx.homeHash);
      if (page.ok) {
        await absorb(ctx, page);
        ctx.state.pages_read.push("careers");
      } else ctx.pages.push(page);
      links = [url, ...page.links.map((l) => l.url)];
    }
  }
  const ats = await fetchAtsJobs(links, ctx.domain);
  ctx.atsRead = true;
  if (!ats) return "no public Greenhouse / Lever / Ashby board linked";
  ctx.facts.push({ id: nextFactId(), field: "open_roles", value: String(ats.titles.length), quote: ats.titles.slice(0, 6).join(" · "), url: ats.url, verified: true, via: "ats_api" });
  const sec = ats.titles.filter((t) => /security|compliance|grc|devsecops|infosec|risk|privacy|trust/i.test(t));
  if (sec.length)
    ctx.facts.push({ id: nextFactId(), field: "compliance_trigger", value: `Hiring for security/compliance: ${sec.slice(0, 2).join(", ")}`, quote: sec.slice(0, 3).join(" · "), url: ats.url, verified: true, via: "ats_api" });
  ctx.pages.push({ url: ats.url, kind: "ats", ok: true, outcome: "OK", via: "api", words: ats.titles.length, text: "" });
  return `${ats.provider} board: ${ats.titles.length} open roles${sec.length ? `, incl. ${sec.slice(0, 2).join(", ")}` : ""}`;
}

// Google Search grounding may be unavailable on free keys: remember that across companies.
let groundingBlocked = false;

async function toolSearch(ctx: LoopCtx, query: string): Promise<string> {
  ctx.state.searches += 1;
  if (!groundingBlocked) {
    try {
      return await groundedSearch(ctx, query);
    } catch (e) {
      const msg = (e as Error).message;
      if (/quota|too_many|exceeded|not supported|google_search/i.test(msg)) groundingBlocked = true;
      ctx.emit(`  Google Search unavailable (${/quota/i.test(msg) ? "quota" : "error"}): falling back to Google News headlines`);
    }
  }
  return newsSearch(ctx);
}

const decodeXml = (x: string) =>
  x
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .trim();

// Fallback: Google News RSS (free, no key). The model may only point at a headline we fetched.
async function newsSearch(ctx: LoopCtx): Promise<string> {
  const name = ctx.state.company_name ?? rootOf(ctx.domain).split(".")[0];
  const q = encodeURIComponent(`"${name}" (raises OR funding OR "Series A" OR "Series B" OR "Series C" OR seed OR employees OR "SOC 2")`);
  let items: { title: string; date: string; link: string }[] = [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 12_000);
    const res = await fetch(`https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`, { signal: ctrl.signal });
    clearTimeout(t);
    const xml = res.ok ? await res.text() : "";
    items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 15).map((m) => ({
      title: decodeXml(m[1].match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? ""),
      date: (m[1].match(/<pubDate>(.*?)<\/pubDate>/)?.[1] ?? "").slice(5, 16),
      link: decodeXml(m[1].match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? ""),
    }));
  } catch {
    /* network failure: nothing learned */
  }
  ctx.pages.push({ url: `news: ${name}`, kind: "search", ok: items.length > 0, outcome: items.length ? "OK" : "EMPTY_SHELL", via: "search", words: items.length, text: "" });
  if (!items.length) return "no news headlines found (stays unknown)";

  // Deterministic first: a funding headline that names the company gives the stage and date in code.
  const nameKey = name.toLowerCase().replace(/\b(inc|corp|ltd|labs?|ai|hq)\b\.?/g, "").trim().slice(0, 12);
  const funding = items
    .filter((it) => it.title.toLowerCase().includes(nameKey) && /\b(raises?|raised|secures?|closes?|funding|series [a-e]|seed round|pre-seed)\b/i.test(it.title))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let n = 0;
  if (funding.length) {
    const it = funding[0];
    const stage = it.title.match(/series\s+([a-e])\b/i)?.[1] ? `Series ${it.title.match(/series\s+([a-e])\b/i)![1].toUpperCase()}` : /pre-seed/i.test(it.title) ? "Pre-seed" : /seed/i.test(it.title) ? "Seed" : null;
    const quote = `${it.title} (${it.date})`;
    ctx.facts.push({ id: nextFactId(), field: "funding_date", value: it.date, quote, url: it.link, verified: true, via: "news" });
    n++;
    // no stage word: estimate from the amount in the headline, labelled as an estimate
    const amt = it.title.match(/\$\s?(\d+(?:\.\d+)?)\s?(m|mn|million|b|bn|billion)\b/i);
    const usdM = amt ? Number(amt[1]) * (/^b/i.test(amt[2]) ? 1000 : 1) : null;
    const est = !stage && usdM ? `${usdM < 5 ? "Seed" : usdM < 30 ? "Series A" : usdM < 100 ? "Series B" : usdM < 300 ? "Series C" : "Series D+"} (estimate from $${usdM}M round)` : null;
    if (stage || est) {
      ctx.facts.push({ id: nextFactId(), field: "funding_stage", value: (stage ?? est)!, quote, url: it.link, verified: true, via: "news" });
      n++;
      ctx.state.search_ok = true;
      return `${n} facts from the latest funding headline (read in code) of ${items.length}`;
    }
  }

  const list = items.map((it, i) => `H${i + 1} [${it.date}] ${it.title}`).join("\n");
  const { data } = await geminiJson<{ facts?: { field: string; value: string; headline: string }[] }>({
    usage: ctx.usage,
    prompt: `Company: ${name} (website ${ctx.domain}). Below are news headlines. Extract ONLY facts about THIS company (not a namesake): funding_stage (e.g. Series A), funding_date (the headline date, e.g. "12 Mar 2025"), headcount, customer_logo. Nothing else.
Give the headline id for each fact. If no headline is clearly about this company, return {"facts":[]}.
${list}
Return JSON: {"facts":[{"field":"...","value":"...","headline":"H3"}]}`,
  });
  for (const f of data.facts ?? []) {
    const idx = Number(String(f.headline ?? "").replace(/\D/g, "")) - 1;
    const it = items[idx];
    if (!it || !["funding_stage", "funding_date", "headcount", "customer_logo"].includes(f.field) || !f.value) continue;
    const mentions = it.title.toLowerCase().includes(name.toLowerCase().slice(0, 6));
    ctx.facts.push({ id: nextFactId(), field: f.field as Fact["field"], value: String(f.value).slice(0, 120), quote: `${it.title} (${it.date})`, url: it.link, verified: mentions, via: "news" });
    if (mentions) n++;
  }
  ctx.state.search_ok = true; // headlines were read: silence there now means "no", not "unknown"
  return `${n} facts from ${items.length} news headlines`;
}

const profileCache = new Map<string, Record<string, unknown> | null>();

async function toolProfile(ctx: LoopCtx): Promise<string> {
  const key = process.env.HUNTER_API_KEY?.trim();
  if (!key) return "no Hunter key on this server: skipped";
  const d = rootOf(ctx.domain);
  let c = profileCache.get(d);
  if (c === undefined) {
    try {
      const res = await fetch(`https://api.hunter.io/v2/companies/find?domain=${encodeURIComponent(d)}&api_key=${key}`);
      const data = await res.json().catch(() => ({}));
      c = res.ok ? (data?.data ?? null) : null;
    } catch {
      c = null;
    }
    profileCache.set(d, c ?? null);
  }
  ctx.pages.push({ url: `hunter company profile: ${d}`, kind: "profile", ok: Boolean(c), outcome: c ? "OK" : "NOT_FOUND", via: "api", words: 0, text: "" });
  if (!c) return "no company record at Hunter (stays unknown)";
  ctx.state.profile_read = true;
  const m = (c.metrics ?? {}) as Record<string, unknown>;
  const src = `https://hunter.io/companies/${d}`;
  const add = (field: Fact["field"], value: string, quote: string) => ctx.facts.push({ id: nextFactId(), field, value, quote, url: src, verified: true, via: "hunter" });
  const out: string[] = [];
  const emp = (m.employeesCount as number | null) ?? null;
  if (emp || m.employees) {
    add("headcount", String(emp ?? m.employees), `employees: ${m.employees ?? emp}`);
    out.push(`${emp ?? m.employees} employees`);
  }
  const raised = m.raised as number | null;
  if (raised) {
    const mUsd = raised / 1e6;
    const est = mUsd < 5 ? "Seed" : mUsd < 30 ? "Series A" : mUsd < 100 ? "Series B" : mUsd < 300 ? "Series C" : "Series D+";
    add("funding_stage", `${est} (estimate from $${mUsd.toFixed(1)}M raised)`, `raised: ${raised}`);
    out.push(`$${mUsd.toFixed(1)}M raised`);
  }
  if (c.type === "public") {
    add("funding_stage", "Public company", "type: public");
    out.push("public");
  }
  const loc = typeof c.location === "string" ? c.location : "";
  if (loc) {
    add("hq_location", loc, `location: ${loc}`);
    out.push(loc.split(",").slice(-1)[0].trim());
  }
  return out.length ? `Hunter profile: ${out.join(" · ")}` : "Hunter profile had no size or funding data";
}

async function groundedSearch(ctx: LoopCtx, query: string): Promise<string> {
  const name = ctx.state.company_name ?? ctx.domain;
  const { data, sources } = await geminiJson<{ facts?: { field: string; value: string; quote?: string; source_title?: string }[] }>({
    search: true,
    usage: ctx.usage,
    prompt: `Use Google Search to research the company ${name} (website ${ctx.domain}). Focus: ${query || "funding stage and date, headcount, SOC 2 / ISO 27001 status, security hiring"}.
Only report what a source says about THIS company (same domain). If a source is unclear, leave it out. Never estimate.
Return ONLY JSON in a \`\`\`json block:
{"facts":[{"field":"funding_stage|funding_date|headcount|certification|compliance_trigger|compliance_tool|enterprise_signal|customer_logo|regulated_data|b2b_saas","value":"...","quote":"the sentence from the source","source_title":"..."}]}`,
  });
  const allowed = new Set(["funding_stage", "funding_date", "headcount", "certification", "compliance_trigger", "compliance_tool", "enterprise_signal", "customer_logo", "regulated_data", "b2b_saas"]);
  let n = 0;
  for (const f of data.facts ?? []) {
    if (!allowed.has(f.field) || !f.value) continue;
    const src = sources.find((s) => f.source_title && s.title && s.title.toLowerCase().includes(f.source_title.toLowerCase().slice(0, 12))) ?? sources[0];
    ctx.facts.push({
      id: nextFactId(),
      field: f.field as Fact["field"],
      value: String(f.value).slice(0, 160),
      quote: String(f.quote ?? f.value).slice(0, 240),
      url: src?.uri ?? "",
      verified: sources.length > 0, // grounded: Google returned citations
      via: "web_search",
    });
    n++;
  }
  if (sources.length) ctx.state.search_ok = true;
  ctx.pages.push({ url: `search: ${query}`.slice(0, 120), kind: "search", ok: sources.length > 0, outcome: sources.length ? "OK" : "EMPTY_SHELL", via: "search", words: 0, text: "" });
  return `${n} facts from ${sources.length} cited sources`;
}

async function absorb(ctx: LoopCtx, page: FetchResult) {
  ctx.pages.push(page);
  ctx.facts.push(...regexFacts(page));
  ctx.facts.push(...(await extractFacts([page], ctx.domain, ctx.usage)));
}

function rescore(ctx: LoopCtx) {
  deriveState(ctx.state, ctx.facts, ctx.securityTried);
  return scoreSignals({ state: ctx.state, facts: ctx.facts, pages: ctx.pages, atsRead: ctx.atsRead, securityTried: ctx.securityTried });
}

type Choice = { tool: "fetch_page" | "web_research" | "job_postings" | "company_profile"; path?: string; query?: string; reason: string };
const TOOL_NAMES = ["fetch_page", "web_research", "job_postings", "company_profile"];

function fallbackChoice(ctx: LoopCtx, unknown: SignalResult[], tried: Set<string>): Choice | null {
  const options: Choice[] = [];
  for (const s of unknown) {
    if (["enterprise_tier"].includes(s.key)) options.push({ tool: "fetch_page", path: "/pricing", reason: `${s.name} is usually on the pricing page` });
    if (["security_page", "cert_in_progress", "no_cert", "no_iso"].includes(s.key)) options.push({ tool: "fetch_page", path: "/security", reason: `${s.name} lives on the security page` });
    if (["growing_team", "security_hiring"].includes(s.key)) options.push({ tool: "job_postings", reason: `${s.name} comes from the job board` });
    if (["headcount_band", "stage_ac"].includes(s.key) && process.env.HUNTER_API_KEY) options.push({ tool: "company_profile", reason: `${s.name}: a data provider has it` });
    if (s.external) options.push({ tool: "web_research", query: "funding stage, date and headcount", reason: `${s.name} is not on the website` });
  }
  return options.find((o) => !tried.has(keyOf(o)) && (o.tool !== "web_research" || ctx.state.searches < LOOP_LIMITS.maxSearches)) ?? null;
}
const keyOf = (c: Choice) => `${c.tool}:${c.path ?? c.query ?? ""}`.toLowerCase();

export async function runAgentLoop(ctx: LoopCtx) {
  const t0 = Date.now();
  const tried = new Set<string>();
  let sc = rescore(ctx);
  for (let i = 1; ; i++) {
    const gates = gatesFor(ctx.state, ctx.facts);
    if (gates.some((g) => g.status === "fail")) {
      ctx.emit(`Short-circuit: ${gates.find((g) => g.status === "fail")!.detail}. Stop researching.`);
      break;
    }
    const straddles = sc.low < VERDICT_LINES.qualify && sc.high >= VERDICT_LINES.qualify;
    const b2bUnknown = ctx.state.is_b2b_saas === "unknown";
    if (!straddles && !b2bUnknown) {
      ctx.emit(`Score range ${sc.low}–${sc.high} no longer straddles the ${VERDICT_LINES.qualify} line. Enough to decide.`);
      break;
    }
    if (ctx.state.tool_calls >= LOOP_LIMITS.maxToolCalls) {
      ctx.emit(`Budget spent (${LOOP_LIMITS.maxToolCalls} tool calls). Decide with what we have.`);
      break;
    }
    if (Date.now() - t0 > LOOP_LIMITS.maxMs) {
      ctx.emit("Time budget (120 s) spent. Decide with what we have.");
      break;
    }
    const unknown = sc.signals.filter((s) => s.status === "unknown").sort((a, b) => b.max - a.max);
    let choice: Choice | null = null;
    // after 60 s of research the code ladder picks the next tool (saves an AI call per turn)
    if (Date.now() - t0 < 60_000) try {
      const { data } = await geminiJson<Choice>({
        usage: ctx.usage,
        system: "You are the research planner in a lead-qualification agent. You choose the single most informative next tool call. Answer with JSON only.",
        prompt: `Company: ${ctx.state.company_name ?? ctx.domain} (${ctx.domain}). ${ctx.state.one_liner ?? ""}
Current score range: ${sc.low} to ${sc.high} out of 100. The decision line is ${VERDICT_LINES.qualify}. Goal: settle which side of the line it falls on with the fewest calls.
${b2bUnknown ? "It is NOT yet clear whether they sell software to businesses: settle that first.\n" : ""}Unknown signals (points at stake):
${unknown.map((s) => `- ${s.name} (${s.max} pts${s.external ? ", not usually on the website" : ""})`).join("\n")}
Already tried: ${[...tried].join(", ") || "nothing"}. Web searches used: ${ctx.state.searches}/${LOOP_LIMITS.maxSearches}.
Links the site exposes: ${Object.entries(ctx.links).map(([k, v]) => `${k}: ${v.length}`).join(", ") || "none"}

${TOOLS}

Return JSON: {"tool":"fetch_page|web_research|job_postings|company_profile","path":"/pricing (fetch_page only)","query":"(web_research only)","reason":"one sentence: which unknown signal this settles and why this source"}`,
      });
      if (data?.tool && TOOL_NAMES.includes(data.tool)) choice = data;
    } catch {
      /* fall back to the code ladder */
    }
    if (
      !choice ||
      tried.has(keyOf(choice)) ||
      (choice.tool === "web_research" && ctx.state.searches >= LOOP_LIMITS.maxSearches) ||
      (choice.tool === "company_profile" && !process.env.HUNTER_API_KEY) ||
      (choice.tool === "fetch_page" && !ALLOWED_PATHS.includes(choice.path ?? ""))
    ) {
      choice = fallbackChoice(ctx, unknown, tried);
    }
    if (!choice) {
      ctx.emit("No useful tool left that has not been tried. Decide with what we have.");
      break;
    }
    tried.add(keyOf(choice));
    ctx.state.tool_calls += 1;
    ctx.state.loop_iterations = i;
    const before = { low: sc.low, high: sc.high };
    const args = choice.tool === "fetch_page" ? choice.path! : choice.tool === "web_research" ? choice.query ?? "" : "";
    ctx.emit(`Turn ${i}: range ${sc.low}–${sc.high} straddles ${VERDICT_LINES.qualify} → ${choice.tool}(${args}) · ${choice.reason}`);
    let result = "";
    let ok = true;
    try {
      if (choice.tool === "fetch_page") result = await toolFetch(ctx, choice.path!);
      else if (choice.tool === "job_postings") result = await toolJobs(ctx);
      else if (choice.tool === "company_profile") result = await toolProfile(ctx);
      else result = await toolSearch(ctx, choice.query ?? "");
    } catch (e) {
      ok = false;
      result = `failed: ${(e as Error).message}`;
    }
    sc = rescore(ctx);
    ctx.emit(`  → ${result} · new range ${sc.low}–${sc.high}`);
    ctx.loop.push({ iteration: i, low: before.low, high: before.high, tool: choice.tool, args, reason: choice.reason, result, ok, lowAfter: sc.low, highAfter: sc.high });
  }
  return rescore(ctx);
}
