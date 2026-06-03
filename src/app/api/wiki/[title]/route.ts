import { NextRequest, NextResponse } from "next/server";
import { getPageSummary, getArticleLinks } from "@/lib/wikipedia/client";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ title: string }> }
) {
  

  const { title: rawTitle } = await params;
    let title: string;
    try {
    title = decodeURIComponent(rawTitle);
    } catch {
        return NextResponse.json({ error: "Invalid title" }, { status: 400 });
    }

  try {
    
    

    const [summary, links] = await Promise.all([
        getPageSummary(title),
        getArticleLinks(title),   // ← add
    ]);

    

    // Article not found
    if (!summary) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    // Disambiguation page — frontend needs to show a chooser
    if (summary.type === "disambiguation") {
      return NextResponse.json({
        type: "disambiguation",
        title: summary.title,
        extract: summary.extract,
        suggestions: links.slice(0, 6).map((p) => ({
          title: p.title,
          description: p.description ?? null,
        })),
      });
    }

    // Standard article — this is the happy path
    return NextResponse.json({
      type: "standard",
      title: summary.title,
      description: summary.description ?? null,
      extract: summary.extract,
      thumbnail: summary.thumbnail ?? null,
      url: summary.content_urls?.desktop.page ?? null,
      // Related articles become the clickable chips in the burrow card
      related: links.slice(0, 8).map((p) => ({
        title: p.title,
        description: p.description ?? null,
        thumbnail: p.thumbnail ?? null,
      })),
    });

  } catch (err) {
    console.error(`Wiki API error for "${title}":`, err);
    return NextResponse.json(
      { error: "Failed to fetch article" },
      { status: 500 }
    );
  }
}