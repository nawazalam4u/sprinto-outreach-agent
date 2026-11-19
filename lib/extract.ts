// Step 2: turn cleaned page text into named facts. The model extracts; code verifies.
// A fact only counts if its quote is actually present in the text we fetched.

import { COMPETITOR_TOOLS, COMPETITOR_TRUST_HOSTS } from "./icp";
import { geminiJson, type Usage } from "./gemini";
import type { Fact, FactField, PageDoc } from "./types";

const FIELDS: FactField[] = [
  "product",
  "buyer",
  "b2b_saas",
  "funding_stage",
  "funding_date",
  "headcount",
  "open_roles",
  "enterprise_signal",
  "compliance_trigger",
  "certification",
  "compliance_tool",
  "customer_logo",
  "regulated_data",
  "hq_location",
];

const SYSTEM = `You are a B2B research analyst for Sprinto (compliance automation: SOC 2, ISO 27001, GDPR).
You read cleaned website text and pull out FACTS. Rules:
- Every fact needs a "quote": copy 4 to 25 words EXACTLY as they appear in the page text (same words, same order). No paraphrase.
- Only state what the text supports. If the page does not say it, do not output that fact. Never guess funding, headcount or customers.
- "url" must be the [PAGE url] the quote came from.
- One fact per distinct item (e.g. one per enterprise signal, one per named customer logo, max 4 logos).
- ALWAYS give a "product" fact, a "buyer" fact and a "b2b_saas" fact when the text lets you judge them: quote the line that says what it is or who uses it (e.g. "for engineering teams", "for developers", "trusted by 500 companies").`;

const FIELD_GUIDE = `Fields:
product: what they sell, one line (value)
buyer: who buys it (e.g. "engineering teams at mid-size companies")
b2b_saas: "yes" if they sell software/API/platform to businesses, "no" if consumer app, agency, services, marketplace, e-commerce store
funding_stage: Pre-seed / Seed / Series A / Series B / Series C / Series D+ / Public / Bootstrapped, only if stated
funding_date: when the latest round was announced, only if stated
headcount: number of employees, only if stated (a number or range)
open_roles: number of open jobs if a careers list shows them
enterprise_signal: enterprise plan or tier, SSO/SAML, SLA, audit logs, role-based access, "security questionnaire", "for enterprises", data residency
compliance_trigger: hiring for security/compliance/GRC/DevSecOps, "SOC 2 in progress"/"working towards ISO 27001", selling into EU/regulated buyers, a security incident, a customer requiring certification
certification: a certification they ALREADY HOLD (SOC 2 Type I/II, ISO 27001, HIPAA, PCI DSS, GDPR compliant). Not "in progress" ones (those are compliance_trigger)
compliance_tool: Vanta, Drata, Secureframe, Sprinto, Thoropass, Scrut, etc. if named as their tool / trust centre
customer_logo: a named well-known customer
regulated_data: handles payments, health, HR/payroll, financial or children's data
hq_location: city/country of HQ`;

export function norm(s: string) {
  return s
    .toLowerCase()
    .replace(/[‘’“”"'`]/g, "")
    .replace(/[^a-z0-9%$€£₹+.\- ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function quoteFound(quote: string, haystack: string): boolean {
  const q = norm(quote);
  const h = norm(haystack);
  if (!q || q.length < 8) return false;
  if (h.includes(q)) return true;
  // tolerate trimmed ends: check the longest run of 6+ consecutive words
  const w = q.split(" ");
  if (w.length >= 6) {
    for (let i = 0; i + 6 <= w.length; i++) {
      if (h.includes(w.slice(i, i + 6).join(" "))) return true;
    }
  }
  return false;
}

let factSeq = 0;
export const resetFactIds = () => {
  factSeq = 0;
};
export const nextFactId = () => `E${++factSeq}`;

type RawFact = { field: string; value: string; quote: string; url: string };

export async function extractFacts(pages: PageDoc[], domain: string, usage: Usage): Promise<Fact[]> {
  const usable = pages.filter((p) => p.ok && p.text);
  if (!usable.length) return [];
  const corpus = usable.map((p) => `[PAGE ${p.url}] (${p.kind})\n${p.text}`).join("\n\n");
  const prompt = `Company domain: ${domain}

${FIELD_GUIDE}

Return JSON: {"company_name": string|null, "one_liner": string|null, "facts": [{"field": one of ${JSON.stringify(
    FIELDS,
  )}, "value": string, "quote": string, "url": string}]}

PAGE TEXT:
${corpus}`;
  const { data } = await geminiJson<{ company_name?: string; one_liner?: string; facts?: RawFact[] }>({
    system: SYSTEM,
    prompt,
    usage,
  });
  const facts: Fact[] = [];
  for (const f of data.facts ?? []) {
    if (!FIELDS.includes(f.field as FactField) || !f.value) continue;
    const page = usable.find((p) => p.url === f.url) ?? usable.find((p) => quoteFound(f.quote ?? "", p.text + " " + (p.raw ?? "")));
    const hay = page ? `${page.text} ${page.raw ?? ""}` : usable.map((p) => p.text).join(" ");
    facts.push({
      id: nextFactId(),
      field: f.field as FactField,
      value: String(f.value).slice(0, 200),
      quote: String(f.quote ?? "").slice(0, 300),
      url: page?.url ?? f.url ?? `https://${domain}`,
      verified: quoteFound(f.quote ?? "", hay),
      via: "model",
    });
  }
  // company name / one-liner are carried as product facts when present
  if (data.company_name) facts.unshift({ id: nextFactId(), field: "product", value: `name:${data.company_name}`, quote: "", url: usable[0].url, verified: true, via: "model" });
  if (data.one_liner) facts.unshift({ id: nextFactId(), field: "product", value: `oneliner:${data.one_liner}`, quote: "", url: usable[0].url, verified: true, via: "model" });
  return facts;
}

// Deterministic signals checked in code over the raw text (incl. footer badges and link URLs).
export function regexFacts(page: PageDoc): Fact[] {
  const raw = `${page.raw ?? ""} ${page.text}`;
  const out: Fact[] = [];
  const snippet = (idx: number, len: number) =>
    raw.slice(Math.max(0, idx - 60), Math.min(raw.length, idx + len + 60)).replace(/\s+/g, " ").trim();
  const add = (field: FactField, value: string, m: RegExpExecArray) =>
    out.push({ id: nextFactId(), field, value, quote: snippet(m.index, m[0].length), url: page.url, verified: true, via: "regex" });

  const progress =
    /(soc\s?2|soc\s?ii|iso\s?\/?\s?(iec\s)?27001)[^.]{0,80}?(in progress|underway|pursuing|working towards|working toward|on track|expected by|coming soon|currently undergoing)|(in progress|underway|pursuing|working towards|working toward|currently undergoing)[^.]{0,60}?(soc\s?2|iso\s?27001)/i.exec(
      raw,
    );
  if (progress) add("compliance_trigger", "Certification in progress (stated on site)", progress);

  const certs: [RegExp, string][] = [
    [/\bsoc\s?2\b(\s?type\s?(ii|2|i|1)\b)?/i, "SOC 2"],
    [/\biso\s?\/?\s?(iec\s?)?27001\b/i, "ISO 27001"],
    [/\bhipaa(\s|-)?(compliant|certified)/i, "HIPAA"],
    [/\bpci[\s-]?dss\b/i, "PCI DSS"],
  ];
  for (const [re, name] of certs) {
    const m = re.exec(raw);
    if (!m) continue;
    // a cert string sitting right next to "in progress" is not a held cert
    const around = snippet(m.index, m[0].length).toLowerCase();
    if (/in progress|working towards|pursuing|underway|coming soon/.test(around)) continue;
    // SOC 2 mentioned as a generic topic (blog, feature for *their* customers) is weak; require a holding verb nearby
    if (!/(certified|compliant|audited|attest|type\s?(ii|2|i|1)|report|badge|achiev|obtained|completed|we are|is soc|are soc)/i.test(around))
      continue;
    add("certification", name, m);
  }

  for (const tool of COMPETITOR_TOOLS) {
    const re = new RegExp(`\\b(powered by|secured by|monitored by|trust (center|centre)[^.]{0,40})?\\s*${tool.replace(" ", "\\s?")}\\b`, "i");
    const m = re.exec(raw);
    if (!m) continue;
    const around = snippet(m.index, m[0].length).toLowerCase();
    if (/(trust|security|compliance|soc|iso|powered|monitor|secured|audit)/.test(around)) add("compliance_tool", tool, m);
  }
  for (const [host, tool] of Object.entries(COMPETITOR_TRUST_HOSTS)) {
    const i = raw.toLowerCase().indexOf(host);
    if (i >= 0) {
      const m = Object.assign([host], { index: i, input: raw, groups: undefined }) as unknown as RegExpExecArray;
      add("compliance_tool", tool, m);
    }
  }
  const sso = /\b(saml|single sign-on|sso)\b[^.]{0,60}|\benterprise (plan|tier|edition|grade)\b/i.exec(page.text);
  if (sso) add("enterprise_signal", "Enterprise tier / SSO offered", sso);
  return out;
}
