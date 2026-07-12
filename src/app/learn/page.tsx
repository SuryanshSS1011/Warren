import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SiteFooter } from "@/components/SiteFooter";
import { StudySession } from "@/components/learn/StudySession";
import { KnowledgeMapView } from "@/components/learn/KnowledgeMapView";
import { getUser } from "@/lib/supabase/auth";
import { can } from "@/lib/billing/entitlements";
import { knowledgeMap } from "@/lib/learn/repository";
import styles from "./learn.module.css";

const ANON_COOKIE = "warren_anon";

export const metadata: Metadata = {
  title: "Learn — Warren",
  description: "Review spaced-repetition flashcards from the articles you've explored.",
};

export default async function LearnPage() {
  // Sign-in first (cards are owned), then Pro (Learn is a Pro feature).
  const user = await getUser();
  if (!user) redirect("/signin?next=/learn");
  if (!(await can("spaced_repetition"))) redirect("/pricing");

  const anonId = (await cookies()).get(ANON_COOKIE)?.value;
  const map = await knowledgeMap({ anonId, userId: user.id });

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <Link href="/" className={styles.back}>
          ← Warren
        </Link>
        <h1 className={styles.h1}>Learn</h1>
        <p className={styles.sub}>Review what you&rsquo;ve explored, spaced for retention.</p>
      </header>
      <main className={styles.main}>
        <section className={styles.section}>
          <StudySession />
        </section>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What you know</h2>
          <KnowledgeMapView map={map} />
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
