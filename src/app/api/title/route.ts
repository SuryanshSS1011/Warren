import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateAutoTitle } from "@/lib/ai/auto-title";

const TitleRequest = z.object({
  path: z.array(z.string().min(1)).min(1),
});

// POST /api/title — a witty AI auto-title for a journey (ordered node titles).
// Cached per first→last pair in the lib layer.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = TitleRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  try {
    const title = await generateAutoTitle(parsed.data.path);
    return NextResponse.json({ title });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "ai error" },
      { status: 502 },
    );
  }
}
