// Step 7: send through Resend. sendEmail() has NO recipient parameter: the To: address is
// always TO_EMAIL (case rule: hard-code your own inbox). The prospect is named in the body only.

import type { Contact, SendResult } from "./types";

export function toEmail() {
  return (process.env.TO_EMAIL || process.env.MY_EMAIL || "").trim();
}

export function resendConfigured() {
  return Boolean(process.env.RESEND_API_KEY?.trim() && toEmail());
}

export function senderName() {
  return process.env.SENDER_NAME?.trim() || "Nawaz from Sprinto";
}

export function mask(email: string) {
  const [u, d] = email.split("@");
  if (!d) return "not set";
  return `${u.slice(0, 2)}${"•".repeat(Math.max(2, u.length - 2))}@${d}`;
}

export function gmailComposeUrl(subject: string, body: string) {
  const q = new URLSearchParams({ view: "cm", fs: "1", su: subject, body });
  const to = toEmail();
  if (to) q.set("to", to);
  return `https://mail.google.com/mail/?${q.toString()}`;
}

// Never echo a key back in an error message.
export function scrub(msg: string) {
  return msg
    .replace(/re_[A-Za-z0-9_]{8,}/g, "re_•••")
    .replace(/AIza[0-9A-Za-z_-]{20,}/g, "AIza•••")
    .replace(/AQ\.[0-9A-Za-z_-]{20,}/g, "AQ.•••")
    .replace(/api_key=[^&\s]+/g, "api_key=•••");
}

export function footerFor(poc: Contact | null, company: string) {
  return poc
    ? `\n\n—\nIntended recipient: ${poc.name}, ${poc.title} at ${company} (${poc.email_status === "pattern_guess" ? "email not verified" : poc.email_status}). Sent to your own inbox by the Sprinto Outreach Agent.`
    : "";
}

export async function sendEmail(subject: string, body: string, poc: Contact | null, company: string): Promise<SendResult> {
  const to = toEmail();
  if (!resendConfigured()) {
    return { status: "not_configured", to: to ? mask(to) : undefined, gmailComposeUrl: gmailComposeUrl(subject, body), reason: "RESEND_API_KEY or TO_EMAIL not set" };
  }
  try {
    const from = process.env.FROM_EMAIL?.trim() || "onboarding@resend.dev";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY!.trim()}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${senderName()} <${from}>`,
        to: [to], // hard-coded: never the prospect
        subject,
        text: body + footerFor(poc, company),
        tags: [{ name: "app", value: "sprinto_outreach" }],
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { status: "failed", to: mask(to), error: scrub(data?.message || `Resend HTTP ${res.status}`), gmailComposeUrl: gmailComposeUrl(subject, body) };
    return { status: "sent", to: mask(to), messageId: data?.id, at: new Date().toISOString() };
  } catch (e) {
    return { status: "failed", to: mask(to), error: scrub((e as Error).message), gmailComposeUrl: gmailComposeUrl(subject, body) };
  }
}
