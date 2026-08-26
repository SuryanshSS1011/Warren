import Link from "next/link";
import { CC_BY_SA_4_0, WIKIPEDIA } from "@/lib/attribution";

/**
 * Site-wide disclosure footer (PRODUCT_PLAN §1.1–1.2): Warren is AI-assisted, its content
 * comes from Wikipedia under CC BY-SA 4.0, and it is not affiliated with the Wikimedia
 * Foundation. Rendered on non-immersive pages (gallery, about); the immersive map surfaces
 * per-output attribution inline instead (AiBadge / AiAttribution).
 */
export function SiteFooter() {
  return (
    <footer className="siteFooter">
      <p>
        AI-assisted. Content from{" "}
        <a href="https://en.wikipedia.org" target="_blank" rel="noopener noreferrer">
          Wikipedia
        </a>{" "}
        under{" "}
        <a href={CC_BY_SA_4_0.url} target="_blank" rel="noopener noreferrer">
          {CC_BY_SA_4_0.name}
        </a>
        . <Link href="/about">About &amp; attribution</Link>
      </p>
      <p className="siteFooterFine">{WIKIPEDIA.disclaimer}</p>
    </footer>
  );
}
