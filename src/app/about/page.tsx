import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { CC_BY_SA_4_0, WIKIPEDIA } from "@/lib/attribution";
import styles from "./about.module.css";

export const metadata: Metadata = {
  title: "About & attribution — Warren",
  description:
    "How Warren uses Wikipedia content (CC BY-SA 4.0), where AI is involved, and our non-affiliation with the Wikimedia Foundation.",
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <Link href="/" className={styles.back}>
          ← Warren
        </Link>
        <h1 className={styles.h1}>About &amp; attribution</h1>

        <section className={styles.section}>
          <h2 className={styles.h2}>What Warren is</h2>
          <p>
            Warren turns Wikipedia browsing into a shareable visual journey — a map of your
            curiosity, with AI explaining how each idea connects to the next. It&rsquo;s for
            anyone who falls down a Wikipedia rabbit hole.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Wikipedia content &amp; licensing</h2>
          <p>
            Article text, titles, and summaries come from{" "}
            <a href="https://en.wikipedia.org" target="_blank" rel="noopener noreferrer">
              Wikipedia
            </a>
            , which is licensed under{" "}
            <a href={CC_BY_SA_4_0.url} target="_blank" rel="noopener noreferrer">
              {CC_BY_SA_4_0.name}
            </a>
            . Each article Warren shows links back to its source on Wikipedia, where the full
            authorship and edit history live. Warren&rsquo;s own generated trail artifacts are
            likewise offered under {CC_BY_SA_4_0.name}.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Where AI is involved</h2>
          <p>
            Warren uses AI to write the one-sentence &ldquo;connective tissue&rdquo; between
            articles, journey titles, and path narratives. This content is{" "}
            <strong>AI-generated and may contain errors</strong> — it is labeled as such
            wherever it appears, with links to the source articles it draws from. AI output is
            never presented as Wikipedia&rsquo;s own words.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.h2}>Not affiliated with Wikimedia</h2>
          <p className={styles.disclaimer}>{WIKIPEDIA.disclaimer}</p>
          <p>
            &ldquo;Wikipedia&rdquo; is used here only to describe what Warren does. Warren is
            an independent tool; paying for Warren does not support the Wikimedia projects. If
            you&rsquo;d like to support Wikipedia, please{" "}
            <a
              href="https://donate.wikimedia.org"
              target="_blank"
              rel="noopener noreferrer"
            >
              donate to the Wikimedia Foundation
            </a>
            .
          </p>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
