# PRD · Sprinto Cold Outreach Agent

**Owner:** Nawaz Alam (builder) · **User:** Sprinto's Growth Lead · **Case:** MESA C4 Term 2, Case 02 · **Status:** v1 built, Nov 2026

---

## 1. Problem

Sprinto sells SOC 2, ISO 27001 and GDPR automation to SaaS companies. The Growth Lead does outbound by hand. Each prospect takes 15–20 minutes: read the site, decide if it fits, find the right person, write a first email. That is 8–15 companies a week, or 2–5 hours.

The cost is not only time. Emails late in the list get worse because she is tired, not because those companies fit less. The best-fit company on Friday afternoon gets the weakest email.

**What must be true for this to be worth solving.** The ICP is stable and well defined (SaaS, Series A–C, audit pressure or enterprise pull). The research is the same every week, and the input (public websites, job boards, news, contact data) is available legally.

## 2. Who it is for

| User | Job to be done | What they need from the system |
|---|---|---|
| Growth Lead (primary) | "Give me a short list I can email today, with a first draft I would actually send." | A verdict she can defend, the right person, an email with a real hook, and the reason behind each decision |
| Head of Sales (secondary) | "Is outbound getting better or just faster?" | Time per company, the held/sent ratio, reply rate, and how often she rewrites |

## 3. Goals and non-goals

**Goals (v1)**
1. Take a list of domains and run end to end with no decisions mid-run.
2. Qualify against an explicit, editable ICP. Every point of the score is backed by a quoted piece of evidence.
3. Research further only when the evidence cannot settle the verdict (the agent loop), within a fixed budget.
4. Pick the decision-maker by role and company size, and never invent one.
5. Write an email she would send: by name, one real hook, one question. It must pass 16 rules checked in code and an AI reviewer.
6. Send it automatically, but only to her own inbox.

**Non-goals (The Cut)**
- Sending to real prospects. To: is hard-coded to her own address.
- Follow-ups, reply handling and booking meetings (that is the L6 agent).
- Scraping LinkedIn or any page behind a login.
- Guessing email addresses.
- Letting the AI set a score (the AI cites, code calculates).

## 4. Success metrics

| Metric | Baseline | Target | Where it is measured |
|---|---|---|---|
| Minutes of research per company | 15–20 (case brief) | under 2 | Logged on every run (Home page) |
| Emails needing a heavy rewrite | unknown | under 20% at day 30 | Review tab, "how much did you edit" |
| Verdict agreement | n/a | over 80% | Review tab, "do you agree" |
| Reply rate | Pull from HubSpot/Gmail before day 1 | equal or better | Her inbox and CRM |
| Unbacked claims sent | n/a | 0 (kill switch) | Validator + review |

## 5. The 7-step pipeline: functional requirements

| # | Step | Requirement | How it is met |
|---|---|---|---|
| 1 | Scrape | Read the homepage cheaply. Respect robots.txt. Every result has a typed outcome. A blocked page means unknown, never absent. | Plain request plus cheerio cleaning (strip nav, footer and cookie banners; ≤1,400 words). Jina Reader for JS-only pages. Outcomes: OK / NOT_FOUND / BLOCKED / TIMEOUT / EMPTY_SHELL / NON_HTML / TOO_BIG. Soft-404s caught by hash. |
| 2 | Extract | Named facts, each with a verbatim quote and URL. Keep a fact only if its quote really appears on the page. | Gemini returns facts. Code runs a normalised substring check, then regex signals for certifications, rival trust centres, SSO and "SOC 2 in progress". The result is an evidence ledger E1…En. |
| 3 | Qualify + agent loop | 3 hard gates, then a 100-point rubric (15 signals, 4 blocks). Score as a [low, high] range. Research more while 60 sits inside the range. | The planner (Gemini) picks one tool per turn: `fetch_page`, `web_research` (Google Search grounding) or `job_postings` (Greenhouse/Lever/Ashby APIs). Budget: 5 calls, 2 searches, 120 s, no repeats. Records the verdict before the loop and after it. |
| 4 | Person | The right decision-maker by size. Never sales, marketing or HR. Never invented. | Hunter Domain Search plus Email Finder, cached. Without Hunter: named leaders from grounded search, and no email guessed. Option B: a person hard-coded next to the domain. |
| 5 | Pain points | Two, for this person's role, each citing evidence, the data the company handles and who its buyer is. | One Gemini call over the evidence ledger. |
| 6 | Email | By name, a hook from one quoted fact, one proof line from a whitelist, exactly one question. | Up to 4 drafts. 16 rules checked in code, then an AI reviewer (specificity, relevance, reply-likelihood); 7/10 to pass. If none passes, the email is held. |
| 7 | Send | Gmail-style delivery to her own inbox only. The body names who it is for. | Resend. `sendEmail()` takes no recipient parameter. A Gmail compose link is the fallback. |

**Statuses:** sent · drafted · held · not_qualified · insufficient_data · no_contact · failed. One bad domain never stops a batch.

## 6. Interface requirements

- **Home:** a proof-first story, one claim per section. Time vs by hand, verdicts the loop changed, the funnel with drop-out reasons, emails sent vs held with reviewer scores, and "Needs you".
- **Run:** paste domains (or `domain, Name, Title, email` for Option B), toggle auto-send, and watch the 7 steps live per company.
- **Accounts:** a filterable table. **Pipeline:** a board by status.
- **Account drawer:** Company (gates, rubric, evidence ledger), Person, Email (rules, reviewer, edit and send), Activity (loop turns, pages read, cost), Review form. Esc closes it, and focus stays inside while it is open.
- **ICP:** the full rule set in plain words. **Brief:** the Nine Checks, the Five Decisions and the Components Map.
- WCAG AA contrast, keyboard focus, reduced motion respected, no sideways scroll at 390px.

## 7. Non-functional requirements

| Area | Requirement |
|---|---|
| Cost | Cents per company (about 10–20 Gemini Flash calls). Free tiers for Hunter (25/mo), Resend and Vercel. |
| Latency | Under 2 minutes per company. Vercel function limit 300 s. |
| Privacy | Prospect data stays in the user's browser. Emails go only to the builder's inbox. No LinkedIn. robots.txt respected. |
| Security | Keys only in Vercel env vars. Never in git, never echoed in errors (scrubbed). CSP `default-src 'self'`. Rate limit of 40 companies per hour per visitor. |
| Honesty | No invented people, addresses, numbers or claims. Unknown is shown as unknown. |

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Model invents a fact | Quote must be found word-for-word on the page, otherwise ignored. The hook must cite a verified fact. Every number in the email must appear in the evidence. |
| Thin homepage leads to a wrong verdict | Score as a range. The loop researches until the range clears 60 or the budget ends. INSUFFICIENT_DATA when it cannot. |
| Wrong person | Role table by size. Sales, marketing and HR excluded. Hunter verification status shown. Kill switch if PoC accuracy falls below 60%. |
| Site blocks bots | Typed outcome. Unreadable counts as unknown, not absent. Logged in "Needs you". |
| Generic email | 16 rules, an AI reviewer, up to 4 rewrites, else held. Her edits are learned for the next drafts. |
| Runaway cost | Hard loop budget, rate limit, cheap model. |

## 9. Rollout

1. **Week 0:** Pull baseline reply rate and meetings per 100 emails. Run 10 known accounts and compare verdicts with her judgement.
2. **Days 1–30:** Weekly Monday runs. Track minutes per company, rewrite rate and agreement.
3. **Days 31–90:** Reply rate and meetings vs the baseline. Tune `lib/icp.ts` from the review data.

## 10. Open questions (labelled assumptions)

- **Assumption:** Sprinto's best customers look like the ICP above. Validate it against closed-won deals in HubSpot.
- **Missing number:** today's reply rate. Get it from Gmail or HubSpot before day 1, otherwise there is no baseline.
- **Assumption:** 60 is the right qualify line. Adjust it after 30 days of agree/disagree data.
