import { NextResponse, type NextRequest } from "next/server";
import { getCitations } from "@/lib/wikipedia/client";
import { can } from "@/lib/billing/entitlements";

// GET /api/wiki/citations?title=Black%20hole — the article's citation/sourcing report
// (references + weak-source and unsourced-claim signals). Researcher-tier feature.
export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title");
  if (!title) return NextResponse.json({ error: "missing title" }, { status: 400 });

  if (!(await can("citation_explorer"))) {
    return NextResponse.json({ error: "The citation explorer is a Researcher feature." }, { status: 402 });
  }

  try {
    const report = await getCitations(title);
    if (!report) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(report, {
      headers: { "Cache-Control": "private, max-age=3600" },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "upstream error" },
      { status: 502 },
    );
  }
}
