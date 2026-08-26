"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/explore.module.css";

/**
 * Owner-only export control (Pro feature). Downloads the warren as Markdown (Obsidian) or
 * Anki CSV. On a 402 (not Pro) it nudges to /pricing rather than erroring silently.
 */
export function ExportMenu({ warrenId }: { warrenId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download(format: "markdown" | "anki") {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/warren/${warrenId}/export?format=${format}`);
      if (res.status === 402) {
        router.push("/pricing");
        return;
      }
      if (!res.ok) {
        setError("Couldn't export.");
        return;
      }
      const blob = await res.blob();
      const cd = res.headers.get("content-disposition") ?? "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] ?? `warren.${format === "anki" ? "csv" : "md"}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      // Give the browser a moment to start the download before revoking the object URL.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.exportMenu} data-export-hide="true">
      <span className={styles.exportLabel}>Export</span>
      <button className={styles.ctl} onClick={() => download("markdown")} disabled={busy}>
        Markdown
      </button>
      <button className={styles.ctl} onClick={() => download("anki")} disabled={busy}>
        Anki
      </button>
      {error ? <span className={styles.publishError}>{error}</span> : null}
    </div>
  );
}
