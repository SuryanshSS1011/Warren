import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import MiniTrail from "@/components/explore/MiniTrail";
import { SiteFooter } from "@/components/SiteFooter";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { getUser } from "@/lib/supabase/auth";
import { getProfile } from "@/lib/billing/profile";
import { tierDisplay } from "@/lib/billing/entitlements";
import { listWarrensForOwner } from "@/lib/explore/repository";
import styles from "./my.module.css";

export const metadata: Metadata = {
  title: "My warrens — Warren",
};

const TIER_LABEL: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  researcher: "Researcher",
};

export default async function MyWarrensPage() {
  const user = await getUser();
  if (!user) redirect("/signin");

  const [warrens, profile] = await Promise.all([
    listWarrensForOwner(user.id),
    getProfile(user.id),
  ]);
  const { tier, onTrial, trialDaysLeft } = tierDisplay(profile);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← Warren
        </Link>
        <div className={styles.headRow}>
          <h1 className={styles.h1}>My warrens</h1>
          <SignOutButton />
        </div>
        <div className={styles.subRow}>
          <p className={styles.sub}>{user.email}</p>
          <span className={styles.tierChip} data-tier={tier}>
            {TIER_LABEL[tier] ?? tier}
            {onTrial ? ` · trial (${trialDaysLeft}d left)` : ""}
          </span>
          {tier !== "researcher" ? (
            <Link href="/pricing" className={styles.upgradeLink}>
              {tier === "free" ? "Upgrade" : "Compare plans"}
            </Link>
          ) : null}
        </div>
      </header>

      <main className={styles.main}>
        {warrens.length === 0 ? (
          <p className={styles.empty}>
            No warrens yet. <Link href="/">Start exploring</Link> and your journeys will show
            up here.
          </p>
        ) : (
          <div className={styles.grid}>
            {warrens.map((w) => (
              <Link key={w.id} href={`/w/${w.id}`} className={styles.card}>
                <div className={styles.cardThumb}>
                  <MiniTrail trail={w.trail} />
                </div>
                <div className={styles.cardBody}>
                  <div className={styles.cardTitle}>{w.title}</div>
                  <div className={styles.cardMeta}>
                    <span className={styles.badge} data-public={w.isPublic}>
                      {w.isPublic ? "Public" : "Private"}
                    </span>
                    <span>
                      {w.stats.hops} hops · {w.stats.categories} cats
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
