// Live run from the terminal: npx vite-node scripts/live.ts domain1 domain2 …
// Loads .env.local itself (never prints it) and writes results to out/<domain>.json
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^"|"$/g, "");
}
const { runPipeline } = await import("../lib/pipeline");
mkdirSync(new URL("../out/", import.meta.url), { recursive: true });
const auto = process.env.AUTO_SEND === "1";
for (const d of process.argv.slice(2)) {
  const t0 = Date.now();
  const r = await runPipeline({ domain: d, autoSend: auto }, (e) => {
    if (e.type === "step") console.log(`[${d}] ${e.step} ${e.status} ${e.detail ?? ""}`);
    else if (e.type === "log" && e.message) console.log(`[${d}]    ${e.message}`);
    else if (e.type === "fatal") console.log(`[${d}] FATAL ${e.error}`);
  });
  writeFileSync(new URL(`../out/${r.domain}.json`, import.meta.url), JSON.stringify(r, null, 2));
  console.log(`[${d}] => ${r.state.verdict} ${r.state.score_low}-${r.state.score_high} status=${r.state.status} ${Math.round((Date.now() - t0) / 1000)}s calls=${r.usage.calls}`);
  if (r.draft) console.log(`--- ${r.draft.subject}\n${r.draft.body}\n---`);
}
