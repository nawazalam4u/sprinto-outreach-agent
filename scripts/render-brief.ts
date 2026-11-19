// Builds docs/nine-checks.html from lib/brief.ts (same content as the /brief page).
import { writeFileSync } from "node:fs";
import { CHECK_GROUPS, FIRST_PRINCIPLES, THE_CUT, VERDICT, DECISIONS } from "../lib/brief";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const icons = ["⚡", "📊", "🚧"];
const groups = CHECK_GROUPS.map(
  (g, i) => `<div class="col"><h2>${icons[i]} ${g.title}</h2><p class="rule">${g.rule}</p>${g.checks
    .map(
      (c) => `<div class="card"><div class="ch"><span class="n">${c.n}</span><b>${esc(c.q)}</b><span class="badge ${c.tone}">${esc(c.badge)}</span></div><p>${esc(c.text)}</p>${
        c.human ? `<div class="human">👤 ${esc(c.human)}</div>` : ""
      }</div>`,
    )
    .join("")}</div>`,
).join("");

const html = `<!doctype html><html><head><meta charset="utf-8"><style>
*{box-sizing:border-box}body{margin:0;width:1500px;padding:36px 40px 40px;font-family:-apple-system,"Helvetica Neue",Arial,sans-serif;color:#1d1d1f;background:#fff}
h1{margin:0;font-size:34px;letter-spacing:-.01em}.sub{color:#6e6e73;margin:6px 0 22px;font-size:15px}
.fp{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:26px}.fp div{border:1px solid #e5e5ea;border-radius:10px;padding:12px 14px;background:#fafafa;font-size:13.5px;line-height:1.45;color:#3a3a3c}.fp b{display:block;font-size:12px;letter-spacing:.06em;color:#c23a1c;margin-bottom:4px;text-transform:uppercase}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px}h2{margin:0;font-size:22px}.rule{margin:2px 0 12px;color:#6e6e73;font-style:italic;font-size:14px}
.card{border:1px solid #e5e5ea;border-radius:12px;padding:14px 16px;margin-bottom:14px;background:#fbfbfd}.ch{display:flex;align-items:center;gap:8px}.n{color:#c23a1c;font-weight:700;font-size:18px}.ch b{font-size:17px;flex:1}
.badge{font-size:12px;font-weight:700;padding:3px 9px;border-radius:6px;white-space:nowrap}.badge.yes{background:#e3f4e8;color:#1f7a3a}.badge.qual{background:#fdf0d8;color:#8a5a00}
.card p{margin:8px 0 0;font-size:14px;line-height:1.5;color:#3a3a3c}.human{margin-top:10px;background:#e8f0fb;border-left:4px solid #2e5ea8;border-radius:6px;padding:8px 10px;font-size:13.5px;font-weight:600;color:#1d3f73}
.verdict{margin-top:14px;border:1px solid #d9d2f0;background:#f4f1fd;border-radius:12px;padding:14px 18px;font-size:15px;line-height:1.5}.cut{margin-top:12px;border:1px solid #f3d3c7;background:#fff4ef;border-radius:12px;padding:12px 18px;font-size:14.5px;line-height:1.5}
.dec{margin-top:22px}.dec h2{margin-bottom:10px}.dg{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}.dg div{border:1px solid #e5e5ea;border-radius:10px;padding:12px 14px;font-size:13px;line-height:1.45;color:#3a3a3c}.dg b{display:block;color:#1d1d1f;font-size:14px;margin-bottom:4px}
</style></head><body>
<h1>The Nine Checks — Does This Deserve to Be Built?</h1>
<div class="sub">Sprinto Cold Outreach Agent · automated prospect research and first email for Sprinto's Growth Lead · MESA C4 Term 2 · Case 02 · Nawaz Alam</div>
<div class="fp">${FIRST_PRINCIPLES.map((f) => `<div><b>${esc(f.h)}</b>${esc(f.t)}</div>`).join("")}</div>
<div class="grid">${groups}</div>
<div class="verdict"><b>Verdict: ${esc(VERDICT.split(". ")[0])}.</b> ${esc(VERDICT.split(". ").slice(1).join(". "))}</div>
<div class="cut"><b>The Cut (what we deliberately did NOT automate):</b> ${THE_CUT.map(esc).join(" · ")}.</div>
<div class="dec"><h2>Five Pre-Build Decisions</h2><div class="dg">${DECISIONS.map((d) => `<div><b>${esc(d.k)}</b>${esc(d.t)}</div>`).join("")}</div></div>
</body></html>`;
writeFileSync(new URL("../docs/nine-checks.html", import.meta.url), html);
console.log("wrote docs/nine-checks.html");
