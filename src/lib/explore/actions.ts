"use server";

import { searchWikipedia } from "@/lib/wikipedia/client";

/** Search Wikipedia for article titles. */
export async function searchWiki(query: string): Promise<string[]> {
  if (!query.trim()) return [];
  return searchWikipedia(query, 10);
}
