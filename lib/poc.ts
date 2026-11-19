// Step 4: find the right person. Option A = Hunter.io Domain Search (when a key is set).
// Fallback = Gemini + Google Search for a named leader, email from the company pattern.
// Option B (Apollo, manual) = a hard-coded PoC typed next to the domain.
// The choice of WHO is made in code from the role-priority table, by company size.

import { roleBand } from "./icp";
import { geminiJson, type Usage } from "./gemini";
import { rootOf } from "./scrape";
import { parseHeadcount } from "./qualify";
import type { CompanyState, Contact, ManualPoc } from "./types";

export function hunterConfigured() {
  return Boolean(process.env.HUNTER_API_KEY?.trim());
}

function scoreTitle(title: string, headcount: number | null): number {
  const band = roleBand(headcount);
  for (const [re, pts] of band.patterns) if (re.test(title)) return pts;
  if (/\b(engineer|developer|designer|marketing|sales|recruit|talent|intern|account|support|success)\b/i.test(title)) return 5;
  return 20;
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

type HunterEmail = {
  value: string;
  first_name: string | null;
  last_name: string | null;
  position: string | null;
  seniority: string | null;
  department: string | null;
  confidence: number;
  linkedin: string | null;
  verification?: { status: string | null };
  sources?: { uri: string }[];
};

type HunterOut = { contacts: Contact[]; pattern: string | null; headcount: string | null; error?: string };

async function hunter(domain: string): Promise<HunterOut> {
  const ck = `domain:${domain}`;
  if (hunterCache.has(ck)) return structuredClone(hunterCache.get(ck) as HunterOut);
  const out = await hunterLive(domain);
  if (!out.error) hunterCache.set(ck, structuredClone(out));
  return out;
}

async function hunterLive(domain: string): Promise<HunterOut> {
  const key = process.env.HUNTER_API_KEY!.trim();
  const url = `https://api.hunter.io/v2/domain-search?domain=${encodeURIComponent(domain)}&limit=10&type=personal&api_key=${key}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { contacts: [], pattern: null, headcount: null, error: data?.errors?.[0]?.details ?? `Hunter HTTP ${res.status}` };
  const emails: HunterEmail[] = data?.data?.emails ?? [];
  const contacts = emails
    .filter((e) => e.first_name && e.position)
    .map<Contact>((e) => ({
      name: `${e.first_name} ${e.last_name ?? ""}`.trim(),
      first_name: e.first_name!,
      title: e.position!,
      email: e.value,
      email_status: (e.verification?.status as Contact["email_status"]) || "unknown",
      confidence: e.confidence,
      source: "hunter",
      source_url: e.sources?.[0]?.uri,
      linkedin: e.linkedin,
      rank_reason: "",
      role_score: 0,
    }));
  return { contacts, pattern: data?.data?.pattern ?? null, headcount: data?.data?.headcount ?? null };
}

function applyPattern(pattern: string | null, name: string, domain: string): string {
  const parts = name.toLowerCase().replace(/[^a-z\s-]/g, "").split(/\s+/).filter(Boolean);
  const first = parts[0] ?? "hello";
  const last = parts[parts.length - 1] ?? "";
  const p = pattern ?? "{first}";
  return `${p.replace("{first}", first).replace("{last}", last).replace("{f}", first[0] ?? "").replace("{l}", last[0] ?? "")}@${domain}`;
}

const hunterCache = new Map<string, unknown>();

async function emailFinder(domain: string, name: string): Promise<{ email: string; score: number } | null> {
  const [first, ...rest] = name.split(/\s+/);
  const key = `finder:${domain}:${name.toLowerCase()}`;
  if (hunterCache.has(key)) return hunterCache.get(key) as { email: string; score: number } | null;
  try {
    const u = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(first)}&last_name=${encodeURIComponent(rest.join(" "))}&api_key=${process.env.HUNTER_API_KEY!.trim()}`;
    const res = await fetch(u);
    const data = await res.json().catch(() => ({}));
    const out = res.ok && data?.data?.email ? { email: data.data.email as string, score: Number(data.data.score ?? 0) } : null;
    hunterCache.set(key, out);
    return out;
  } catch {
    return null;
  }
}

async function searchLeaders(state: CompanyState, usage: Usage): Promise<Contact[]> {
  const band = roleBand(state.headcount);
  const name = state.company_name ?? state.domain;
  const { data, sources } = await geminiJson<{ people?: { name: string; title: string; source_title?: string }[] }>({
    search: true,
    usage,
    prompt: `Use Google Search to find the CURRENT leadership of ${name} (website ${state.domain}).
I need real, named people in these roles, most important first: ${band.roles.join(", ")}, plus CEO/founders and any security, compliance or engineering leader.
Use the company site, LinkedIn, Crunchbase, press releases or news. Only include people a source names as working at THIS company now.
Return ONLY JSON in a \`\`\`json block: {"people":[{"name":"Full Name","title":"Exact title","source_title":"where you saw it"}]} (max 6).`,
  });
  if (!sources.length) return []; // ungrounded answer: never invent a person
  return (data.people ?? [])
    .filter((p) => p.name && p.title && p.name.split(" ").length >= 2 && p.name.length < 60)
    .map((p) => {
      const src = sources.find((s) => p.source_title && s.title.toLowerCase().includes(p.source_title.toLowerCase().slice(0, 10))) ?? sources[0];
      return {
        name: p.name,
        first_name: firstName(p.name),
        title: p.title,
        email: "",
        email_status: "unknown" as const,
        confidence: null,
        source: "web_search" as const,
        source_url: src?.uri,
        linkedin: null,
        rank_reason: "",
        role_score: 0,
      };
    });
}

export async function findPoc(
  state: CompanyState,
  usage: Usage,
  manual: ManualPoc | null,
  emit: (m: string) => void,
): Promise<{ poc: Contact | null; contacts: Contact[]; method: string }> {
  const band = roleBand(state.headcount);
  emit(`Size band: ${band.band}${state.headcount == null ? " (headcount unknown, assumed small)" : ""} → priority ${band.roles.join(" > ")}`);

  if (manual) {
    const c: Contact = {
      name: manual.name,
      first_name: firstName(manual.name),
      title: manual.title,
      email: manual.email || applyPattern(null, manual.name, rootOf(state.domain)),
      email_status: "manual",
      confidence: null,
      source: "manual",
      linkedin: null,
      rank_reason: "Hard-coded PoC from manual Apollo lookup (Option B)",
      role_score: scoreTitle(manual.title, state.headcount),
    };
    return { poc: c, contacts: [c], method: "Manual (Option B: Apollo lookup)" };
  }

  let contacts: Contact[] = [];
  let method = "";
  let pattern: string | null = null;
  if (hunterConfigured()) {
    const h = await hunter(rootOf(state.domain));
    if (h.error) emit(`Hunter: ${h.error}`);
    if (h.headcount && state.headcount == null) {
      const n = parseHeadcount(String(h.headcount));
      if (n != null) {
        state.headcount = n;
        emit(`Hunter reports headcount band ${h.headcount}`);
      }
    }
    contacts = h.contacts;
    pattern = h.pattern;
    method = `Hunter.io Domain Search (${contacts.length} people)`;
    emit(method);
  }
  if (!contacts.length) {
    emit(hunterConfigured() ? "Hunter found nobody senior: falling back to web search" : "No Hunter key: finding leaders via Google Search (Gemini)");
    try {
      contacts = await searchLeaders(state, usage);
      if (hunterConfigured()) {
        for (const c of contacts.slice(0, 3)) {
          const f = await emailFinder(rootOf(state.domain), c.name);
          if (f) Object.assign(c, { email: f.email, email_status: "finder", confidence: f.score });
        }
      } else if (pattern) contacts = contacts.map((c) => ({ ...c, email: applyPattern(pattern, c.name, rootOf(state.domain)), email_status: "pattern_guess" as const }));
      method = `Web search (${contacts.length} named leaders)`;
    } catch (e) {
      emit(`Leader search failed: ${(e as Error).message}`);
    }
  }
  // Sales, marketing and HR do not own compliance: never the PoC
  contacts = contacts.filter((c) => !/\b(sales|marketing|growth|hr|human resources|people|talent|recruit|account exec|sdr|bdr|partnership)/i.test(c.title));
  if (!contacts.length) return { poc: null, contacts: [], method: method || "none" };

  for (const c of contacts) {
    c.role_score = scoreTitle(c.title, state.headcount);
    // small tie-breakers: verified email, Hunter confidence
    if (c.email_status === "valid" || c.email_status === "verified") c.role_score += 3;
    if ((c.confidence ?? 0) >= 90) c.role_score += 1;
  }
  contacts.sort((a, b) => b.role_score - a.role_score);
  const finalBand = roleBand(state.headcount);
  const top = contacts[0];
  const ideal = finalBand.roles[0];
  const bestScore = finalBand.patterns[0][1];
  top.rank_reason =
    top.role_score >= bestScore - 5
      ? `${top.title} is the first-choice role for a ${finalBand.band} company. ${finalBand.why}`
      : `For a ${finalBand.band} company the first choice is ${ideal}, but none was listed among the ${contacts.length} people found. ${top.title} is the most senior remaining owner of the decision. ${finalBand.why}`;
  for (const c of contacts.slice(1)) c.rank_reason = `Ranked below: ${c.title} (${c.role_score} vs ${top.role_score})`;
  if (top.role_score < 50) top.rank_reason += " Low title match: flagged for review.";
  return { poc: top, contacts: contacts.slice(0, 6), method };
}
