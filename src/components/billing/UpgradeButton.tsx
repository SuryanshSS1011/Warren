"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/pricing/pricing.module.css";

/**
 * Starts a LemonSqueezy checkout for a paid tier. If the user isn't signed in, the checkout
 * route returns 401 and we send them to sign-in first (you must have an account to pay).
 */
export function UpgradeButton({
  tier,
  label,
  signedIn,
}: {
  tier: "pro" | "researcher";
  label: string;
  signedIn: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upgrade() {
    if (!signedIn) {
      router.push(`/signin?next=${encodeURIComponent("/pricing")}`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier }),
      });
      if (res.status === 401) {
        router.push(`/signin?next=${encodeURIComponent("/pricing")}`);
        return;
      }
      if (res.status === 503) {
        setError("Checkout isn't available yet.");
        return;
      }
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        setError(data.error ?? "Couldn't start checkout.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.upgradeWrap}>
      <button className={styles.upgradeBtn} onClick={upgrade} disabled={busy}>
        {busy ? "…" : label}
      </button>
      {error ? <p className={styles.upgradeError}>{error}</p> : null}
    </div>
  );
}
