# Decisions

## Five Pre-Build Decisions

| Decision | Answer |
|---|---|
| **Outcome** | After this system runs, the Growth Lead researches a prospect in under 2 minutes instead of 15–20, and sends at least twice as many first emails a week at an equal or better reply rate. |
| **Baseline** | 8–15 companies a week at 15–20 minutes each (2–5 hours), with quality falling late in the list. Still needed: today's reply rate and meetings per 100 emails, from HubSpot or Gmail. |
| **Workflow change** | She moves from researcher-and-writer to reviewer-and-sender: paste the list, clear "Needs you", forward the emails that passed, log edits and replies. |
| **Measurement (90 days)** | Days 1–30: minutes per company, heavy-rewrite rate (<20%), verdict agreement (>80%). Days 31–60: reply rate vs baseline. Days 61–90: meetings per 100 emails. |
| **Kill criterion** | Stop if any sent email has an unbacked claim, if >50% of emails are heavily rewritten at day 30, if PoC accuracy is <60%, or if running it takes longer than the time it saves. |

## Build decisions and why

| Choice | Why |
|---|---|
| Live app on Vercel (Next.js), not a CLI | The submission needs a public link that runs end to end. Each company runs as a 300-second streamed function, so the user sees every step live. |
| Rubric blocks 30 / 25 / 25 / 20 (not the draft's 30 / 25 / 35 / 10) | Devil's advocate after the first live runs. "Compliance trigger" signals (an audit in progress, security hiring) are the hardest to prove from public data, so 35 points there meant almost no real company could reach 60. The certification gap ("no SOC 2 yet") is the actual reason Sprinto calls, yet it was worth only 10. We moved 10 points from trigger to gap. The caps stay: no upmarket pull caps the score at 55; holding SOC 2 and ISO 27001 caps it at 40. |
| Hunter Company Enrichment as a loop tool | Google Search grounding returned "quota exceeded" on the free key. A data provider is the L4-preferred source anyway: employees, money raised and HQ for 0.2 credits. A stage worked out from money raised is labelled "estimate". |
| Google News RSS as the search fallback | Free and needs no key. The model may only cite a headline we actually fetched, and the headline must name the company. |
| Funding headlines read in code | Live re-runs showed the AI sometimes dropped the date from the same headline, which flipped a borderline verdict. A headline that names the company and says "raises / Series A" now gives the stage and date deterministically; the AI only handles what code cannot. |
| Fact-checking reviewer | The 16 rules catch form, but not invented claims without numbers ("your EU expansion"). The reviewer gets the evidence list, must name any unsupported claim, and any one fails the draft. |
| Score as a range [low, high] | A thin homepage should not be read as "no". Unknown signals widen the range, and the loop runs only while the 60 line is inside it. That is the L4 rule: "a loop knows when it doesn't know enough". |
| AI picks the tool, code decides the verdict | The model is good at "which page would answer this?". Code is better at arithmetic and at being repeatable. Every tool has a four-part description: what / when / when not / returns. |
| Quote verification in code | A model can be confident about an empty page. A quote is either on the page or it is not. |
| Resend for delivery | Your choice, and the professor's standard stack. To: is hard-coded. A Gmail compose link covers the case's Gmail wording. |
| Hunter, else grounded search, never a guess | The case allows Hunter or a hard-coded PoC. A guessed address is an invented fact. |
| Browser storage, no database | One user, and no prospect data held on a server. The review data still survives reloads. |
| Held, not sent, when no draft passes | The failure we design against is "activity that looks like work". A held email costs a minute; a bad one costs a prospect. |
