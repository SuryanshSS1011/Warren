import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateConnectiveTissueAttributed } from "@/lib/ai/connective-tissue";
import { aiErrorResponse } from "@/lib/ai/error-response";
import { checkAiRateLimit } from "@/lib/ai/guard";

const BridgeRequest = z.object({
  from: z.object({ title: z.string().min(1), description: z.string().optional() }),
  to: z.object({ title: z.string().min(1), description: z.string().optional() }),
});

// POST /api/bridge — the AI connective-tissue sentence for a from→to jump.
// Result is cached per (A→B) pair in the lib layer.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = BridgeRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  const limited = await checkAiRateLimit(req, "bridge");
  if (limited) return limited;
  try {
    const { text, attribution } = await generateConnectiveTissueAttributed(parsed.data);
    return NextResponse.json({ bridge: text, attribution });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
