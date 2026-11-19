// The Nine Checks + Five Pre-Build Decisions, done BEFORE building (MESA L4 method).
// One source for the /brief page and the docs/nine-checks.png image. Kept short on purpose.

export type Check = { n: string; q: string; badge: string; tone: "yes" | "qual"; text: string; human?: string };

export const CHECK_GROUPS: { title: string; rule: string; color: string; checks: Check[] }[] = [
  {
    title: "Kill switches",
    rule: "Any No → don't build it",
    color: "#fbd0c2",
    checks: [
      { n: "01", q: "Problem real?", badge: "YES", tone: "yes", text: "15–20 min per company × 8–15 a week = 2–5 hours. Late-list emails get worse from fatigue, not fit." },
      { n: "02", q: "Workflow repeated?", badge: "YES", tone: "yes", text: "Same 4 moves every week: read the site, judge fit, find the person, write the opener." },
      { n: "03", q: "Input available?", badge: "YES", tone: "yes", text: "Public sites (robots.txt respected), job-board APIs, Hunter.io, news. No LinkedIn scraping." },
    ],
  },
  {
    title: "Sizing",
    rule: "Any No → build something smaller",
    color: "#c9ecd9",
    checks: [
      { n: "04", q: "Output valuable?", badge: "YES", tone: "yes", text: "A verdict with its score, the right person, 2 cited pains and a checked email she can send." },
      { n: "05", q: "Impact measurable?", badge: "YES", tone: "yes", text: "Measured on 14 live companies: about 1 min each vs 17.5 by hand; 7 verdicts changed by research." },
      { n: "06", q: "ROI worth it?", badge: "YES", tone: "yes", text: "About $0.006 per company ($0.016 with an email). Free tiers cover a week. 2–5 hours back." },
    ],
  },
  {
    title: "Boundary",
    rule: "Any No → put a human exactly here",
    color: "#d8cff8",
    checks: [
      { n: "07", q: "Failure risk OK?", badge: "YES → own inbox", tone: "qual", text: "A wrong verdict is cheap. A wrong email to a real prospect is not.", human: "To: is hard-coded to her inbox. She forwards." },
      { n: "08", q: "Judgment protected?", badge: "YES → she sets ICP", tone: "qual", text: "AI quotes facts and picks pages. Code scores, gates and checks every email.", human: "She owns the ICP rules and reviews verdicts." },
      { n: "09", q: "Owner clear?", badge: "YES", tone: "yes", text: "Growth Lead: ICP, send, review log. Builder: sources, prompts, rules, kill switch.", human: "One owner per decision, written before the build." },
    ],
  },
];

export const VERDICT = "BUILD IT. All kill switches and sizing checks pass, so we build the full 7-step system. The agent researches, qualifies, writes and sends to her own inbox; she decides what reaches a real prospect.";

export const THE_CUT = ["Sending to real prospects", "Follow-ups and replies (the L6 agent)", "LinkedIn or anything behind a login", "Guessing email addresses", "Letting the AI set the score"];

export const FIRST_PRINCIPLES = [
  { h: "The job", t: "Domains in → qualified, cited first emails out. No decisions mid-run." },
  { h: "The facts", t: "15–20 min per company, 8–15 a week. ICP: SaaS, Series A–C, audit or enterprise pressure." },
  { h: "The rules", t: "Send only to our own inbox. Hunter.io or a hard-coded person. Defend every decision." },
  { h: "Human stays", t: "ICP rules, verdict review, and every send to a real prospect." },
];

export const DECISIONS = [
  { k: "Outcome", t: "Research per prospect drops from 15–20 min to under 2, and first emails per week at least double at an equal or better reply rate." },
  { k: "Baseline", t: "8–15 companies a week, 2–5 hours. Still needed: today's reply rate (pull from HubSpot or Gmail before day 1)." },
  { k: "Workflow change", t: "She moves from researcher-writer to reviewer-sender: paste the list, clear \"Needs you\", forward what passed." },
  { k: "Measure · 90 days", t: "Days 1–30: minutes per company, heavy rewrites under 20%, agreement over 80%. Then reply rate, then meetings per 100 emails." },
  { k: "Kill criterion", t: "Stop if any sent email has an unbacked claim, over 50% heavy rewrites at day 30, PoC accuracy under 60%, or it costs more time than it saves." },
];
