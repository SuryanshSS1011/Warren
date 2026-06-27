import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generatePathNarrative } from "@/lib/ai/narrative";
import { aiErrorResponse } from "@/lib/ai/error-response";

const NarrativeRequest = z.object({
  path: z.array(z.string().min(1)).min(1).max(40),
});

// POST /api/narrative — a semantic narrative tracing the path to the selected node.
// Cached per full path in the lib layer.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = NarrativeRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  try {
    const narrative = await generatePathNarrative(parsed.data.path);
    return NextResponse.json(
      { narrative },
      { headers: { "Cache-Control": "private, max-age=3600" } },
    );
  } catch (err) {
    return aiErrorResponse(err);
  }
}
