import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { SiteFooter } from "@/components/SiteFooter";
import { getUser } from "@/lib/supabase/auth";
import styles from "./signin.module.css";

export const metadata: Metadata = {
  title: "Sign in — Warren",
  description: "Optionally sign in to keep your warrens across devices.",
};

export default async function SignInPage() {
  // Already signed in → go to My warrens.
  const user = await getUser();
  if (user) redirect("/my");

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href="/" className={styles.back}>
          ← Warren
        </Link>
        <h1 className={styles.h1}>Sign in</h1>
        <AuthPanel next="/my" />
      </main>
      <SiteFooter />
    </div>
  );
}
