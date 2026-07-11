"use client";

import styles from "@/app/explore.module.css";
import type { AiAttribution as AiAttributionData } from "@/lib/attribution";

/**
 * Compact "AI" flag for transient / space-constrained AI surfaces (the bridge subtitle,
 * the journey title) where the full {@link AiAttribution} footer would clutter. The flag is
 * always visible; the CC BY-SA license link + per-article source links reveal in a popover
 * on hover OR keyboard focus (PRODUCT_PLAN §1.1). Renders nothing without attribution data.
 */
export function AiBadge({ attribution }: { attribution: AiAttributionData | null }) {
  if (!attribution) return null;
  const { license, sources } = attribution;
  return (
    <span className={styles.aiBadge}>
      <button
        type="button"
        className={styles.aiBadgeTrigger}
        aria-label="AI-generated content attribution"
        // The popover is reachable via focus; the button itself performs no action.
        onClick={(e) => e.preventDefault()}
      >
        AI
      </button>
      <span className={styles.aiBadgePopover} role="tooltip">
        <span className={styles.aiBadgeFlagRow}>AI-generated</span>
        <a href={license.url} target="_blank" rel="noopener noreferrer">
          {license.name}
        </a>
        {sources.length > 0 ? (
          <>
            {" · from "}
            {sources.map((s, i) => (
              <span key={s.url}>
                {i > 0 ? ", " : ""}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  {s.title}
                </a>
              </span>
            ))}
          </>
        ) : null}
      </span>
    </span>
  );
}
