import { NextResponse, type NextRequest } from "next/server";

// We'll use a simple in-memory global to store the latest hop
// (Note: this reset every time the dev server reloads)
let latestHop: any = null;
const listeners = new Set<(data: any) => void>();

export async function POST(req: NextRequest) {
  const body = await req.json();
  latestHop = body;

  // Notify any active map sessions
  listeners.forEach(fn => fn(body));

  return NextResponse.json({ success: true });
}

// GET /api/extension/hop implements a simple long-polling or EventStream-like check
export async function GET(req: NextRequest) {
  const stream = new ReadableStream({
    start(controller) {
      const listener = (data: any) => {
        controller.enqueue(`data: ${JSON.stringify(data)}\n\n`);
      };
      listeners.add(listener);

      req.signal.addEventListener("abort", () => {
        listeners.delete(listener);
      });
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    }
  });
}
