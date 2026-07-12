import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SiteFooter } from "@/components/SiteFooter";
import { StudySession } from "@/components/learn/StudySession";
import { getUser } from "@/lib/supabase/auth";
import { can } from "@/lib/billing/entitlements";
import styles from "./learn.module.css";

export const metadata: Metadata = {
  title: "Learn — Warren",
  description: "Review spaced-repetition flashcards from the articles you've explored.",
};

export default async function LearnPage() {
  // Sign-in first (cards are owned), then Pro (Learn is a Pro feature).
  const user = await getUser();
  if (!user) redirect("/signin?next=/learn");
  if (!(await can("spaced_repetition"))) redirect("/pricing");

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
        <StudySession />
      </main>
      <SiteFooter />
    </div>
  );
}
