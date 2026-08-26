"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/explore.module.css";
import { tierAllows, type Tier } from "@/lib/billing/tiers";

type Citation = { url?: string; domain?: string; text: string; flags: string[] };
type Report = { total: number; citationNeeded: number; weak: number; citations: Citation[] };

const FLAG_LABEL: Record<string, string> = {
  "self-published": "self-published",
  "user-generated": "user-generated",
  "dead-link": "dead link",
  "no-source": "no link",
};

/**
 * Researcher-tier citation explorer: an article's references with weak-source and
 * unsourced-claim signals. Loads on demand (it parses the full article). Non-Researcher
 * viewers are nudged to /pricing.
 */
export function CitationExplorer({ title, tier }: { title: string; tier: Tier }) {
  const router = useRouter();
  const [report, setReport] = useState<Report | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");

  const canUse = tierAllows(tier, "citation_explorer");

  async function load() {
    if (!canUse) {
      router.push("/pricing");
      return;
    }
    setState("loading");
    try {
      const res = await fetch(`/api/wiki/citations?title=${encodeURIComponent(title)}`);
      if (res.status === 402) {
        router.push("/pricing");
        setState("idle");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      setReport((await res.json()) as Report);
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className={styles.citeBox}>
      <div className={styles.citeHead}>
        Sources
        {tier === "researcher" ? null : <span className={styles.citePro}> · Researcher</span>}
      </div>

      {!report ? (
        <button className={styles.citeBtn} onClick={load} disabled={state === "loading"}>
          {state === "loading" ? "Analyzing sources…" : "Analyze sources"}
        </button>
      ) : (
        <>
          <div className={styles.citeStats}>
            <span>{report.total} references</span>
            <span className={report.weak > 0 ? styles.citeWarn : undefined}>
              {report.weak} weak
            </span>
            <span className={report.citationNeeded > 0 ? styles.citeWarn : undefined}>
              {report.citationNeeded} unsourced claims
            </span>
          </div>
          <ul className={styles.citeList}>
            {report.citations.slice(0, 40).map((c, i) => (
              <li key={i} className={styles.citeItem}>
                <span className={styles.citeText}>
                  {c.url ? (
                    <a href={c.url} target="_blank" rel="noopener noreferrer">
                      {c.domain ?? c.text}
                    </a>
                  ) : (
                    c.text
                  )}
                </span>
                {c.flags.length > 0 ? (
                  <span className={styles.citeFlags}>
                    {c.flags.map((f) => (
                      <span key={f} className={styles.citeFlag}>
                        {FLAG_LABEL[f] ?? f}
                      </span>
                    ))}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      {state === "error" ? (
        <p className={styles.citeError}>Couldn&rsquo;t analyze sources — try again.</p>
      ) : null}
    </div>
  );
}
