import { geminiConfigured } from "@/lib/gemini";
import { runPipeline } from "@/lib/pipeline";
import { allow, clientKey } from "@/lib/ratelimit";
import type { ManualPoc, RunEvent, StyleExample } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    domain?: string;
    autoSend?: boolean;
    manualPoc?: ManualPoc | null;
    style?: StyleExample[];
  };
  const domain = (body.domain ?? "").trim();
  if (!domain || !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain.replace(/^https?:\/\//, "").replace(/^www\./, "").split("/")[0])) {
    return Response.json({ error: "Give a valid domain like acme.com" }, { status: 400 });
  }
  if (!geminiConfigured()) return Response.json({ error: "GEMINI_API_KEY is not set on the server" }, { status: 500 });
  if (!allow(clientKey(req), 40, 60 * 60 * 1000)) {
    return Response.json({ error: "Rate limit: 40 companies per hour per visitor. Try again later." }, { status: 429 });
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: RunEvent) => {
        try {
          controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
        } catch {
          /* client went away */
        }
      };
      const ping = setInterval(() => send({ type: "log", step: 1, message: "" }), 15000);
      try {
        const result = await runPipeline(
          { domain, autoSend: Boolean(body.autoSend), manualPoc: body.manualPoc ?? null, style: (body.style ?? []).slice(-3) },
          send,
        );
        send({ type: "result", result });
      } catch (e) {
        send({ type: "fatal", error: (e as Error).message });
      } finally {
        clearInterval(ping);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" },
  });
}
