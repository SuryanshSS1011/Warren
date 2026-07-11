"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { getPublicEnv } from "@/lib/env/public";
import styles from "./auth.module.css";

// Accounts are OPTIONAL (anonymous-first). This panel offers magic-link + OAuth sign-in;
// on success the auth callback auto-claims the user's anonymous warrens.
export function AuthPanel({ next = "/" }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  const redirectTo = () => {
    const { NEXT_PUBLIC_APP_URL } = getPublicEnv();
    const base =
      typeof window !== "undefined" ? window.location.origin : NEXT_PUBLIC_APP_URL;
    return `${base}/auth/callback?next=${encodeURIComponent(next)}`;
  };

  async function sendMagicLink(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo() },
      });
      if (error) throw error;
      setStatus("sent");
      setMessage("Check your email for a sign-in link.");
    } catch {
      setStatus("error");
      setMessage("Couldn't send the link — try again.");
    }
  }

  async function signInWith(provider: "google" | "github") {
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: redirectTo() },
      });
      if (error) throw error;
      // On success Supabase redirects the browser away; nothing else to do here.
    } catch {
      setStatus("error");
      setMessage(`Couldn't start ${provider} sign-in — try again.`);
    }
  }

  return (
    <div className={styles.panel}>
      <p className={styles.lede}>
        Sign in to keep your warrens across devices and cookie clears. Warren works fine
        without an account — this is optional.
      </p>

      <div className={styles.oauthRow}>
        <button className={styles.oauthBtn} onClick={() => signInWith("google")}>
          Continue with Google
        </button>
        <button className={styles.oauthBtn} onClick={() => signInWith("github")}>
          Continue with GitHub
        </button>
      </div>

      <div className={styles.divider}>
        <span>or</span>
      </div>

      <form onSubmit={sendMagicLink} className={styles.form}>
        <label htmlFor="auth-email" className={styles.label}>
          Email a sign-in link
        </label>
        <div className={styles.inputRow}>
          <input
            id="auth-email"
            type="email"
            className={styles.input}
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <button className={styles.submit} type="submit" disabled={status === "sending"}>
            {status === "sending" ? "Sending…" : "Send link"}
          </button>
        </div>
      </form>

      {message ? (
        <p className={status === "error" ? styles.error : styles.note}>{message}</p>
      ) : null}
    </div>
  );
}
