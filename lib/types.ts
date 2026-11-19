// Shared types for the 7-step pipeline.

export type FactField =
  | "product"
  | "buyer"
  | "b2b_saas"
  | "funding_stage"
  | "funding_date"
  | "headcount"
  | "open_roles"
  | "enterprise_signal"
  | "compliance_trigger"
  | "certification"
  | "compliance_tool"
  | "customer_logo"
  | "regulated_data"
  | "hq_location";

export type Fact = {
  id: string; // E1, E2… (evidence ledger)
  field: FactField;
  value: string;
  quote: string; // verbatim text the value rests on
  url: string; // where the quote lives
  verified: boolean; // quote found in the fetched text (checked in code, not by the model)
  via: "model" | "regex" | "ats_api" | "web_search" | "news" | "hunter" | "manual";
};

export type FetchOutcome = "OK" | "NOT_FOUND" | "BLOCKED" | "TIMEOUT" | "EMPTY_SHELL" | "NON_HTML" | "TOO_BIG" | "ROBOTS" | "ERROR";

export type PageDoc = {
  url: string;
  kind: string; // home, security, careers, pricing, customers, about, ats, search
  ok: boolean;
  outcome: FetchOutcome;
  via: "fetch" | "jina" | "api" | "search";
  words: number;
  text: string; // cleaned, capped text the model reads
  raw?: string; // fuller text used only for code-side regex checks
  error?: string;
  ms?: number;
};

export type PageSummary = Omit<PageDoc, "raw" | "text">;

export type LinkRef = { url: string; text: string };

// The state object (L6): fixed schema, decided before the run starts.
export type CompanyState = {
  domain: string;
  company_name: string | null;
  one_liner: string | null;
  is_b2b_saas: "yes" | "no" | "unknown";
  certification_status: "unknown" | "none_found" | "in_progress" | "certified";
  certifications: string[];
  compliance_tool: string | null;
  funding_stage: string | null;
  funding_date: string | null;
  headcount: number | null;
  open_roles: number | null;
  enterprise_signals: string[];
  compliance_triggers: string[];
  regulated_data: boolean;
  pages_read: string[]; // kinds read OK
  pages_tried: string[];
  tool_calls: number;
  searches: number; // attempts (budget)
  search_ok: boolean; // a search actually returned sources (evidence)
  profile_read: boolean; // Hunter company profile read
  loop_iterations: number;
  verdict: Verdict | null;
  fixed_verdict: Verdict | null; // what a fixed pipeline (no loop) would have said
  score_low: number | null;
  score_high: number | null;
  fixed_low: number | null;
  fixed_high: number | null;
  status: Status;
};

export type Verdict = "PRIORITY" | "QUALIFY" | "NURTURE" | "REJECT" | "DISQUALIFIED" | "INSUFFICIENT_DATA";
export type Status = "running" | "sent" | "held" | "drafted" | "not_qualified" | "insufficient_data" | "no_contact" | "failed";

export type GateResult = {
  name: string;
  status: "pass" | "fail" | "unknown";
  detail: string;
  factIds: string[];
};

export type SignalResult = {
  key: string;
  block: string;
  name: string;
  max: number;
  points: number; // awarded when status = yes
  status: "yes" | "no" | "unknown";
  external: boolean; // the website alone cannot settle it
  why: string;
  factIds: string[];
};

export type LoopStep = {
  iteration: number;
  low: number;
  high: number;
  tool: string;
  args: string;
  reason: string; // why the agent chose this tool
  result: string;
  ok: boolean;
  lowAfter: number;
  highAfter: number;
};

export type Contact = {
  name: string;
  first_name: string;
  title: string;
  email: string;
  email_status: "verified" | "valid" | "accept_all" | "unknown" | "pattern_guess" | "manual" | "finder";
  confidence: number | null;
  source: "hunter" | "web_search" | "manual" | "website";
  source_url?: string;
  linkedin?: string | null;
  rank_reason: string;
  role_score: number;
};

export type PainPoint = { title: string; why: string; factIds: string[] };

export type Check = { name: string; pass: boolean; detail?: string };

export type DraftAttempt = {
  n: number;
  subject: string;
  body: string;
  hookFactId: string | null;
  checks: Check[];
  review: { specificity: number; relevance: number; reply_likelihood: number; avg: number; critique: string; unsupported?: string[] } | null;
  passed: boolean;
};

export type Draft = {
  subject: string;
  body: string;
  hook: string;
  hookFactId: string | null;
  why_this_angle: string;
  checks: Check[];
  review: DraftAttempt["review"];
  attempts: DraftAttempt[];
  passed: boolean;
};

export type SendResult = {
  status: "sent" | "not_configured" | "failed" | "held" | "skipped";
  to?: string; // masked
  messageId?: string;
  error?: string;
  gmailComposeUrl?: string;
  at?: string;
  reason?: string;
};

export type CompanyResult = {
  domain: string;
  startedAt: string;
  finishedAt?: string;
  ms?: number;
  state: CompanyState;
  pages: PageSummary[];
  facts: Fact[];
  loop: LoopStep[];
  gates: GateResult[];
  signals: SignalResult[];
  caps: string[];
  reasons: string[];
  contacts: Contact[];
  poc: Contact | null;
  pocMethod: string;
  painPoints: PainPoint[];
  draft: Draft | null;
  send: SendResult | null;
  usage: { calls: number; inTokens: number; outTokens: number; usd: number };
  error?: string;
  review?: { lead_agrees?: "yes" | "no" | ""; edit_level?: "none" | "light" | "heavy" | ""; replied?: boolean; notes?: string };
};

export type StepId = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type RunEvent =
  | { type: "step"; step: StepId; status: "running" | "done" | "skipped" | "error"; title: string; detail?: string }
  | { type: "log"; step: StepId; message: string }
  | { type: "state"; state: CompanyState }
  | { type: "result"; result: CompanyResult }
  | { type: "fatal"; error: string };

export type ManualPoc = { name: string; title: string; email: string };

export type StyleExample = { before: string; after: string };
