import { describe, expect, it, vi } from "vitest";

describe("gemini circuit breaker", () => {
  it("benches an overloaded model and goes straight to a healthy one next time", async () => {
    process.env.GEMINI_API_KEY = "test-key";
    process.env.GEMINI_MIN_INTERVAL_MS = "0";
    const { gemini } = await import("@/lib/gemini");
    const calls: string[] = [];
    const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
      const model = JSON.parse(String((init as RequestInit).body)).model as string;
      calls.push(model);
      if (model === "gemini-3.8-flash")
        return new Response(JSON.stringify({ error: { code: "service_unavailable", message: "high demand" } }), { status: 503 });
      return new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "text", text: '{"ok":true}' }] }], usage: {} }), { status: 200 });
    });
    const a = await gemini({ prompt: "hi" });
    expect(a.model).toBe("gemini-flash-lite-latest");
    calls.length = 0;
    const b = await gemini({ prompt: "again" });
    expect(b.model).toBe("gemini-flash-lite-latest");
    expect(calls).not.toContain("gemini-3.8-flash"); // benched: not retried
    spy.mockRestore();
  });
});
