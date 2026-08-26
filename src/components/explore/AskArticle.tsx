"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/explore.module.css";
import { AiAttribution } from "./AiAttribution";
import type { AiAttribution as AiAttributionData } from "@/lib/attribution";
import type { Tier } from "@/lib/billing/tiers";
import { tierAllows } from "@/lib/billing/tiers";

type Answer = { question: string; text: string; attribution: AiAttributionData };

/**
 * Pro-gated "ask this article" chat. Grounded strictly in the article (the server answers only
 * from the source text). Non-Pro viewers are nudged to /pricing. Answers carry attribution and
 * a "may contain errors" label (PRODUCT_PLAN §1.6).
 */
export function AskArticle({ title, tier }: { title: string; tier: Tier }) {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [state, setState] = useState<"idle" | "asking" | "error">("idle");

  const canUse = tierAllows(tier, "grounded_chat");

  async function ask(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = question.trim();
    if (!q) return;
    if (!canUse) {
      router.push("/pricing");
      return;
    }
    setState("asking");
    setAnswer(null);
    try {
      const res = await fetch("/api/wiki/ask", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, question: q }),
      });
      if (res.status === 402) {
        router.push("/pricing");
        setState("idle");
        return;
      }
      if (res.status === 429) {
        setState("error");
        return;
      }
      if (!res.ok) throw new Error(String(res.status));
      const data = (await res.json()) as { answer: string; attribution: AiAttributionData };
      setAnswer({ question: q, text: data.answer, attribution: data.attribution });
      setState("idle");
    } catch {
      setState("error");
    }
  }

  return (
    <div className={styles.askBox}>
      <div className={styles.askHead}>Ask this article</div>
      <form onSubmit={ask} className={styles.askForm}>
        <input
          className={styles.askInput}
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder={canUse ? "e.g. Why is this significant?" : "Ask a question (Pro)"}
          aria-label="Ask a question about this article"
          maxLength={400}
        />
        <button className={styles.askSubmit} type="submit" disabled={state === "asking"}>
          {state === "asking" ? "…" : "Ask"}
        </button>
      </form>

      {state === "error" ? (
        <p className={styles.askError}>Couldn&rsquo;t answer right now — try again in a moment.</p>
      ) : null}

      {answer ? (
        <div className={styles.askAnswer}>
          <p className={styles.askQuestion}>{answer.question}</p>
          <p className={styles.askText}>{answer.text}</p>
          <p className={styles.askDisclaimer}>AI-generated from the article — may contain errors.</p>
          <AiAttribution attribution={answer.attribution} />
        </div>
      ) : null}
    </div>
  );
}
