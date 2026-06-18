import { NextRequest, NextResponse } from "next/server";
import { wikiFetch } from "@/lib/wikipedia/client";

/**
 * Proxies the mobile Wikipedia page and injects a click-tracking script.
 * This allows link clicks inside the iframe to trigger hops in the main graph
 * without needing a browser extension.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const title = searchParams.get("title");

  if (!title) {
    return new NextResponse("Title is required", { status: 400 });
  }

  const wikiUrl = `https://en.m.wikipedia.org/wiki/${encodeURIComponent(title)}`;
  
  try {
    const res = await wikiFetch(wikiUrl);
    if (!res.ok) {
      return new NextResponse(`Wikipedia returned ${res.status}`, { status: res.status });
    }

    let html = await res.text();

    // Inject a <base> tag so relative assets (CSS/JS/images) still load from Wikipedia.
    // Also inject a script to intercept link clicks and handle text highlights.
    const injection = `
      <base href="https://en.m.wikipedia.org/">
      <style>
        #warren-highlight-trigger {
          position: fixed;
          z-index: 999999;
          display: none;
          background: #e9b44c;
          color: #000;
          border: none;
          border-radius: 4px;
          padding: 6px 10px;
          font-family: sans-serif;
          font-size: 12px;
          font-weight: bold;
          cursor: pointer;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          pointer-events: auto;
        }
        #warren-highlight-trigger:hover { background: #f6e05e; }
      </style>
      <button id="warren-highlight-trigger">✦ Save Highlight</button>
      <script>
        // Suppress common Wikipedia UI errors and noise in the console
        (function() {
          const originalError = console.error;
          const originalWarn = console.warn;
          const noise = [
            'movePinnableElement',
            'vector-toc-unpinned-container',
            'mw.eventLog.eventInSample',
            'mw.eventLog.pageviewInSample',
            'destination container not found'
          ];
          
          console.error = function(...args) {
            const msg = args.join(' ');
            if (noise.some(n => msg.includes(n))) return;
            originalError.apply(console, args);
          };
          
          console.warn = function(...args) {
            const msg = args.join(' ');
            if (noise.some(n => msg.includes(n))) return;
            originalWarn.apply(console, args);
          };
        })();

        const trigger = document.getElementById('warren-highlight-trigger');
        let currentSelection = '';

        document.addEventListener('mouseup', (e) => {
          const selection = window.getSelection();
          const text = selection.toString().trim();
          
          if (text && text.length > 5) {
            currentSelection = text;
            const range = selection.getRangeAt(0);
            const rect = range.getBoundingClientRect();
            
            trigger.style.left = rect.left + (rect.width / 2) - (trigger.offsetWidth / 2) + 'px';
            trigger.style.top = rect.top - 35 + 'px';
            trigger.style.display = 'block';
          } else {
            trigger.style.display = 'none';
          }
        });

        trigger.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          window.parent.postMessage({
            type: 'WIKI_HIGHLIGHT',
            title: ${JSON.stringify(title)},
            text: currentSelection
          }, '*');
          trigger.style.display = 'none';
          window.getSelection().removeAllRanges();
        });

        document.addEventListener('click', (e) => {
          const link = e.target.closest('a');
          if (!link) return;

          const href = link.getAttribute('href');
          // Only intercept internal Wikipedia article links
          if (href && href.startsWith('/wiki/') && !href.includes(':')) {
            e.preventDefault();
            const targetTitle = decodeURIComponent(href.split('/wiki/')[1].replace(/_/g, ' '));
            
            // Notify the parent Warren window about the hop
            window.parent.postMessage({
              type: 'WIKI_HOP',
              from: ${JSON.stringify(title)},
              to: targetTitle
            }, '*');
          }
        }, true);

        // Also track simple navigation (e.g. if a link wasn't caught or for the initial load)
        window.parent.postMessage({
          type: 'WIKI_PAGE_LOAD',
          title: ${JSON.stringify(title)}
        }, '*');
      </script>
    `;

    // Insert injection at the start of <head>
    html = html.replace('<head>', `<head>${injection}`);

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // Disable CSP if necessary, though <base> handles most things
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (err) {
    console.error("Wiki render error:", err);
    return new NextResponse("Failed to fetch Wikipedia", { status: 500 });
  }
}
