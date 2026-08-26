import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { UpgradeButton } from "@/components/billing/UpgradeButton";
import { getUser } from "@/lib/supabase/auth";
import { currentTier } from "@/lib/billing/entitlements";
import type { Tier } from "@/lib/billing/tiers";
import styles from "./pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing — Warren",
  description: "Free forever, with Pro and Researcher tiers for power features.",
};

type Plan = {
  tier: Tier;
  name: string;
  price: string;
  tagline: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    tier: "free",
    name: "Free",
    price: "$0",
    tagline: "The rabbit hole, mapped. Forever free.",
    features: [
      "Explore: the live journey graph",
      "Basic reading + hover previews",
      "On-this-day, trending, roulette",
      "Public sharing",
    ],
  },
  {
    tier: "pro",
    name: "Pro",
    price: "$5/mo",
    tagline: "For daily explorers who want to keep what they learn.",
    features: [
      "TTS narration",
      "Reading-level slider (ELI5 ↔ expert)",
      "“Ask this article” grounded chat",
      "Spaced-repetition (Learn)",
      "Private trails + unlimited saves",
      "Export to Obsidian / Anki / …",
    ],
  },
  {
    tier: "researcher",
    name: "Researcher",
    price: "$12–15/mo",
    tagline: "For researchers, journalists, and power users.",
    features: [
      "Everything in Pro",
      "Citation explorer",
      "Watchlist monitoring",
      "Cross-lingual comparator",
      "Bulk export + API access",
      "Higher AI / TTS quotas",
    ],
  },
];

export default async function PricingPage() {
  const user = await getUser();
  const tier = await currentTier();
  const signedIn = !!user;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← Warren
        </Link>
        <h1 className={styles.h1}>Pricing</h1>
        <p className={styles.sub}>
          Free forever. Upgrade when you want the power features — new accounts get{" "}
          <strong>14 days of Pro free</strong>.
        </p>
      </header>

      <main className={styles.grid}>
        {PLANS.map((plan) => {
          const isCurrent = tier === plan.tier;
          return (
            <section
              key={plan.tier}
              className={styles.card}
              data-featured={plan.tier === "pro"}
            >
              <div className={styles.cardHead}>
                <h2 className={styles.planName}>{plan.name}</h2>
                <div className={styles.price}>{plan.price}</div>
                <p className={styles.tagline}>{plan.tagline}</p>
              </div>
              <ul className={styles.features}>
                {plan.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <div className={styles.cardFoot}>
                {isCurrent ? (
                  <span className={styles.currentBadge}>Your plan</span>
                ) : plan.tier === "free" ? (
                  <Link href="/" className={styles.freeCta}>
                    Start exploring
                  </Link>
                ) : (
                  <UpgradeButton
                    tier={plan.tier}
                    label={`Upgrade to ${plan.name}`}
                    signedIn={signedIn}
                  />
                )}
              </div>
            </section>
          );
        })}
      </main>
      <SiteFooter />
    </div>
  );
}
