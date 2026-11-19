// Sprinto ICP v1: every rule the pipeline judges by lives in this one file,
// so the ICP can change without touching the pipeline code.

export const ICP_VERSION = "v1 · Nov 2026";

export const ICP_SUMMARY = {
  oneLine:
    "B2B SaaS companies at Series A to C (roughly 20 to 500 people) that sell to larger businesses, hold no compliance-automation tool yet, and show a reason to get certified now.",
  why: [
    "Sprinto sells SOC 2, ISO 27001 and GDPR automation. The buyer is a software company whose customers ask for proof of security.",
    "Below ~20 people, enterprise deals and security questionnaires rarely exist yet, so the pain is not felt. Above ~500 people, a security team and an incumbent tool are usually in place.",
    "The moment of need is a trigger: an enterprise deal asking for SOC 2, a first security hire, a new EU or regulated customer, or a fresh funding round that brings an up-market push.",
    "A company already on Vanta, Drata, Secureframe or another automation tool is not a cold-outreach target this quarter. It is a renewal conversation later.",
  ],
};

// Compliance-automation tools. Seeing one on a trust/security page = already served.
export const COMPETITOR_TOOLS = [
  "Vanta",
  "Drata",
  "Secureframe",
  "Sprinto",
  "Thoropass",
  "Scrut",
  "Scytale",
  "Hyperproof",
  "Strike Graph",
  "Laika",
  "Delve",
  "Comp AI",
  "Oneleet",
];

// Host fragments that reveal a hosted trust centre run by a competitor tool.
export const COMPETITOR_TRUST_HOSTS: Record<string, string> = {
  "trust.vanta.com": "Vanta",
  "app.vanta.com": "Vanta",
  "trust.drata.com": "Drata",
  "drata.com/trust": "Drata",
  "secureframe.com/trust": "Secureframe",
  "trust.secureframe.com": "Secureframe",
  "sprinto.com/trust": "Sprinto",
  "trust.sprinto.com": "Sprinto",
  "trust.thoropass.com": "Thoropass",
  "trust.scrut.io": "Scrut",
};

// Hard gates. Any FAIL ends the assessment (short-circuit), UNKNOWN goes to a human.
export const GATES = [
  {
    key: "b2b_saas",
    name: "Sells software to businesses",
    rule: "Product description names a business buyer (teams, companies, developers, enterprises).",
    fail: "Consumer app, agency, marketplace or services firm: Sprinto has nothing to certify.",
  },
  {
    key: "no_tool",
    name: "Not already on a compliance-automation tool",
    rule: "No Vanta / Drata / Secureframe / Sprinto (etc.) trust centre or mention.",
    fail: "Already served by a competitor: park as a renewal target, do not cold-email.",
  },
  {
    key: "size_band",
    name: "Inside the size band",
    rule: "Not public / not 2,000+ people, and not a 1 to 4 person pre-product team.",
    fail: "Too big (in-house GRC team) or too small (no enterprise buyers yet).",
  },
];

// Rubric: 100 points, 15 signals in 4 blocks. Points need evidence.
// "external" = the website alone cannot settle it, so website silence = unknown (not "no").
// Unknown signals widen the range: low counts them as 0, high counts them as full points.
export const BLOCKS = [
  { key: "firmographic", name: "Firmographic fit", max: 30 },
  { key: "upmarket", name: "Upmarket pull", max: 25 },
  { key: "trigger", name: "Compliance trigger", max: 25 },
  { key: "fit", name: "Certification gap", max: 20 },
] as const;

export const SIGNALS = [
  { key: "stage_ac", block: "firmographic", name: "Funded Series A to C", max: 10, external: true },
  { key: "headcount_band", block: "firmographic", name: "20 to 500 people", max: 10, external: true },
  { key: "recent_funding", block: "firmographic", name: "Raised in the last 18 months", max: 5, external: true },
  { key: "growing_team", block: "firmographic", name: "5+ open roles", max: 5, external: true },
  { key: "enterprise_tier", block: "upmarket", name: "Enterprise plan, SSO/SAML or SLA", max: 10, external: false },
  { key: "enterprise_logos", block: "upmarket", name: "Named enterprise customers", max: 8, external: false },
  { key: "security_page", block: "upmarket", name: "Publishes a security/trust page", max: 7, external: false },
  { key: "cert_in_progress", block: "trigger", name: "Says SOC 2 / ISO 27001 is in progress", max: 8, external: false },
  { key: "security_hiring", block: "trigger", name: "Hiring for security / compliance", max: 6, external: true },
  { key: "regulated_data", block: "trigger", name: "Handles regulated data (payments, health, HR, finance)", max: 5, external: false },
  { key: "eu_exposure", block: "trigger", name: "EU customers or GDPR exposure", max: 3, external: false },
  { key: "questionnaire", block: "trigger", name: "Mentions security reviews / questionnaires / DPAs", max: 2, external: false },
  { key: "other_trigger", block: "trigger", name: "Other named trigger (incident, new market)", max: 1, external: false },
  { key: "no_cert", block: "fit", name: "No SOC 2 published", max: 12, external: false },
  { key: "no_iso", block: "fit", name: "No ISO 27001 published", max: 8, external: false },
] as const;

export const VERDICT_LINES = { priority: 75, qualify: 60, nurture: 40 };
export const CAPS = { noUpmarket: 55, fullyCertified: 40 };

// Evidence Map (L4): one row per question, where the answer lives, when it is
// "enough", how many fetches the question is worth, and what happens if unanswered.
export const EVIDENCE_MAP = [
  {
    field: "is_b2b_saas",
    question: "Is this B2B software?",
    fact: "A product description that names a business buyer",
    where: "Homepage hero · /product · /about",
    sufficient: "The description names who buys it",
    limit: 1,
    ifUnanswered: "Manual review",
    shortCircuit: "Yes: 'no' disqualifies and stops",
    sources: ["about", "product"],
  },
  {
    field: "certification_status",
    question: "Already certified or on a tool?",
    fact: "A named certification, a trust centre, or a competitor tool",
    where: "Footer badges · /security · /trust · trust.<domain>",
    sufficient: "A security/trust page was read, or a certification string is present",
    limit: 2,
    ifUnanswered: "Treat as not certified, flag it",
    shortCircuit: "Yes: a competitor tool disqualifies and stops",
    sources: ["security", "web_research"],
  },
  {
    field: "stage_signal",
    question: "Right stage?",
    fact: "Funding round, headcount, 5+ open roles, or an enterprise tier",
    where: "/careers (ATS API first) · /pricing · /customers · news",
    sufficient: "Any one of: funding stage named, headcount known, 5+ open roles, enterprise tier",
    limit: 2,
    ifUnanswered: "Qualify at lower rank, flagged",
    shortCircuit: "Public / 2,000+ people disqualifies",
    sources: ["job_postings", "pricing", "web_research"],
  },
  {
    field: "compliance_trigger",
    question: "A reason to act now?",
    fact: "Security/compliance hiring, 'SOC 2 in progress', regulated data, enterprise logos",
    where: "/careers · /security · /customers · news",
    sufficient: "At least one named trigger with a quote",
    limit: 1,
    ifUnanswered: "Score lower; email leads with stage instead",
    shortCircuit: "No",
    sources: ["job_postings", "customers", "web_research"],
  },
] as const;

// Agent-loop budget: 5 tool calls, of which at most 2 web searches, 120 seconds, no repeats.
export const LOOP_LIMITS = { maxToolCalls: 5, maxSearches: 2, maxMs: 120_000 };

// Who to email, by company size. Order = priority.
export const ROLE_PRIORITY = [
  {
    band: "1-50 people",
    max: 50,
    roles: ["CEO / Founder", "CTO / Co-founder", "COO"],
    why: "No security team yet. The founder or CTO personally fills in security questionnaires and signs off on the SOC 2 budget.",
    patterns: [
      [/\b(co-?founder|founder)\b.*\b(ceo|cto)\b|\b(ceo|cto)\b.*\bfounder\b/i, 100],
      [/\bcto\b|chief technology/i, 95],
      [/\bceo\b|chief executive/i, 92],
      [/\b(co-?)?founder\b/i, 90],
      [/\bcoo\b|chief operating/i, 80],
      [/head of (security|engineering)|vp,? engineering|vp of engineering/i, 75],
    ] as [RegExp, number][],
  },
  {
    band: "51-200 people",
    max: 200,
    roles: ["CTO", "Head of Security / CISO", "VP Engineering"],
    why: "The CTO owns security and usually owns the audit. A first security hire, if present, is the day-to-day owner.",
    patterns: [
      [/\bciso\b|chief information security|head of (information )?security|director of security|security lead/i, 100],
      [/\bcto\b|chief technology/i, 95],
      [/head of (compliance|grc|risk)|compliance (lead|manager|officer)|grc/i, 92],
      [/vp,? engineering|vp of engineering|head of engineering|director of engineering/i, 85],
      [/\bcoo\b|chief operating/i, 70],
      [/\bceo\b|founder/i, 65],
    ] as [RegExp, number][],
  },
  {
    band: "201+ people",
    max: Infinity,
    roles: ["CISO / Head of Security", "Head of GRC / Compliance", "CTO"],
    why: "A security or GRC owner exists. They feel the audit workload directly and run the tool evaluation.",
    patterns: [
      [/\bciso\b|chief information security|head of (information )?security|vp,? security|director of security/i, 100],
      [/head of (compliance|grc|risk)|compliance (lead|manager|officer|director)|\bgrc\b/i, 96],
      [/security (engineering )?manager|security lead/i, 85],
      [/\bcto\b|chief technology/i, 80],
      [/vp,? engineering|vp of engineering|head of engineering/i, 70],
      [/\bceo\b|founder/i, 50],
    ] as [RegExp, number][],
  },
];

export function roleBand(headcount: number | null) {
  const h = headcount ?? 125; // unknown size: use the 51-200 rules (security/GRC lead, then CTO, then founder)
  return ROLE_PRIORITY.find((b) => h <= b.max) ?? ROLE_PRIORITY[ROLE_PRIORITY.length - 1];
}

// Emails the writer must never produce
export const BANNED_PHRASES = [
  "hope this email finds you well",
  "i hope you are doing well",
  "hope you're doing well",
  "i came across your",
  "just checking in",
  "touch base",
  "synergy",
  "revolutionize",
  "game-changer",
  "game changer",
  "cutting-edge",
  "leverage our",
  "i wanted to reach out",
  "quick question",
];

export const SPRINTO_FACTS = [
  "Sprinto automates SOC 2, ISO 27001, GDPR, HIPAA and other frameworks on one platform.",
  "It connects to the cloud, HR and code tools a SaaS company already uses and runs evidence collection and control checks continuously.",
  "The point is to get audit-ready without pulling engineers off the roadmap to collect screenshots and fill spreadsheets.",
  "It includes a trust centre and help with security questionnaires, which is what enterprise buyers ask for first.",
];
