import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { generateAutoTitleAttributed } from "@/lib/ai/auto-title";
import { aiErrorResponse } from "@/lib/ai/error-response";

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
    const { text, attribution } = await generateAutoTitleAttributed(parsed.data.path);
    return NextResponse.json({ title: text, attribution });
  } catch (err) {
    return aiErrorResponse(err);
  }
}
