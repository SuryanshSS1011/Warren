"use client";

import { useEffect } from "react";

export default function PendoInitializer() {
  useEffect(() => {
    // The loader snippet defines `pendo` synchronously, but guard defensively in case the
    // agent script failed to load. Empty visitor id → Pendo assigns its own anonymous id;
    // we never send Warren's anon cookie or any PII (the app has no login).
    if (typeof pendo === "undefined") return;
    pendo.initialize({ visitor: { id: "" } });
  }, []);
  return null;
}
