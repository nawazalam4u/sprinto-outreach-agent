# Sprinto Outreach Agent

Give it a list of company domains. For each one it reads the website, decides whether the company fits Sprinto's ICP, finds the right decision-maker, works out their two likely pains, writes a personalised cold email, checks it, and sends it to **your own inbox only**. Every decision links back to quoted evidence.

MESA C4 · Term 2 · Case 02 ("Cold Outreach, at Scale").

- **Brief (Nine Checks, Five Decisions, Components Map):** `/brief` in the app, plus [`docs/nine-checks.png`](docs/nine-checks.png) and [`docs/components-map.png`](docs/components-map.png)
- **PRD:** [`docs/PRD.md`](docs/PRD.md) · **Decisions:** [`docs/DECISIONS.md`](docs/DECISIONS.md) · **Design brief:** [`docs/PRODUCT.md`](docs/PRODUCT.md)

## How it works

```
domains ─► 1 Scrape homepage (robots.txt, clean, Jina for JS pages, typed outcomes)
        ─► 2 Extract facts with exact quotes (Gemini) ─► code keeps only quotes found on the page
        ─► 3 Gates + 100-point rubric as a [low, high] range (code)
              └─ while 60 is inside the range: agent picks ONE tool
                 fetch_page · company_profile (Hunter) · job_postings (ATS APIs) · web_research (Google Search → News RSS)
                 budget 5 calls · 2 searches · 120 s · no repeats
        ─► 4 Person: role rules by size (code) ← Hunter Domain Search + Email Finder
        ─► 5 Two pain points, cited (Gemini)
        ─► 6 Email: up to 4 drafts × 16 rules in code × AI reviewer ≥ 7/10, else HELD
        ─► 7 Resend → TO_EMAIL only (sendEmail() has no recipient parameter)
```

**Gemini extracts, plans and writes. Code checks every quote, applies every gate, computes every score and enforces every email rule.**

## Run it locally

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in `.env.local`:

| Key | Needed | Notes |
|---|---|---|
| `GEMINI_API_KEY` | yes | AI Studio key. New keys use the Interactions API with `gemini-3.8-flash` (set automatically). |
| `HUNTER_API_KEY` | recommended | Option A for the person. Without it, leaders come from Google Search and no email is guessed. |
| `RESEND_API_KEY`, `TO_EMAIL` | for sending | Without a verified domain, `TO_EMAIL` must be your Resend sign-up email. Without these you get a Gmail draft link instead. |
| `GEMINI_MIN_INTERVAL_MS` | optional | Gap between Gemini calls (default 1200 ms) for free-tier rate limits. |

```bash
npm run dev
```

Open http://localhost:3000/run and paste domains. To hard-code a person (Option B), use a line like `acme.com, Priya Shah, CTO, priya@acme.com`.

Terminal run (writes `out/<domain>.json`):

```bash
npx vite-node scripts/live.ts acme.com example.io
```

## Tests

```bash
npm test
```

21 tests cover: quote verification, rival trust-centre detection, "in progress" vs held certificates, unknown vs absent, the score caps and verdict lines, gates, headcount parsing, role rules, the 16 email rules, send-to-self only, key scrubbing, link classification, and that secret files are git-ignored.

## Safety

- To: is always `TO_EMAIL`, and the email footer names the intended person.
- Keys live only in environment variables, are never committed, and are scrubbed from error messages.
- The app sets CSP `default-src 'self'`, `nosniff` and `no-referrer`, and rate-limits each visitor to 40 companies an hour.
- robots.txt is respected. Nothing behind a login is read, and LinkedIn is not scraped.
- Scraped text is rendered as plain text only.
