import styles from "@/app/explore.module.css";
import { earnedBadges, type WarrenShape } from "@/lib/explore/badges";

/** Shows the badges a warren earned. Renders nothing if none — no empty chrome. */
export function BadgeRow({ shape }: { shape: WarrenShape }) {
  const badges = earnedBadges(shape);
  if (badges.length === 0) return null;
  return (
    <div className={styles.badgeRow} data-export-hide="true">
      {badges.map((b) => (
        <span key={b.id} className={styles.badge} title={`${b.name} — ${b.description}`}>
          <span className={styles.badgeGlyph} aria-hidden>
            {b.glyph}
          </span>
          {b.name}
        </span>
      ))}
    </div>
  );
}
