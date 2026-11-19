// The Nine Checks + Five Pre-Build Decisions, done BEFORE building (MESA L4 method).
// One source for the /brief page and the docs/nine-checks.png image.

export type Check = {
  n: string;
  q: string;
  badge: string;
  tone: "yes" | "qual";
  text: string;
  human?: string;
};

export const CHECK_GROUPS: { title: string; rule: string; checks: Check[] }[] = [
  {
    title: "Kill Switches",
    rule: "Any No means: don't build it.",
    checks: [
      {
        n: "01",
        q: "Problem real?",
        badge: "YES",
        tone: "yes",
        text: "15–20 min of research per company × 8–15 companies a week = 2–5 Growth Lead hours a week. Emails late in the list get worse because she is tired, not because the companies fit less.",
      },
      {
        n: "02",
        q: "Workflow repeated?",
        badge: "YES",
        tone: "yes",
        text: "The same four moves every week, for every new list: read the site, judge fit, find the person, write the opener. The ICP stays the same; only the domains change.",
      },
      {
        n: "03",
        q: "Input available?",
        badge: "YES",
        tone: "yes",
        text: "Company sites are public (robots.txt respected). Job boards have free APIs (Greenhouse, Lever, Ashby). Funding and headcount come from Google Search with citations. People come from Hunter.io (25 free searches a month). No LinkedIn scraping.",
      },
    ],
  },
  {
    title: "Sizing",
    rule: "Any No means: build something smaller.",
    checks: [
      {
        n: "04",
        q: "Output valuable?",
        badge: "YES",
        tone: "yes",
        text: "Per company: a verdict with its score range, a named decision-maker with the reason for picking them, two pains tied to quoted evidence, and an email that passed 16 rules. She can act on it as it stands.",
      },
      {
        n: "05",
        q: "Impact measurable?",
        badge: "YES",
        tone: "yes",
        text: "Logged on every run: time per company (live: 37 s vs 17.5 min by hand), held vs sent, reviewer score, and verdicts the loop changed (7 of 14 in the first runs). Logged by the Growth Lead in the Review tab: verdict agreement, how much she edited, and replies.",
      },
      {
        n: "06",
        q: "ROI worth it?",
        badge: "YES",
        tone: "yes",
        text: "Measured on 12 live companies: 37 s and about $0.005 each on average, and 89 s and about $0.013 when an email is written. Free tiers cover a 15-company week: Gemini, Hunter (about 1.2 credits per qualified company), Resend and Vercel. In return, 2–5 Growth Lead hours a week go back into calls.",
      },
    ],
  },
  {
    title: "Boundary",
    rule: "Any No means: put a human exactly here.",
    checks: [
      {
        n: "07",
        q: "Failure risk OK?",
        badge: "YES → own inbox only",
        tone: "qual",
        text: "A wrong verdict is cheap: the evidence is on screen and she can overrule it. A wrong email to a real prospect is not: it costs the brand and raises GDPR/DPDP exposure. So To: is hard-coded to her own inbox, and a draft that fails any check is held.",
        human: "Human placed exactly here: the Growth Lead forwards each email to the real prospect herself.",
      },
      {
        n: "08",
        q: "Judgment protected?",
        badge: "YES → human sets the ICP",
        tone: "qual",
        text: "The AI never sets a score. It extracts quoted facts and picks which page to read next. Code checks that each quote is real, applies the gates and computes the 100-point rubric.",
        human: "Human placed exactly here: she owns the ICP rules and thresholds (one file) and reviews every verdict.",
      },
      {
        n: "09",
        q: "Owner clear?",
        badge: "YES",
        tone: "yes",
        text: "Growth Lead: the ICP, the send decision and the review log. Builder: data sources, prompts, the 16 email rules and the kill switch. The data lives in her browser, so nobody else can see it.",
        human: "Human placed exactly here: one owner per decision, written down before the build.",
      },
    ],
  },
];

export const VERDICT =
  "BUILD IT. All three kill switches and all three sizing checks are YES, so we build the full 7-step system rather than a smaller one. The boundary checks set where the human stays: the system researches, qualifies, writes and sends to the Growth Lead's own inbox. She decides what reaches a real prospect.";

export const THE_CUT = [
  "Sending to real prospects (To: is always her own inbox)",
  "Follow-ups and replies (the L6 agent, not this build)",
  "Scraping LinkedIn or anything behind a login",
  "Guessing email addresses (Hunter or nothing)",
  "Letting the AI set the score (the AI cites, code calculates)",
];

export const FIRST_PRINCIPLES = [
  { h: "The job", t: "Turn a list of domains into qualified, cited first emails without the Growth Lead deciding anything mid-run." },
  { h: "The facts", t: "15–20 min per company, 8–15 a week. The ICP is SaaS, Series A–C, with audit pressure or enterprise pull." },
  { h: "The rules we must obey", t: "Send through email only to our own address. Use Hunter.io or a hard-coded person. Defend every decision." },
  { h: "Where the human stays", t: "The ICP rules, the review of verdicts, and every send to a real prospect." },
];

export const DECISIONS = [
  {
    k: "Outcome",
    t: "After this system runs, the Growth Lead researches a prospect in under 2 minutes instead of 15–20, and sends at least twice as many first emails a week at an equal or better reply rate.",
  },
  {
    k: "Baseline",
    t: "8–15 companies a week, 15–20 min each (2–5 hours), quality falling late in the list. Still needed: today's reply rate and meetings per 100 emails. Pull these from HubSpot or Gmail before day 1.",
  },
  {
    k: "Workflow change",
    t: "She moves from researcher-and-writer to reviewer-and-sender. Monday: paste the domain list. Then work through \"Needs you\", forward the emails that passed, and log edits and replies in the Review tab.",
  },
  {
    k: "Measurement · 90 days",
    t: "Days 1–30: minutes per company, heavy-rewrite rate (target under 20%), verdict agreement (target over 80%). Days 31–60: reply rate vs the baseline. Days 61–90: meetings booked per 100 emails. All measured in her inbox and CRM, not in our logs.",
  },
  {
    k: "Kill criterion",
    t: "Stop if any sent email carries a claim not backed by evidence, if more than 50% of emails are heavily rewritten at day 30, if PoC accuracy falls below 60% (wrong person or bounced), or if running the system takes longer than the time it saves.",
  },
];
