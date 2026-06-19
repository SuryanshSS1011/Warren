"use client";

// A tiny string cache backed by localStorage, with an in-memory mirror so reads are sync
// and survive a page reload. Keyed by CONTENT (e.g. a path or title-pair), so the same
// input always resolves to the same stored value on this device — deterministic + no
// refetch. (Cross-user sharing is handled separately by the server-side Redis cache, which
// keys AI results by the same content so a different person hitting the same pattern gets
// a cache hit instead of an LLM call.)
//
// Degrades gracefully where localStorage is unavailable (SSR, privacy mode): it just acts
// as an in-memory Map for the session.

type Store = Map<string, string>;

function load(prefix: string): Store {
  const m = new Map<string, string>();
  if (typeof window === "undefined") return m;
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(prefix)) {
        const v = window.localStorage.getItem(k);
        if (v != null) m.set(k.slice(prefix.length), v);
      }
    }
  } catch {
    /* localStorage blocked — in-memory only */
  }
  return m;
}

/** Create a persistent string cache namespaced by `prefix`. */
export function createPersistentCache(prefix: string) {
  let mem: Store | null = null;
  const store = () => (mem ??= load(prefix));

  return {
    get(key: string): string | null {
      return store().get(key) ?? null;
    },
    set(key: string, value: string): void {
      store().set(key, value);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(prefix + key, value);
      } catch {
        /* quota/blocked — keep the in-memory copy */
      }
    },
    has(key: string): boolean {
      return store().has(key);
    },
  };
}
