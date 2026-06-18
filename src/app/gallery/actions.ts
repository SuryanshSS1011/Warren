"use server";

import { searchPublicWarrens, type WarrenCard } from "@/lib/explore/repository";
import { searchWikipedia } from "@/lib/wikipedia/client";

export type SearchResults = {
  warrens: WarrenCard[];
  wikipedia: string[];
};

export async function gallerySearch(query: string): Promise<SearchResults> {
  if (!query.trim()) return { warrens: [], wikipedia: [] };

  const [warrens, wikipedia] = await Promise.all([
    searchPublicWarrens(query, 12).catch(() => []),
    searchWikipedia(query, 6).catch(() => []),
  ]);

  return { warrens, wikipedia };
}
