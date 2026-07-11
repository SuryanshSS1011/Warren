"use client";

import { useState } from "react";
import styles from "@/app/explore.module.css";

/**
 * Owner-only control to publish / unpublish a warren. Warrens are private by default
 * (PRODUCT_PLAN §1.5); publishing is the explicit opt-in that makes a trail public,
 * indexable, and gallery-eligible. Shown only when the viewer owns the warren.
 */
export function PublishToggle({ id, initialPublic }: { id: string; initialPublic: boolean }) {
  const [isPublic, setIsPublic] = useState(initialPublic);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !isPublic;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/warren/${id}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPublic: next }),
      });
      if (!res.ok) throw new Error(res.status === 401 ? "Not your warren" : "Couldn't update");
      setIsPublic(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't update");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.publishToggle} data-export-hide="true">
      <span className={styles.publishState} data-public={isPublic}>
        {isPublic ? "Published · public" : "Private"}
      </span>
      <button
        type="button"
        className={styles.ctl}
        onClick={toggle}
        disabled={busy}
        aria-pressed={isPublic}
      >
        {busy ? "…" : isPublic ? "Make private" : "Publish"}
      </button>
      {error ? <span className={styles.publishError}>{error}</span> : null}
    </div>
  );
}
