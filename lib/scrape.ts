// Step 1: single-fetch scraper. Request-based first (cheap), Jina Reader as the
// fallback for JavaScript-only or blocked pages. Respects robots.txt.
// Cleaning rules (L4): drop scripts, nav, footer, cookie banners; dedupe; cap length.

import * as cheerio from "cheerio";
import type { LinkRef, PageDoc } from "./types";

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36 SprintoOutreachResearch/1.0";
const WORD_CAP = 1400; // ~2k tokens per page, the L4 cap
const THIN_PAGE_WORDS = 150; // below this, retry through a real browser (Jina)

export function normalizeDomain(input: string): string {
  let d = input.trim().toLowerCase();
  d = d.replace(/^https?:\/\//, "").replace(/^www\./, "");
  d = d.split(/[/?#\s]/)[0];
  return d;
}

export function rootOf(host: string) {
  const parts = host.replace(/^www\./, "").split(".");
  if (parts.length <= 2) return parts.join(".");
  const sld = parts[parts.length - 2];
  // co.uk, com.au, co.in style
  if (sld.length <= 3 && ["co", "com", "org", "net", "ac", "gov"].includes(sld)) return parts.slice(-3).join(".");
  return parts.slice(-2).join(".");
}

const robotsCache = new Map<string, string[]>();

async function disallowed(url: string): Promise<boolean> {
  try {
    const u = new URL(url);
    let rules = robotsCache.get(u.host);
    if (!rules) {
      rules = [];
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 4000);
      const res = await fetch(`${u.protocol}//${u.host}/robots.txt`, { headers: { "User-Agent": UA }, signal: ctrl.signal }).catch(
        () => null,
      );
      clearTimeout(t);
      if (res && res.ok) {
        const txt = await res.text();
        let applies = false;
        for (const line of txt.split(/\r?\n/)) {
          const l = line.split("#")[0].trim();
          if (!l) continue;
          const [k, ...rest] = l.split(":");
          const v = rest.join(":").trim();
          if (/^user-agent$/i.test(k)) applies = v === "*";
          else if (applies && /^disallow$/i.test(k) && v) rules.push(v);
        }
      }
      robotsCache.set(u.host, rules);
    }
    const path = u.pathname || "/";
    return rules.some((r) => r !== "/" ? path.startsWith(r.replace(/\*.*$/, "")) : false);
  } catch {
    return false;
  }
}

function cleanHtml(html: string, url: string): { text: string; raw: string; title: string; links: LinkRef[] } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim();
  const metaDesc = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content") || "";

  // Raw text for code-side regex checks keeps footer + badge alt text (certifications often live there).
  const badgeAlts = $("img[alt]")
    .map((_, el) => $(el).attr("alt") || "")
    .get()
    .filter((a) => /soc|iso|gdpr|hipaa|aicpa|pci|certif|trust/i.test(a));

  const links: LinkRef[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href") || "";
    try {
      const abs = new URL(href, url);
      if (!/^https?:$/.test(abs.protocol)) return;
      abs.hash = "";
      links.push({ url: abs.toString(), text: $(el).text().replace(/\s+/g, " ").trim().slice(0, 80) });
    } catch {
      /* ignore bad hrefs */
    }
  });

  $("script,style,noscript,svg,iframe,template,canvas,video").remove();
  const rawAll = $("body").text().replace(/\s+/g, " ");
  const raw = `${rawAll} ${badgeAlts.join(" ")} ${links.map((l) => l.url).join(" ")}`;

  // Cleaning for the model
  $("nav,footer,form,dialog,[role=navigation],[role=contentinfo],[aria-hidden=true]").remove();
  $("[id],[class]").each((_, el) => {
    const sig = `${$(el).attr("id") || ""} ${$(el).attr("class") || ""}`.toLowerCase();
    if (/cookie|consent|gdpr-banner|newsletter|popup|modal|announcement-bar|skip-link/.test(sig)) $(el).remove();
  });

  const seen = new Set<string>();
  const lines: string[] = [];
  if (metaDesc) lines.push(metaDesc.trim());
  $("h1,h2,h3,h4,p,li,blockquote,td,dd,figcaption,summary").each((_, el) => {
    const $el = $(el);
    if ($el.find("p,li,h1,h2,h3").length) return; // keep leaf blocks only, avoids duplicates
    const t = $el.text().replace(/\s+/g, " ").trim();
    if (!t) return;
    const isHeading = /^h[1-4]$/i.test(el.tagName);
    const words = t.split(" ").length;
    if (!isHeading && words < 5) return; // drop crumbs and button labels
    const key = t.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    lines.push(isHeading ? `## ${t}` : t);
  });
  let text = lines.join("\n");
  const words = text.split(/\s+/);
  if (words.length > WORD_CAP) text = words.slice(0, WORD_CAP).join(" ") + " …";
  return { text, raw, title, links };
}

async function viaJina(url: string): Promise<{ text: string; ok: boolean; error?: string }> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 20_000);
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: { Accept: "text/plain", "X-Return-Format": "text", "X-Remove-Selector": "nav, footer, header .menu" },
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (!res.ok) return { text: "", ok: false, error: `Jina HTTP ${res.status}` };
    let text = await res.text();
    const seen = new Set<string>();
    text = text
      .split(/\n+/)
      .map((l) => l.trim())
      .filter((l) => l.split(" ").length >= 5 || /^#/.test(l))
      .filter((l) => (seen.has(l) ? false : (seen.add(l), true)))
      .join("\n");
    const words = text.split(/\s+/);
    if (words.length > WORD_CAP) text = words.slice(0, WORD_CAP).join(" ") + " …";
    return { text, ok: text.split(/\s+/).length > 30 };
  } catch (e) {
    return { text: "", ok: false, error: `Jina: ${(e as Error).message}` };
  }
}

export type FetchResult = PageDoc & { links: LinkRef[]; title: string; finalUrl: string; hash: string };

const MAX_BYTES = 3_000_000;

export function textHash(t: string) {
  let h = 0;
  const s = t.slice(0, 4000);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h);
}

// Typed outcomes: a blocked or unreadable page is UNKNOWN, never evidence of absence.
export async function fetchPage(url: string, kind: string, homeHash?: string): Promise<FetchResult> {
  const t0 = Date.now();
  const base: FetchResult = { url, kind, ok: false, outcome: "ERROR", via: "fetch", words: 0, text: "", links: [], title: "", finalUrl: url, hash: "" };
  const done = (r: Partial<FetchResult>): FetchResult => ({ ...base, ...r, ms: Date.now() - t0 });
  if (await disallowed(url)) return done({ outcome: "ROBOTS", error: "robots.txt asks bots not to read this page: skipped" });

  let html = "";
  let status = 0;
  let finalUrl = url;
  let outcome: FetchResult["outcome"] = "OK";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8", "Accept-Language": "en-US,en;q=0.9" },
      redirect: "follow",
      signal: ctrl.signal,
    });
    clearTimeout(t);
    status = res.status;
    finalUrl = res.url || url;
    const ct = res.headers.get("content-type") || "";
    const len = Number(res.headers.get("content-length") || 0);
    if (status === 404 || status === 410) return done({ finalUrl, outcome: "NOT_FOUND", error: `HTTP ${status}` });
    if (status === 401 || status === 403 || status === 429 || status === 503) outcome = "BLOCKED";
    else if (!res.ok) outcome = "ERROR";
    else if (!/html|text\/plain/.test(ct)) return done({ finalUrl, outcome: "NON_HTML", error: ct || "unknown type" });
    else if (len > MAX_BYTES) return done({ finalUrl, outcome: "TOO_BIG", error: `${len} bytes` });
    else {
      html = await res.text();
      if (html.length > MAX_BYTES) return done({ finalUrl, outcome: "TOO_BIG", error: `${html.length} chars` });
      if (/cf-chl|challenge-platform|captcha|Just a moment\.\.\./i.test(html.slice(0, 20000)) && html.length < 60000) outcome = "BLOCKED";
    }
  } catch (e) {
    const msg = (e as Error).message || "";
    outcome = /abort/i.test(msg) ? "TIMEOUT" : "ERROR";
    base.error = msg;
  }

  let cleaned = html && outcome === "OK" ? cleanHtml(html, finalUrl) : { text: "", raw: "", title: "", links: [] as LinkRef[] };
  let words = cleaned.text ? cleaned.text.split(/\s+/).length : 0;
  let via: PageDoc["via"] = "fetch";
  if (outcome === "OK" && words < THIN_PAGE_WORDS) outcome = "EMPTY_SHELL";

  if (outcome !== "OK") {
    // Text only appears after JavaScript runs, or we were blocked: let a real browser render it (Jina Reader).
    const j = await viaJina(finalUrl);
    if (j.ok && j.text.split(/\s+/).length > Math.max(words, 30)) {
      cleaned = { ...cleaned, text: j.text, raw: `${cleaned.raw} ${j.text}` };
      words = j.text.split(/\s+/).length;
      via = "jina";
      outcome = "OK";
    } else if (outcome === "EMPTY_SHELL" && words > 30) {
      outcome = "OK"; // short but real page
    }
  }
  const hash = textHash(cleaned.text);
  if (outcome === "OK" && homeHash && kind !== "home" && hash === homeHash) {
    return done({ finalUrl, outcome: "NOT_FOUND", error: "soft 404: same content as the homepage" });
  }
  const ok = outcome === "OK" && words > 30;
  return done({
    finalUrl,
    kind,
    ok,
    outcome: ok ? "OK" : outcome === "OK" ? "EMPTY_SHELL" : outcome,
    via,
    words,
    text: cleaned.text,
    raw: cleaned.raw,
    title: cleaned.title,
    links: cleaned.links,
    hash,
    error: ok ? undefined : base.error || `${outcome}${status ? ` (HTTP ${status})` : ""}`,
  });
}

// Classify discovered links so the loop fetches the page most likely to answer a missing field.
const KIND_PATTERNS: Record<string, RegExp> = {
  security: /\/(security|trust|trust-center|trustcenter|compliance|soc-?2|iso-?27001)(\/|$|\?)|^https?:\/\/(trust|security)\./i,
  careers: /\/(careers?|jobs|join(-us)?|work-with-us|hiring|open-positions)(\/|$|\?)|greenhouse\.io|lever\.co|ashbyhq\.com|workable\.com|wellfound\.com|breezy\.hr|recruitee\.com|keka\.com\/careers|zohorecruit/i,
  pricing: /\/(pricing|plans|enterprise)(\/|$|\?)/i,
  customers: /\/(customers?|case-studies|case-study|success-stories|testimonials)(\/|$|\?)/i,
  about: /\/(about|about-us|company|team|our-story)(\/|$|\?)/i,
  product: /\/(product|platform|features|solutions)(\/|$|\?)/i,
};

export function classifyLinks(links: LinkRef[], domain: string): Record<string, string[]> {
  const root = rootOf(domain);
  const out: Record<string, string[]> = {};
  for (const l of links) {
    let host = "";
    try {
      host = new URL(l.url).host;
    } catch {
      continue;
    }
    const internal = host.endsWith(root);
    for (const [kind, re] of Object.entries(KIND_PATTERNS)) {
      if (!re.test(l.url)) continue;
      if (!internal && kind !== "careers" && kind !== "security") continue;
      if (/\/(blog|docs|help|support)\//i.test(l.url) && kind !== "careers") continue;
      (out[kind] ??= []);
      const clean = l.url.replace(/[?#].*$/, "").replace(/\/$/, "");
      if (!out[kind].includes(clean)) out[kind].push(clean);
    }
  }
  // shortest URL first = usually the index page
  for (const k of Object.keys(out)) out[k].sort((a, b) => a.length - b.length);
  return out;
}

export function guessUrls(domain: string, kind: string): string[] {
  const b = `https://${domain}`;
  switch (kind) {
    case "security":
      return [`${b}/security`, `${b}/trust`, `https://trust.${rootOf(domain)}`];
    case "careers":
      return [`${b}/careers`, `${b}/jobs`];
    case "pricing":
      return [`${b}/pricing`];
    case "customers":
      return [`${b}/customers`];
    case "about":
      return [`${b}/about`, `${b}/company`];
    case "product":
      return [`${b}/product`];
    default:
      return [];
  }
}

// ATS public job-board APIs (official structured channel beats scraping a careers page).
export async function fetchAtsJobs(
  careersLinks: string[],
  domain: string,
): Promise<{ provider: string; url: string; titles: string[] } | null> {
  const hits: { provider: string; slug: string }[] = [];
  for (const u of careersLinks) {
    let m = u.match(/greenhouse\.io\/(?:embed\/job_board\?for=)?([a-z0-9_-]+)/i);
    if (m) hits.push({ provider: "greenhouse", slug: m[1] });
    m = u.match(/jobs\.lever\.co\/([a-z0-9_-]+)/i);
    if (m) hits.push({ provider: "lever", slug: m[1] });
    m = u.match(/jobs\.ashbyhq\.com\/([a-z0-9_.-]+)/i);
    if (m) hits.push({ provider: "ashby", slug: m[1] });
  }
  // Only use a board the company itself links to: guessing a slug can return another company's jobs.
  void domain;
  if (!hits.length) return null;

  for (const h of hits.slice(0, 4)) {
    try {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), 6000);
      let api = "";
      if (h.provider === "greenhouse") api = `https://boards-api.greenhouse.io/v1/boards/${h.slug}/jobs`;
      if (h.provider === "lever") api = `https://api.lever.co/v0/postings/${h.slug}?mode=json`;
      if (h.provider === "ashby") api = `https://api.ashbyhq.com/posting-api/job-board/${h.slug}`;
      const res = await fetch(api, { signal: ctrl.signal, headers: { "User-Agent": UA } });
      clearTimeout(t);
      if (!res.ok) continue;
      const data = await res.json();
      let titles: string[] = [];
      if (h.provider === "greenhouse") titles = (data.jobs ?? []).map((j: { title: string }) => j.title);
      if (h.provider === "lever") titles = (Array.isArray(data) ? data : []).map((j: { text: string }) => j.text);
      if (h.provider === "ashby") titles = (data.jobs ?? []).map((j: { title: string }) => j.title);
      if (titles.length) return { provider: h.provider, url: api, titles };
    } catch {
      /* try next */
    }
  }
  return null;
}
