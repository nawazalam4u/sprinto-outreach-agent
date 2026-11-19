# Product and design brief

**Direction: Japanese minimal.** Paper white, sumi ink, one vermilion (shu) accent, thin rules, lots of space and quiet motion. Light by default, because she reads it at a desk in daylight. Dark mode is available.

| Token | Use | Contrast on paper |
|---|---|---|
| Ink `#1b1b1a` | Text, proven-points bars | 17:1 |
| Ink-2 `#4a4a47` | Body copy | 8.6:1 |
| Ink-3 `#6b6b66` | Secondary text | 5.3:1 |
| Shu `#c23a1c` | The one accent: the 60 line, focus ring, held | 5.2:1 |
| Matcha `#3f6b45` | Passed, sent | 6.0:1 |
| Ai (indigo) `#2e4a6b` | Unknown range band, evidence IDs | 8.4:1 |
| Kin (gold) `#8a6a1f` | Flags, held, insufficient data | 5.0:1 |

**Type:** Hiragino Mincho / Yu Mincho for display and big numbers, Hiragino Sans / system sans for text, and monospace for numerals. All are system fonts, so nothing loads from outside (CSP `default-src 'self'`).

**Rules we kept**
- One idea per section on Home; each number says what it is compared with.
- Charts are drawn to scale: the time bars and score ranges on 0–100, with the 60 line drawn in.
- There is no purple gradient or neon, no emoji icons, no eyebrow labels on every heading, and no grid of identical cards.
- Motion: sections fade up once and the running step breathes. All of it switches off under `prefers-reduced-motion`.
- At 390px there is no sideways scroll: tables scroll inside their own frame and the 7-step grid becomes 2 columns.
- Scraped text is only ever rendered as React text nodes; `dangerouslySetInnerHTML` is never used.
- Hovering or focusing an account highlights it in every view.
