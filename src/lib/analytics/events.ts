"use client";

import { track } from "@vercel/analytics";

/**
 * Funnel events for the PRODUCT_PLAN §7 validation gates (retention + save→publish funnel).
 * Centralized so names stay consistent and the measurable funnel is documented in one place.
 * No PII: we never send article titles or trail content — only counts/coarse structure.
 *
 * Funnel: session_start → warren_saved → warren_published → warren_shared
 */
export type WarrenEvent =
  | "session_start" // first real node placed (a session becomes a warren)
  | "warren_saved" // autosave persisted the session for the first time
  | "warren_published" // owner made a warren public
  | "warren_shared"; // Share action copied a public link

export function trackEvent(event: WarrenEvent, data?: Record<string, string | number | boolean>) {
  try {
    track(event, data);
  } catch {
    // analytics must never break a user action
  }
}
