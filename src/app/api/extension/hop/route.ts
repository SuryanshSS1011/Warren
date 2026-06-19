import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

/**
 * Bridge between the Warren browser extension and an open map session.
 *
 * SECURITY: writes (POST) require a shared token (`WARREN_EXTENSION_TOKEN`) sent as
 * `Authorization: Bearer <token>` or `?token=`. The body is zod-validated. Without a
 * configured token the write path is DISABLED (503) rather than open to anyone. The GET
 * stream is same-origin (consumed by the app's EventSource) and carries no secrets.
 *
 * NOTE: this uses process-global in-memory state, so it only bridges within a single
 * server instance (fine for local dev / a single node; not for multi-instance serverless).
 */

const HopMessage = z.object({
  type: z.enum(["WIKI_PAGE_LOAD", "WIKI_HOP"]),
  title: z.string().min(1).max(300).optional(),
  from: z.string().min(1).max(300).optional(),
  to: z.string().min(1).max(300).optional(),
  url: z.string().url().max(2000).optional(),
});
type HopMessage = z.infer<typeof HopMessage>;

const listeners = new Set<(data: HopMessage) => void>();

function tokenOk(req: NextRequest): boolean {
  const expected = process.env.WARREN_EXTENSION_TOKEN;
  if (!expected) return false; // not configured → writes disabled
  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  const provided = bearer ?? req.nextUrl.searchParams.get("token");
  return !!provided && provided === expected;
}

export async function POST(req: NextRequest) {
  if (!process.env.WARREN_EXTENSION_TOKEN) {
    return NextResponse.json({ error: "extension bridge not configured" }, { status: 503 });
  }
  if (!tokenOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const parsed = HopMessage.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
  listeners.forEach((fn) => fn(parsed.data));
  return NextResponse.json({ ok: true });
}

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const listener = (data: HopMessage) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          // controller already closed (client disconnected mid-broadcast) — drop the
          // dead listener so a POST's forEach can't throw on a closed stream.
          listeners.delete(listener);
        }
      };
      listeners.add(listener);
      req.signal.addEventListener("abort", () => {
        listeners.delete(listener);
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      });
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
