import { describe, it, expect } from "vitest";
import { newCardState, review, isDue, isReviewRating, masteryOf } from "./scheduler";

const NOW = 1_800_000_000_000;

describe("isReviewRating", () => {
  it("accepts the four grades, rejects others", () => {
    for (const r of ["again", "hard", "good", "easy"]) expect(isReviewRating(r)).toBe(true);
    expect(isReviewRating("manual")).toBe(false);
    expect(isReviewRating("")).toBe(false);
  });
});

describe("newCardState", () => {
  it("starts New, due now, unreviewed", () => {
    const s = newCardState(NOW);
    expect(s.state).toBe(0); // New
    expect(s.reps).toBe(0);
    expect(s.due).toBeLessThanOrEqual(NOW + 1000);
    expect(s.last_review).toBeNull();
    expect(isDue(s, NOW)).toBe(true);
  });
});

describe("review (FSRS)", () => {
  it("'again' keeps the card due very soon; 'easy' pushes it far out", () => {
    const fresh = newCardState(NOW);
    const again = review(fresh, "again", NOW);
    const easy = review(fresh, "easy", NOW);
    // Easy schedules further into the future than Again.
    expect(easy.due).toBeGreaterThan(again.due);
    // A review advances reps and records last_review.
    expect(again.reps).toBe(1);
    expect(again.last_review).toBe(NOW);
  });

  it("'good' on a fresh card produces a future due date", () => {
    const s = review(newCardState(NOW), "good", NOW);
    expect(s.due).toBeGreaterThan(NOW);
    expect(s.reps).toBe(1);
  });

  it("repeated 'good' reviews grow the interval (stability increases)", () => {
    let s = review(newCardState(NOW), "good", NOW);
    const firstStability = s.stability;
    // review again at its due time
    s = review(s, "good", s.due);
    expect(s.stability).toBeGreaterThanOrEqual(firstStability);
    expect(s.reps).toBe(2);
  });

  it("'again' on a card in Review state records a lapse", () => {
    // Drive the card into Review state (FSRS counts lapses only from Review), then fail it.
    let s = review(newCardState(NOW), "good", NOW);
    for (let k = 0; k < 4 && s.state !== 2; k++) s = review(s, "good", s.due);
    expect(s.state).toBe(2); // Review
    const before = s.lapses;
    s = review(s, "again", s.due);
    expect(s.lapses).toBe(before + 1);
  });
});

describe("isDue", () => {
  it("is true when due <= now, false otherwise", () => {
    const s = review(newCardState(NOW), "easy", NOW);
    expect(isDue(s, NOW)).toBe(false); // pushed into the future
    expect(isDue(s, s.due)).toBe(true);
  });
});

describe("masteryOf", () => {
  it("is 'new' for a never-reviewed card", () => {
    expect(masteryOf({ state: 0, reps: 0, stability: 0 })).toBe("new");
  });
  it("is 'learning' while in Learning/Relearning", () => {
    expect(masteryOf({ state: 1, reps: 1, stability: 5 })).toBe("learning");
    expect(masteryOf({ state: 3, reps: 4, stability: 20 })).toBe("learning");
  });
  it("buckets Review cards by stability", () => {
    expect(masteryOf({ state: 2, reps: 2, stability: 5 })).toBe("learning"); // < 14d
    expect(masteryOf({ state: 2, reps: 3, stability: 30 })).toBe("familiar"); // 14–60d
    expect(masteryOf({ state: 2, reps: 6, stability: 120 })).toBe("mastered"); // >= 60d
  });
});
