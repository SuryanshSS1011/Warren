import { NextResponse, type NextRequest } from "next/server";
import { generatePathNarrative } from "@/lib/ai/narrative";

export async function POST(req: NextRequest) {
  try {
    const { path } = await req.json();

    if (!path || !Array.isArray(path)) {
      return NextResponse.json(
        { error: "Missing or invalid path array" },
        { status: 400 }
      );
    }

    const narrative = await generatePathNarrative(path);

    return NextResponse.json(
      { narrative },
      {
        headers: {
          "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
        },
      }
    );
  } catch (error: any) {
    console.error("API Error in narrative generation:", error);
    
    // Propagate rate limits (429) specifically so the UI can handle them gracefully
    const status = error?.status === 429 ? 429 : 500;
    const message = error instanceof Error ? error.message : "Internal server error";

    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
