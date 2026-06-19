/**
 * Content script: runs on every Wikipedia article page. Reports the current page and
 * tracks clicks on internal article links, forwarding them to the background worker
 * (which relays to the Warren app with the configured auth token).
 */

const currentTitle = decodeURIComponent(
  (window.location.pathname.split("/wiki/")[1] || "").replace(/_/g, " "),
);

if (currentTitle) {
  chrome.runtime.sendMessage({
    type: "WIKI_PAGE_LOAD",
    title: currentTitle,
    url: window.location.href,
  });
}

document.addEventListener(
  "click",
  (e) => {
    const link = e.target.closest && e.target.closest("a");
    if (!link) return;
    const href = link.getAttribute("href");
    if (href && href.startsWith("/wiki/") && !href.includes(":")) {
      const to = decodeURIComponent(href.split("/wiki/")[1].replace(/_/g, " "));
      chrome.runtime.sendMessage({ type: "WIKI_HOP", from: currentTitle, to });
    }
  },
  true,
);
