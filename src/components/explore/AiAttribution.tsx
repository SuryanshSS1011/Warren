"use client";

import styles from "@/app/explore.module.css";
import type { AiAttribution as AiAttributionData } from "@/lib/attribution";

/**
 * Renders the "AI-generated · CC BY-SA 4.0 · sources" flag required on every AI-derived
 * surface (docs/PRODUCT_PLAN.md §1.1). Small and unobtrusive, but always present:
 * it satisfies the CC BY-SA link-back attribution and the "AI-generated/modified" disclosure.
 */
export function AiAttribution({ attribution }: { attribution: AiAttributionData }) {
  const { license, sources } = attribution;
  return (
    <div className={styles.aiAttribution}>
      <span className={styles.aiAttributionFlag}>AI-generated</span>
      <span className={styles.aiAttributionSep}>·</span>
      <a href={license.url} target="_blank" rel="noopener noreferrer">
        {license.name}
      </a>
      {sources.length > 0 ? (
        <>
          <span className={styles.aiAttributionSep}>·</span>
          <span>
            from{" "}
            {sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 ? ", " : ""}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
              </span>
            ))}
          </span>
        </>
      ) : null}
    </div>
  );
}
