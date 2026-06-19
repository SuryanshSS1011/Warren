import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { WarrenSnapshot } from "@/lib/explore/warren-snapshot";
import { PersistenceUnavailableError, saveWarren } from "@/lib/explore/repository";

const ANON_COOKIE = "warren_anon";

// POST /api/warren — persist the current map; returns { id } for the shareable URL.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = WarrenSnapshot.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid snapshot", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  // Stable anonymous author id (cookie). crypto.randomUUID is available in the runtime.
  const jar = await cookies();
  let anonId = jar.get(ANON_COOKIE)?.value;
  const isNew = !anonId;
  if (!anonId) anonId = crypto.randomUUID();

  try {
    const { id } = await saveWarren(parsed.data, anonId);
    const res = NextResponse.json({ id, url: `/w/${id}` });
    if (isNew) {
      res.cookies.set(ANON_COOKIE, anonId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (err) {
    if (err instanceof PersistenceUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "save failed" },
      { status: 500 },
    );
  }
}

// PUT /api/warren — autosave the active session ("every session is a warren"). Upserts a
// stable row owned by this anon: the first call inserts (returns its id), later calls pass
// that id back to update the same row in place. Body: { id?, snapshot }.
const AutosaveBody = z.object({
  id: z.string().uuid().optional(),
  snapshot: WarrenSnapshot,
});

export async function PUT(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = AutosaveBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid snapshot", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const jar = await cookies();
  let anonId = jar.get(ANON_COOKIE)?.value;
  const isNew = !anonId;
  if (!anonId) anonId = crypto.randomUUID();

  try {
    const { id } = await saveWarren(parsed.data.snapshot, anonId, parsed.data.id);
    const res = NextResponse.json({ id, url: `/w/${id}` });
    if (isNew) {
      res.cookies.set(ANON_COOKIE, anonId, {
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
      });
    }
    return res;
  } catch (err) {
    if (err instanceof PersistenceUnavailableError) {
      return NextResponse.json({ error: err.message }, { status: 503 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "autosave failed" },
      { status: 500 },
    );
  }
}
