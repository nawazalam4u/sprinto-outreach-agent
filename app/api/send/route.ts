import { allow, clientKey } from "@/lib/ratelimit";
import { sendEmail } from "@/lib/send";
import type { Contact } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as { subject?: string; body?: string; poc?: Contact | null; company?: string };
  if (!b.subject?.trim() || !b.body?.trim()) return Response.json({ error: "Subject and body are required" }, { status: 400 });
  if (b.subject.length > 200 || b.body.length > 5000) return Response.json({ error: "Email too long" }, { status: 400 });
  if (!allow(`send:${clientKey(req)}`, 20, 60 * 60 * 1000)) return Response.json({ error: "Send limit reached, try later" }, { status: 429 });
  const r = await sendEmail(b.subject.trim(), b.body.trim(), b.poc ?? null, b.company ?? "");
  return Response.json(r);
}
