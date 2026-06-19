import { type NextRequest, NextResponse } from "next/server";
import { wikiFetch } from "@/lib/wikipedia/client";
import { getPublicEnv } from "@/lib/env/public";

/**
 * Proxies the mobile Wikipedia page and injects a click-tracking script so link clicks
 * inside the embedded reader can hop the main graph.
 *
 * SECURITY: the returned HTML is rendered inside a SANDBOXED iframe (see BurrowCard —
 * `sandbox="allow-scripts allow-popups"`, no `allow-same-origin`), so the proxied page
 * runs in an opaque origin with no access to Warren's cookies/storage/DOM. The injected
 * script talks to the parent only via postMessage with an explicit target origin (this
 * app's origin), and the parent verifies `event.origin` before acting. We also set a CSP
 * and never reflect untrusted input into the page unescaped (the title is JSON-encoded).
 */
export async function GET(req: NextRequest) {
  const title = new URL(req.url).searchParams.get("title");
  if (!title) {
    return new NextResponse("Title is required", { status: 400 });
  }

  // The parent origin the injected script is allowed to message (no wildcard).
  const appOrigin = getPublicEnv().NEXT_PUBLIC_APP_URL;
  const safeTitle = JSON.stringify(title); // safe to embed in a <script> string literal
  const safeOrigin = JSON.stringify(appOrigin);

  const wikiUrl = `https://en.m.wikipedia.org/wiki/${encodeURIComponent(title)}`;

  try {
    const res = await wikiFetch(wikiUrl);
    if (!res.ok) {
      return new NextResponse(`Wikipedia returned ${res.status}`, { status: res.status });
    }
    let html = await res.text();

    const injection = `
      <base href="https://en.m.wikipedia.org/">
      <style>
        #warren-highlight-trigger{position:fixed;z-index:999999;display:none;background:#e9b44c;color:#000;border:none;border-radius:4px;padding:6px 10px;font-family:sans-serif;font-size:12px;font-weight:bold;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.3);pointer-events:auto}
        #warren-highlight-trigger:hover{background:#f6cd76}
      </style>
      <button id="warren-highlight-trigger">✦ Save Highlight</button>
      <script>
      (function(){
        var ORIGIN = ${safeOrigin};
        var TITLE = ${safeTitle};
        var post = function(msg){ try { window.parent.postMessage(msg, ORIGIN); } catch(e){} };
        var trigger = document.getElementById('warren-highlight-trigger');
        var current = '';
        document.addEventListener('mouseup', function(){
          var sel = window.getSelection(); var text = sel.toString().trim();
          if (text && text.length > 5) {
            current = text;
            var rect = sel.getRangeAt(0).getBoundingClientRect();
            trigger.style.left = (rect.left + rect.width/2 - trigger.offsetWidth/2) + 'px';
            trigger.style.top = (rect.top - 35) + 'px';
            trigger.style.display = 'block';
          } else { trigger.style.display = 'none'; }
        });
        trigger.addEventListener('click', function(e){
          e.preventDefault(); e.stopPropagation();
          post({ type:'WIKI_HIGHLIGHT', title: TITLE, text: current });
          trigger.style.display = 'none';
          var s = window.getSelection(); if (s) s.removeAllRanges();
        });
        document.addEventListener('click', function(e){
          var link = e.target && e.target.closest ? e.target.closest('a') : null;
          if (!link) return;
          var href = link.getAttribute('href');
          if (href && href.indexOf('/wiki/') === 0 && href.indexOf(':') === -1) {
            e.preventDefault();
            var to = decodeURIComponent(href.split('/wiki/')[1].replace(/_/g,' '));
            post({ type:'WIKI_HOP', from: TITLE, to: to });
          }
        }, true);
        post({ type:'WIKI_PAGE_LOAD', title: TITLE });
      })();
      </script>
    `;

    html = html.replace("<head>", `<head>${injection}`);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        // Only Warren may frame this; scripts/styles/images limited to Wikipedia + inline.
        "Content-Security-Policy": [
          "frame-ancestors 'self'",
          "default-src 'self' https://*.wikipedia.org https://*.wikimedia.org",
          "script-src 'unsafe-inline' https://*.wikipedia.org https://*.wikimedia.org",
          "style-src 'unsafe-inline' https://*.wikipedia.org https://*.wikimedia.org",
          "img-src data: https:",
        ].join("; "),
      },
    });
  } catch (err) {
    console.error("Wiki render error:", err);
    return new NextResponse("Failed to fetch Wikipedia", { status: 500 });
  }
}
