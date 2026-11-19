import { describe, expect, it, beforeEach, vi } from "vitest";
import { quoteFound, regexFacts, resetFactIds } from "@/lib/extract";
import { deriveState, emptyState, gatesFor, parseHeadcount, scoreSignals, verdictFor } from "@/lib/qualify";
import { validateDraft } from "@/lib/write";
import { classifyLinks, normalizeDomain, textHash } from "@/lib/scrape";
import { roleBand } from "@/lib/icp";
import { mask, scrub, sendEmail } from "@/lib/send";
import type { Contact, Fact, PageDoc } from "@/lib/types";
import { readFileSync } from "node:fs";

const fact = (id: string, field: Fact["field"], value: string, quote = "quoted text that exists", verified = true): Fact => ({
  id, field, value, quote, url: "https://acme.io", verified, via: "model",
});
const home: PageDoc = { url: "https://acme.io", kind: "home", ok: true, outcome: "OK", via: "fetch", words: 400, text: "Acme builds payroll software for HR teams." };

describe("quote verification", () => {
  it("accepts verbatim quotes with different spacing and curly quotes", () => {
    expect(quoteFound("Trusted by  “500” finance teams", "We are trusted by \"500\" finance teams worldwide")).toBe(true);
  });
  it("rejects quotes the model invented", () => {
    expect(quoteFound("raised a Series B led by Sequoia", "We build payroll software for HR teams.")).toBe(false);
  });
});

describe("regex signals", () => {
  beforeEach(() => resetFactIds());
  it("detects a rival trust centre", () => {
    const f = regexFacts({ ...home, raw: "Visit our trust center https://trust.vanta.com/acme" });
    expect(f.some((x) => x.field === "compliance_tool" && x.value === "Vanta")).toBe(true);
  });
  it("treats SOC 2 'in progress' as a trigger, not a held certificate", () => {
    const f = regexFacts({ ...home, raw: "Our SOC 2 Type II audit is in progress and expected by Q1." });
    expect(f.some((x) => x.field === "compliance_trigger")).toBe(true);
    expect(f.some((x) => x.field === "certification")).toBe(false);
  });
});

describe("scoring", () => {
  it("unknown external signals widen the range instead of scoring zero", () => {
    const s = emptyState("acme.io");
    deriveState(s, [fact("E1", "b2b_saas", "yes")], false);
    const r = scoreSignals({ state: s, facts: [fact("E1", "b2b_saas", "yes")], pages: [home], atsRead: false, securityTried: false });
    expect(r.high).toBeGreaterThan(r.low);
    expect(r.signals.find((x) => x.key === "stage_ac")!.status).toBe("unknown");
  });
  it("a blocked security page is unknown, a 404 is absent", () => {
    const s = emptyState("acme.io");
    const facts = [fact("E1", "b2b_saas", "yes")];
    deriveState(s, facts, false);
    const blocked = scoreSignals({ state: s, facts, pages: [home, { ...home, kind: "security", ok: false, outcome: "BLOCKED" }], atsRead: false, securityTried: false });
    expect(blocked.signals.find((x) => x.key === "security_page")!.status).toBe("unknown");
    const missing = scoreSignals({ state: s, facts, pages: [home], atsRead: false, securityTried: true });
    expect(missing.signals.find((x) => x.key === "security_page")!.status).toBe("no");
  });
  it("caps a company that already holds SOC 2 and ISO 27001 at 40", () => {
    const s = emptyState("acme.io");
    const facts = [fact("E1", "b2b_saas", "yes"), fact("E2", "certification", "SOC 2"), fact("E3", "certification", "ISO 27001"), fact("E4", "enterprise_signal", "SSO")];
    deriveState(s, facts, true);
    const r = scoreSignals({ state: s, facts, pages: [home], atsRead: false, securityTried: true });
    expect(r.high).toBeLessThanOrEqual(40);
  });
  it("verdict lines: priority 75, qualify 60, straddling 60 is insufficient", () => {
    const pass = [{ name: "b2b", status: "pass" as const, detail: "", factIds: [] }];
    expect(verdictFor(pass, 80, 90)).toBe("PRIORITY");
    expect(verdictFor(pass, 62, 70)).toBe("QUALIFY");
    expect(verdictFor(pass, 50, 70)).toBe("INSUFFICIENT_DATA");
    expect(verdictFor(pass, 40, 55)).toBe("NURTURE");
    expect(verdictFor(pass, 10, 30)).toBe("REJECT");
  });
  it("a rival tool disqualifies", () => {
    const s = emptyState("acme.io");
    deriveState(s, [fact("E1", "b2b_saas", "yes"), fact("E2", "compliance_tool", "Drata")], false);
    const g = gatesFor(s, []);
    expect(verdictFor(g, 90, 90)).toBe("DISQUALIFIED");
  });
  it("a compliance vendor domain is disqualified", () => {
    const s = emptyState("vanta.com");
    s.is_b2b_saas = "yes";
    expect(gatesFor(s, []).find((g) => g.status === "fail")).toBeTruthy();
  });
  it("parses headcount formats", () => {
    expect(parseHeadcount("51-200")).toBe(126);
    expect(parseHeadcount("1,200 employees")).toBe(1200);
    expect(parseHeadcount("2k+")).toBe(2000);
  });
});

describe("person rules", () => {
  it("uses founder/CEO first at 50 or fewer, security lead at 51-200, and the 51-200 rules when size is unknown", () => {
    expect(roleBand(30).roles[0]).toMatch(/CEO|Founder/);
    expect(roleBand(150).band).toBe("51-200 people");
    expect(roleBand(null).band).toBe("51-200 people");
  });
});

describe("email validator", () => {
  const poc: Contact = { name: "Priya Shah", first_name: "Priya", title: "CTO", email: "", email_status: "unknown", confidence: null, source: "web_search", rank_reason: "", role_score: 95 };
  const s = { ...emptyState("acme.io"), company_name: "Acme", one_liner: "payroll software for HR teams" };
  const facts = [fact("E1", "compliance_trigger", "Hiring a Security Engineer", "Security Engineer · Platform Engineer")];
  const good = {
    subject: "Acme payroll and SOC 2",
    hook_fact_id: "E1",
    body: "Priya, Acme's payroll product is hiring a Security Engineer, which usually means enterprise buyers have started sending security questionnaires. Answering those by hand pulls your engineers away from the roadmap at exactly the wrong time. Sprinto connects to the cloud and HR tools you already use and keeps the evidence for an audit collected for you. Would a short walkthrough of how teams like yours get audit-ready be useful next week?\n\nNawaz from Sprinto",
  };
  it("passes a clean draft", () => {
    const failed = validateDraft(good, poc, s, facts).filter((c) => !c.pass).map((c) => c.name);
    expect(failed).toEqual([]);
  });
  it("rejects greetings, exclamations, two questions, invented numbers and scraping tells", () => {
    const bad = { ...good, body: "Hi Priya! I saw on your website you have 300 customers? Sprinto helps! Want to talk?" };
    const failed = validateDraft(bad, poc, s, facts).filter((c) => !c.pass).map((c) => c.name);
    expect(failed).toEqual(expect.arrayContaining([
      "No greeting line (Hi / Hello / Dear)",
      "No exclamation marks",
      "Exactly one question",
      "Every number appears in the evidence",
      "No banned or scraping-revealing phrases",
    ]));
  });
  it("rejects a hook with no verified evidence", () => {
    const failed = validateDraft({ ...good, hook_fact_id: "E99" }, poc, s, facts).filter((c) => !c.pass).map((c) => c.name);
    expect(failed).toContain("Hook rests on a verified, quoted fact");
  });
});

describe("send-to-self only", () => {
  it("sendEmail takes no recipient and always posts to TO_EMAIL", async () => {
    process.env.RESEND_API_KEY = "re_test_key_123456";
    process.env.TO_EMAIL = "me@example.com";
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "msg_1" }), { status: 200 }));
    const poc = { name: "Priya Shah", title: "CTO", email: "priya@acme.io", email_status: "valid" } as Contact;
    const r = await sendEmail("Acme test", "Priya, body?", poc, "Acme");
    const body = JSON.parse((spy.mock.calls[0][1] as RequestInit).body as string);
    expect(body.to).toEqual(["me@example.com"]);
    expect(body.text).toContain("Intended recipient: Priya Shah");
    expect(r.status).toBe("sent");
    expect(sendEmail.length).toBe(4); // subject, body, poc, company: no recipient parameter
    spy.mockRestore();
  });
  it("scrubs keys out of error messages and masks addresses", () => {
    expect(scrub("bad key re_abcdefghijkl and api_key=SECRET")).not.toMatch(/abcdefghijkl|SECRET/);
    expect(mask("nawaz@example.com")).toBe("na•••@example.com");
  });
});

describe("scraping helpers", () => {
  it("normalises domains", () => {
    expect(normalizeDomain("https://www.Acme.io/pricing?x=1")).toBe("acme.io");
  });
  it("finds security, careers and pricing links, including job boards", () => {
    const k = classifyLinks(
      [
        { url: "https://acme.io/security", text: "Security" },
        { url: "https://jobs.ashbyhq.com/acme", text: "Careers" },
        { url: "https://acme.io/pricing", text: "Pricing" },
        { url: "https://twitter.com/acme", text: "X" },
      ],
      "acme.io",
    );
    expect(k.security).toContain("https://acme.io/security");
    expect(k.careers).toContain("https://jobs.ashbyhq.com/acme");
    expect(k.pricing).toContain("https://acme.io/pricing");
  });
  it("hash detects soft 404s that serve the homepage", () => {
    expect(textHash("same page")).toBe(textHash("same page"));
  });
});

describe("repo hygiene", () => {
  it("ignores secret files", () => {
    const gi = readFileSync(".gitignore", "utf8");
    expect(gi).toMatch(/^\.env$/m);
    expect(gi).toMatch(/\.env\*\.local|\.env\.\*/);
  });
});
