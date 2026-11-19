import { geminiConfigured, geminiModel } from "@/lib/gemini";
import { hunterConfigured } from "@/lib/poc";
import { mask, resendConfigured, senderName, toEmail } from "@/lib/send";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    gemini: geminiConfigured(),
    model: geminiModel(),
    hunter: hunterConfigured(),
    email: resendConfigured(),
    recipient: toEmail() ? mask(toEmail()) : null,
    sender: senderName(),
  });
}
