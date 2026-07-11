import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import ReplayMap from "@/components/explore/ReplayMap";
import { loadWarren } from "@/lib/explore/repository";

const ANON_COOKIE = "warren_anon";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const warren = await loadWarren(id);
  if (!warren) return { title: "Warren not found" };
  const desc = `${warren.stats.hops} hops · ${warren.stats.categories} categories · ${warren.stats.minutes} min — replay this Wikipedia journey on Warren.`;
  return {
    title: `${warren.title} — Warren`,
    description: desc,
    openGraph: {
      title: warren.title,
      description: desc,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: warren.title,
      description: desc,
    },
  };
}

export default async function WarrenPage({ params }: Props) {
  const { id } = await params;
  // Pass the viewer's anon id so an owner can view (and publish) their own private warren.
  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  const warren = await loadWarren(id, anonId);
  if (!warren) notFound();
  return <ReplayMap warren={warren} />;
}
