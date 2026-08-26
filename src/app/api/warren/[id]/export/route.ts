import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { getUser } from "@/lib/supabase/auth";
import { loadWarren } from "@/lib/explore/repository";
import { can } from "@/lib/billing/entitlements";
import { EXPORT_META, exportFilename, type ExportFormat } from "@/lib/explore/export";

const ANON_COOKIE = "warren_anon";

function isFormat(v: string | null): v is ExportFormat {
  return v === "markdown" || v === "anki";
}

// GET /api/warren/[id]/export?format=markdown|anki — download a warren as Markdown (Obsidian)
// or Anki CSV. Pro-gated (entitlement "export"), and only the owner may export a warren
// (public or private). Serialization is pure; this layer does auth + entitlement + download.
export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const format = req.nextUrl.searchParams.get("format");
  if (!isFormat(format)) {
    return NextResponse.json({ error: "format must be markdown or anki" }, { status: 400 });
  }

  // Export is a Pro feature.
  if (!(await can("export"))) {
    return NextResponse.json({ error: "Export is a Pro feature." }, { status: 402 });
  }

  // Owner-only: load with the viewer so private warrens resolve for their owner.
  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  const user = await getUser();
  const warren = await loadWarren(id, { anonId, userId: user?.id });
  if (!warren || !warren.isOwner) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const meta = EXPORT_META[format];
  const body = meta.serialize(warren);
  return new NextResponse(body, {
    headers: {
      "Content-Type": meta.contentType,
      "Content-Disposition": `attachment; filename="${exportFilename(warren.title, format)}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
