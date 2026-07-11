import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { PersistenceUnavailableError, setWarrenVisibility } from "@/lib/explore/repository";

const ANON_COOKIE = "warren_anon";

const Body = z.object({ isPublic: z.boolean() });

// POST /api/warren/[id]/publish — publish or unpublish a warren. Only the owning anon
// (matched by the warren_anon cookie) can change visibility. Warrens are private by
// default (PRODUCT_PLAN §1.5); this is the explicit opt-in publish action.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = Body.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  if (!anonId) {
    return NextResponse.json({ error: "no session" }, { status: 401 });
  }

  try {
    const { ok } = await setWarrenVisibility(id, anonId, parsed.data.isPublic);
    // ok is false when the warren doesn't exist or isn't owned by this anon.
    if (!ok) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ id, isPublic: parsed.data.isPublic });
  } catch (err) {
    if (err instanceof PersistenceUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "publish failed" },
      { status: 500 },
    );
  }
}
