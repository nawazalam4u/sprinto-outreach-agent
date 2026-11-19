// Builds docs/nine-checks.html from lib/brief.ts (same content as the /brief page), in the app's design language.
import { writeFileSync } from "node:fs";
import { CHECK_GROUPS, DECISIONS, FIRST_PRINCIPLES, THE_CUT, VERDICT } from "../lib/brief";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const TILE = ["#ffd581", "#c9ecd9", "#d8cff8", "#fbd0c2", "#cfe5f9"];

const groups = CHECK_GROUPS.map(
  (g) => `<div class="col" style="background:${g.color}"><h2>${esc(g.title)}</h2><p class="rule">${esc(g.rule)}</p>${g.checks
    .map(
      (c) => `<div class="card"><div class="ch"><span class="n">${c.n}</span><b>${esc(c.q)}</b><span class="badge ${c.tone}">${esc(c.badge)}</span></div><p>${esc(c.text)}</p>${
        c.human ? `<div class="human">Human here: ${esc(c.human)}</div>` : ""
      }</div>`,
    )
    .join("")}</div>`,
).join("");

const html = `<!doctype html><html><head><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Instrument+Serif:ital@1&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@700&display=swap" rel="stylesheet">
<style>
*{box-sizing:border-box}body{margin:0;width:1500px;background:#faf6ee;font-family:Inter,system-ui,sans-serif;color:#1d1b33}
.head{background:#17153b;color:#f6f1e6;padding:34px 44px 30px;border-radius:0 0 30px 30px;position:relative;overflow:hidden}
.head:after{content:"";position:absolute;right:-60px;top:-120px;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(246,181,69,.32),transparent 70%)}
.eyebrow{display:inline-block;font:700 12px 'JetBrains Mono',monospace;letter-spacing:.08em;color:#f6b545;background:rgba(246,181,69,.14);padding:5px 11px;border-radius:999px}
h1{font-family:'Bricolage Grotesque',sans-serif;font-size:46px;letter-spacing:-.03em;margin:14px 0 6px;font-weight:800}
h1 em{font-family:'Instrument Serif',serif;font-weight:400;color:#ffd581;letter-spacing:0}
.sub{color:rgba(246,241,230,.72);font-size:16px}
.body{padding:24px 44px 36px}
.fp{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
.fp div{border-radius:16px;padding:12px 14px;font-size:14px;line-height:1.45}
.fp b{display:block;font:700 11px 'JetBrains Mono',monospace;letter-spacing:.08em;opacity:.7;margin-bottom:4px;text-transform:uppercase}
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start}
.col{border-radius:24px;padding:16px}
h2{font-family:'Bricolage Grotesque',sans-serif;font-size:24px;margin:0;font-weight:800;letter-spacing:-.02em}
.rule{margin:2px 0 12px;font-weight:600;color:#48455f;font-size:14px}
.card{background:#fffdf8;border-radius:16px;padding:13px 15px;margin-bottom:10px}
.ch{display:flex;align-items:center;gap:8px}.n{color:#ee7656;font:700 15px 'JetBrains Mono',monospace}.ch b{font-family:'Bricolage Grotesque',sans-serif;font-size:18px;flex:1;font-weight:800}
.badge{font-size:12px;font-weight:700;padding:3px 10px;border-radius:999px;white-space:nowrap}.badge.yes{background:#d8f0e3;color:#1d7f53}.badge.qual{background:#fbe8bf;color:#8c5b00}
.card p{margin:7px 0 0;font-size:14.5px;line-height:1.5;color:#48455f}
.human{margin-top:9px;font-size:13.5px;font-weight:700;color:#5b40b8}
.row2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:16px}
.verdict{background:#d8f0e3;color:#14583a;border-radius:18px;padding:14px 18px;font-size:15px;line-height:1.5}
.cut{background:#fbded1;color:#8f3315;border-radius:18px;padding:14px 18px;font-size:15px;line-height:1.5}
.dec{margin-top:20px}.dec h2{margin-bottom:10px}
.dg{display:grid;grid-template-columns:repeat(5,1fr);gap:12px}
.dg div{border-radius:18px;padding:13px 14px;font-size:13.5px;line-height:1.45;color:#2b2945}
.dg b{display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:17px;margin:2px 0 4px;color:#1d1b33}
.dg i{font:700 11px 'JetBrains Mono',monospace;font-style:normal;opacity:.6}
</style></head><body>
<div class="head"><span class="eyebrow">MESA C4 · TERM 2 · CASE 02 · NAWAZ ALAM</span>
<h1>The Nine Checks: does this <em>deserve</em> to be built?</h1>
<div class="sub">Sprinto Prospect Quest · automated prospect research and first email for Sprinto's Growth Lead · numbers measured on the live build</div></div>
<div class="body">
<div class="fp">${FIRST_PRINCIPLES.map((f, i) => `<div style="background:${TILE[i]}"><b>${esc(f.h)}</b>${esc(f.t)}</div>`).join("")}</div>
<div class="grid">${groups}</div>
<div class="row2"><div class="verdict"><b>Verdict: ${esc(VERDICT.split(". ")[0])}.</b> ${esc(VERDICT.split(". ").slice(1).join(". "))}</div>
<div class="cut"><b>The Cut, deliberately not automated:</b> ${THE_CUT.map(esc).join(" · ")}.</div></div>
<div class="dec"><h2>Five pre-build decisions</h2><div class="dg">${DECISIONS.map((d, i) => `<div style="background:${TILE[i]}"><i>0${i + 1}</i><b>${esc(d.k)}</b>${esc(d.t)}</div>`).join("")}</div></div>
</div></body></html>`;
writeFileSync(new URL("../docs/nine-checks.html", import.meta.url), html);
console.log("wrote docs/nine-checks.html");
