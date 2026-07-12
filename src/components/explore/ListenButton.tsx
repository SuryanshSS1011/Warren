"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import styles from "@/app/explore.module.css";
import { tierAllows, type Tier } from "@/lib/billing/tiers";

/**
 * Pro-gated narration using the browser's Web Speech API (speechSynthesis) — $0, no server
 * infra. Reads `text` aloud with play/pause/stop. Non-Pro viewers are nudged to /pricing.
 * Gracefully hidden where speech synthesis is unavailable.
 */
export function ListenButton({ text, tier }: { text: string; tier: Tier }) {
  const router = useRouter();
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  // Capability check runs once via the state initializer (no effect → no cascading-render lint).
  const [supported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Stop narration if the article text changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, [text]);

  if (!supported) return null;

  const canUse = tierAllows(tier, "tts");

  function start() {
    if (!canUse) {
      router.push("/pricing");
      return;
    }
    window.speechSynthesis.cancel();
    // Chunk very long text so browsers don't truncate a single long utterance.
    const utter = new SpeechSynthesisUtterance(text.slice(0, 32000));
    utter.rate = 1;
    utter.onend = () => {
      setSpeaking(false);
      setPaused(false);
    };
    utteranceRef.current = utter;
    window.speechSynthesis.speak(utter);
    setSpeaking(true);
    setPaused(false);
  }

  function pauseResume() {
    if (paused) {
      window.speechSynthesis.resume();
      setPaused(false);
    } else {
      window.speechSynthesis.pause();
      setPaused(true);
    }
  }

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
    setPaused(false);
  }

  return (
    <div className={styles.listenBar}>
      {!speaking ? (
        <button className={styles.listenBtn} onClick={start} aria-label="Listen to this article">
          ▶ Listen
        </button>
      ) : (
        <>
          <button className={styles.listenBtn} onClick={pauseResume}>
            {paused ? "▶ Resume" : "❚❚ Pause"}
          </button>
          <button className={styles.listenBtn} onClick={stop} aria-label="Stop narration">
            ■ Stop
          </button>
        </>
      )}
    </div>
  );
}
