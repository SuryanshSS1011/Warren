// FSRS scheduling wrapper (Phase 4). Pure: converts between our persisted card state and
// ts-fsrs, and computes the next scheduling state from a review rating. No I/O — the route
// layer loads/saves. ts-fsrs has zero runtime deps, so this stays cheap.

import { fsrs, createEmptyCard, Rating, type Grade, type Card as FsrsCard } from "ts-fsrs";

const scheduler = fsrs(); // default FSRS-6 parameters

/** The FSRS scheduling fields we persist on a card row. */
export type CardState = {
  due: number; // ms epoch
  stability: number;
  difficulty: number;
  elapsed_days: number;
  scheduled_days: number;
  reps: number;
  lapses: number;
  learning_steps: number;
  state: number; // FSRS State enum
  last_review: number | null; // ms epoch or null
};

/** A review rating the user gives after seeing the answer. */
export type ReviewRating = "again" | "hard" | "good" | "easy";

const RATING: Record<ReviewRating, Grade> = {
  again: Rating.Again,
  hard: Rating.Hard,
  good: Rating.Good,
  easy: Rating.Easy,
};

export function isReviewRating(v: string): v is ReviewRating {
  return v === "again" || v === "hard" || v === "good" || v === "easy";
}

/** A fresh card's scheduling state (due now, New). `now` in ms epoch. */
export function newCardState(now: number = Date.now()): CardState {
  return toState(createEmptyCard(new Date(now)));
}

function toState(c: FsrsCard): CardState {
  return {
    due: c.due.getTime(),
    stability: c.stability,
    difficulty: c.difficulty,
    elapsed_days: c.elapsed_days,
    scheduled_days: c.scheduled_days,
    reps: c.reps,
    lapses: c.lapses,
    learning_steps: c.learning_steps,
    state: c.state,
    last_review: c.last_review ? c.last_review.getTime() : null,
  };
}

function fromState(s: CardState): FsrsCard {
  return {
    due: new Date(s.due),
    stability: s.stability,
    difficulty: s.difficulty,
    elapsed_days: s.elapsed_days,
    scheduled_days: s.scheduled_days,
    reps: s.reps,
    lapses: s.lapses,
    learning_steps: s.learning_steps,
    state: s.state,
    last_review: s.last_review ? new Date(s.last_review) : undefined,
  } as FsrsCard;
}

/**
 * Apply a review to a card and return its next scheduling state. `now` is the review time
 * (ms epoch). The new `due` is when the card should next appear.
 */
export function review(
  current: CardState,
  rating: ReviewRating,
  now: number = Date.now(),
): CardState {
  const result = scheduler.next(fromState(current), new Date(now), RATING[rating]);
  return toState(result.card);
}

/** Is a card due for review at `now`? */
export function isDue(s: CardState, now: number = Date.now()): boolean {
  return s.due <= now;
}
