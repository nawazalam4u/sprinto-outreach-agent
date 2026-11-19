# Product and design brief: "Prospect Quest"

**Direction: Midnight quest.** Deep indigo night (the colour of trust and security, which is what Sprinto sells) on warm paper. Mango, coral, mint and lilac are the game colours. It's in the same craft family as our AI Ops hackathon build (Franchise Radar): chunky rounded cards, a quest header, pastel level tiles, and stamps. It has its own identity and is gentler on the eyes for long review sessions.

## Why gamify an outreach tool
The Growth Lead's real job after this build is *reviewing*. Reviewing 15 companies is tiring; that fatigue is the problem the case starts with. The game layer makes the review fast and legible:

| Element | What it shows at a glance |
|---|---|
| **Score ring** (every prospect) | Proven points as a coloured arc, unknown points as a pale lilac arc, and the 60 qualify line as a coral tick |
| **7-node journey** | Which of the 7 steps each company reached and where it stopped (green done, mango running, coral failed, dashed skipped) |
| **Stamps** | SENT · HELD · CUSTOMER · RIVAL · NURTURE · CHECK: the outcome in one word |
| **Quest header** | Level (by emails sent), an XP bar of research minutes saved against 17.5 min by hand, and a % time-saved ring |
| **8 badges** | Fact checker, Detective (the loop flipped a verdict), Gatekeeper, Sharpshooter (8/10+), Inbox hit, No bluffing (held an unsupported claim), Speedrun, Good citizen (respected robots.txt) |
| **Level tiles** | The 7 steps as coloured cards, so a first-time viewer understands the system in 10 seconds |
| **Confetti** | Only when an email actually lands, and switched off under reduced-motion settings |

## Tokens
| Token | Hex | Use |
|---|---|---|
| Night | `#17153b` | Header, hero, quest band, drawer head |
| Paper / card | `#faf6ee` / `#fffdf8` | Page and cards |
| Ink / ink-2 / ink-3 | `#1d1b33` / `#48455f` / `#6b6782` | Text (AA on paper) |
| Mango | `#f6b545` | Primary action, active nav, XP |
| Coral | `#ee7656` | The 60 line, failures |
| Mint · lilac · sky · rose | pastel tiles | Steps, blocks, columns |
| Status pairs | go, info, wait, warn, hold, stop | Pills; text at 4.5:1 or better on their background |

**Type:** Bricolage Grotesque (display), Instrument Serif italic (accents), Inter (text) and JetBrains Mono (numbers and labels). Fonts are self-hosted by `next/font`, so the CSP stays `default-src 'self'`.

## Rules kept
- Every number says what it is and what it's compared with. Bars, rings and ranges are drawn to scale on 0–100.
- No sideways scroll on a phone: the drawer and walls reflow, and tables scroll inside their own frame.
- Visible keyboard focus (a mango ring), a focus trap in the drawer, and Esc to close.
- Scraped text is rendered only as React text, never as HTML.
- Hovering or focusing a prospect highlights it on every page.
