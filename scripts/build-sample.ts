// Builds public/sample.json (the example run a first-time visitor sees) from out/*.json.
// Scrubs personal data: masks every email address, drops LinkedIn links and Gmail links.
// Refuses to build if an unmasked email or anything key-shaped survives.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";

const OUT = new URL("../out/", import.meta.url);
const only = process.argv.slice(2);
const files = readdirSync(OUT).filter((f) => f.endsWith(".json") && (!only.length || only.includes(f.replace(/\.json$/, ""))));

const maskEmail = (e: string) => e.replace(/([A-Za-z0-9._%+-])[A-Za-z0-9._%+-]*@([A-Za-z0-9.-]+\.[a-z]{2,})/g, (_m, a, d) => `${a}•••@${d}`);

function scrub(v: unknown): unknown {
  if (typeof v === "string") return maskEmail(v);
  if (Array.isArray(v)) return v.map(scrub);
  if (v && typeof v === "object") {
    const o: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) {
      if (k === "linkedin" || k === "gmailComposeUrl") continue;
      if (k === "to" && typeof val === "string") {
        o[k] = "your inbox";
        continue;
      }
      o[k] = scrub(val);
    }
    return o;
  }
  return v;
}

const accounts = files.map((f) => scrub(JSON.parse(readFileSync(new URL(f, OUT), "utf8"))));
const json = JSON.stringify({ accounts, runs: [{ id: "sample", at: new Date().toISOString(), domains: files.map((f) => f.replace(/\.json$/, "")), ms: 0 }] });

const leakEmail = json.match(/[A-Za-z0-9._%+-]{2,}@[A-Za-z0-9.-]+\.[a-z]{2,}/);
const leakKey = json.match(/AIza[0-9A-Za-z_-]{20,}|AQ\.[0-9A-Za-z_-]{20,}|re_[A-Za-z0-9]{16,}|api_key=|[0-9a-f]{40}/);
if (leakEmail || leakKey) {
  console.error("REFUSING to build sample.json: found", (leakEmail ?? leakKey)![0]);
  process.exit(1);
}
writeFileSync(new URL("../public/sample.json", import.meta.url), json);
console.log(`public/sample.json: ${accounts.length} accounts, ${Math.round(json.length / 1024)} KB, no emails or keys`);
