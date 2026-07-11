// This Next version renames "middleware" → "proxy" (see node_modules/next/dist/docs
// .../16-proxy.md): the file is `proxy.ts` and the export is `proxy`. Its job here is to
// refresh the Supabase auth session on navigation so signed-in users stay signed in.
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on pages, skip static assets, image optimizer, favicon, and OG images.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
