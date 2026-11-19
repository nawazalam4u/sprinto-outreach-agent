// Gemini client. New keys use the Interactions API (POST /v1beta/interactions) with the
// Gemini 3.x models; older keys fall back to generateContent. JSON output, optional Google
// Search grounding, pacing between calls (free tier), retries with back-off, token accounting.

const BASE = "https://generativelanguage.googleapis.com/v1beta";

export type Usage = { calls: number; inTokens: number; outTokens: number; usd: number };
export const newUsage = (): Usage => ({ calls: 0, inTokens: 0, outTokens: 0, usd: 0 });

// Flash-class list price, USD per million tokens (approximate, for the cost read-out)
const PRICE_IN = 0.3;
const PRICE_OUT = 2.5;

function models(): string[] {
  const env = process.env.GEMINI_MODEL?.trim();
  return [...new Set([env, "gemini-3.8-flash", "gemini-flash-lite-latest", "gemini-3.5-flash", "gemini-3.1-flash-lite"].filter(Boolean) as string[])];
}

export class GeminiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
  }
}

export function geminiConfigured() {
  return Boolean(process.env.GEMINI_API_KEY?.trim());
}
export function geminiModel() {
  return models()[0];
}

type Opts = {
  system?: string;
  prompt: string;
  json?: boolean;
  search?: boolean;
  temperature?: number;
  usage?: Usage;
};

export type GeminiOut = { text: string; sources: { title: string; uri: string }[]; model: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Pacing: free-tier keys allow only a few requests a minute. Space calls out.
let nextSlot = 0;
async function pace() {
  const gap = Number(process.env.GEMINI_MIN_INTERVAL_MS ?? 1200);
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + gap;
  if (wait) await sleep(wait);
}

function collectSources(node: unknown, out: { title: string; uri: string }[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectSources(n, out);
    return;
  }
  const o = node as Record<string, unknown>;
  const uri = (o.url ?? o.uri) as string | undefined;
  if (typeof uri === "string" && /^https?:\/\//.test(uri) && !out.some((s) => s.uri === uri)) {
    out.push({ title: String(o.title ?? o.domain ?? ""), uri });
  }
  for (const [k, v] of Object.entries(o)) if (k !== "signature") collectSources(v, out);
}

let mode: "interactions" | "generate" | null = null;
let workingModel: string | null = null;

async function viaInteractions(model: string, key: string, opts: Opts, signal: AbortSignal) {
  const body: Record<string, unknown> = {
    model,
    store: false,
    input: opts.json && !opts.search ? `${opts.prompt}\n\nReturn ONLY valid JSON. No prose, no code fences.` : opts.prompt,
    generation_config: { temperature: opts.temperature ?? 0.2, thinking_level: "low" },
  };
  if (opts.system) body.system_instruction = opts.system;
  if (opts.search) body.tools = [{ type: "google_search" }];
  const res = await fetch(`${BASE}/interactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data?.error) {
    const code = data?.error?.code ?? "";
    const status = res.status !== 200 ? res.status : code === "too_many_requests" ? 429 : code === "service_unavailable" ? 503 : 400;
    throw new GeminiError(`${model}: ${data?.error?.message ?? `HTTP ${res.status}`}`, status);
  }
  const steps: Record<string, unknown>[] = data.steps ?? [];
  const outputs = steps.filter((s) => s.type === "model_output");
  const text = outputs
    .flatMap((s) => ((s.content as { type: string; text?: string }[]) ?? []).filter((c) => c.type === "text").map((c) => c.text ?? ""))
    .join("");
  const sources: { title: string; uri: string }[] = [];
  collectSources(steps.filter((s) => s.type !== "thought"), sources);
  const u = data.usage ?? {};
  return { text, sources, inTok: u.total_input_tokens ?? 0, outTok: (u.total_output_tokens ?? 0) + (u.total_thought_tokens ?? 0) + (u.total_tool_use_tokens ?? 0) };
}

async function viaGenerate(model: string, key: string, opts: Opts, signal: AbortSignal) {
  const body: Record<string, unknown> = {
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: { temperature: opts.temperature ?? 0.2, ...(opts.json && !opts.search ? { responseMimeType: "application/json" } : {}) },
  };
  if (opts.system) body.systemInstruction = { parts: [{ text: opts.system }] };
  if (opts.search) body.tools = [{ google_search: {} }];
  const res = await fetch(`${BASE}/models/${model}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify(body),
    signal,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new GeminiError(`${model}: ${data?.error?.message ?? `HTTP ${res.status}`}`, res.status);
  const cand = data?.candidates?.[0];
  const text: string = (cand?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? "").join("");
  const sources = (cand?.groundingMetadata?.groundingChunks ?? [])
    .map((c: { web?: { title?: string; uri?: string } }) => ({ title: c.web?.title ?? "", uri: c.web?.uri ?? "" }))
    .filter((s: { uri: string }) => s.uri);
  const u = data?.usageMetadata ?? {};
  return { text, sources, inTok: u.promptTokenCount ?? 0, outTok: (u.candidatesTokenCount ?? 0) + (u.thoughtsTokenCount ?? 0) };
}

export async function gemini(opts: Opts): Promise<GeminiOut> {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) throw new GeminiError("GEMINI_API_KEY is not set");
  const list = workingModel ? [workingModel, ...models().filter((m) => m !== workingModel)] : models();
  const modes: ("interactions" | "generate")[] = mode ? [mode] : ["interactions", "generate"];
  let lastErr: GeminiError | null = null;

  for (const m of modes) {
    for (const model of list) {
      for (let attempt = 0; attempt < 5; attempt++) {
        await pace();
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), opts.search ? 60_000 : 45_000);
        try {
          const r = m === "interactions" ? await viaInteractions(model, key, opts, ctrl.signal) : await viaGenerate(model, key, opts, ctrl.signal);
          if (opts.usage) {
            opts.usage.calls += 1;
            opts.usage.inTokens += r.inTok;
            opts.usage.outTokens += r.outTok;
            opts.usage.usd = (opts.usage.inTokens * PRICE_IN + opts.usage.outTokens * PRICE_OUT) / 1e6;
          }
          if (!r.text) {
            lastErr = new GeminiError(`${model}: empty response`);
            continue;
          }
          mode = m;
          workingModel = model;
          return { text: r.text, sources: r.sources, model };
        } catch (e) {
          const err = e instanceof GeminiError ? e : new GeminiError(String((e as Error)?.message ?? e));
          lastErr = err;
          if (err.status === 401 || err.status === 403) throw err; // bad key
          if (err.status === 404) break; // model or endpoint not available: next model
          if (err.status === 503 || !err.status) break; // overloaded or timed out: next model now
          if (/quota/i.test(err.message) && opts.search) throw err; // search quota: caller falls back
          if (err.status === 429 || err.status === 500) {
            if (attempt >= 2) break;
            await sleep(4000 * (attempt + 1));
            continue;
          }
          break; // other 4xx: try the next model
        } finally {
          clearTimeout(timer);
        }
      }
    }
  }
  throw lastErr ?? new GeminiError("Gemini call failed");
}

// Tolerant JSON parse: handles ```json fences and leading prose.
export function parseJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const src = (fenced ? fenced[1] : text).trim();
  try {
    return JSON.parse(src) as T;
  } catch {
    const start = src.search(/[[{]/);
    const end = Math.max(src.lastIndexOf("}"), src.lastIndexOf("]"));
    if (start >= 0 && end > start) return JSON.parse(src.slice(start, end + 1)) as T;
    throw new GeminiError("Model did not return valid JSON");
  }
}

export async function geminiJson<T>(opts: Opts): Promise<{ data: T; sources: GeminiOut["sources"] }> {
  const out = await gemini({ ...opts, json: true });
  try {
    return { data: parseJson<T>(out.text), sources: out.sources };
  } catch {
    const again = await gemini({ ...opts, json: true, prompt: `${opts.prompt}\n\nIMPORTANT: your previous answer was not valid JSON. Return ONLY valid JSON.` });
    return { data: parseJson<T>(again.text), sources: again.sources };
  }
}
