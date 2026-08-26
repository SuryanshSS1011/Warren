import Link from "next/link";
import { wikipediaArticleUrl } from "@/lib/attribution";
import type { KnowledgeMap } from "@/lib/learn/repository";
import styles from "@/app/learn/learn.module.css";

const MASTERY_LABEL: Record<string, string> = {
  new: "New",
  learning: "Learning",
  familiar: "Familiar",
  mastered: "Mastered",
};

/**
 * "What you know" — the aggregate view of the viewer's personal knowledge graph (the moat).
 * Server-rendered from the knowledge map. Each topic shows its best mastery + card/due counts.
 */
export function KnowledgeMapView({ map }: { map: KnowledgeMap }) {
  if (map.totalCards === 0) {
    return (
      <div className={styles.knowledge}>
        <p className={styles.status}>
          Your knowledge map is empty. Read an article and hit <em>Add to Learn</em> to start
          building what you know. <Link href="/">Start exploring</Link>
        </p>
      </div>
    );
  }

  return (
    <div className={styles.knowledge}>
      <div className={styles.knowledgeStats}>
        <div className={styles.stat}>
          <span className={styles.statNum}>{map.topics.length}</span>
          <span className={styles.statLabel}>topics</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{map.totalCards}</span>
          <span className={styles.statLabel}>cards</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{map.mastered}</span>
          <span className={styles.statLabel}>mastered</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statNum}>{map.totalDue}</span>
          <span className={styles.statLabel}>due now</span>
        </div>
      </div>

      <ul className={styles.topicList}>
        {map.topics.map((t) => (
          <li key={t.article} className={styles.topicRow}>
            <a
              className={styles.topicName}
              href={wikipediaArticleUrl(t.article)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.article}
            </a>
            <span className={styles.topicMeta}>
              <span className={styles.mastery} data-mastery={t.mastery}>
                {MASTERY_LABEL[t.mastery]}
              </span>
              <span className={styles.topicCount}>
                {t.cards} {t.cards === 1 ? "card" : "cards"}
                {t.due > 0 ? ` · ${t.due} due` : ""}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
