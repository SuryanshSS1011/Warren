/**
 * Content script: runs on every Wikipedia article page.
 * Detects the current page and listens for link clicks to track "hops".
 */

// 1. Send the "I am here" signal when a page loads
const currentTitle = decodeURIComponent(window.location.pathname.split("/wiki/")[1]?.replace(/_/g, " "));

if (currentTitle) {
  chrome.runtime.sendMessage({
    type: "WIKI_PAGE_LOAD",
    title: currentTitle,
    url: window.location.href
  });
}

// 2. Track link clicks
document.addEventListener("click", (e) => {
  const link = e.target.closest("a");
  if (!link) return;

  const href = link.getAttribute("href");
  // Only track internal Wikipedia article links
  if (href && href.startsWith("/wiki/") && !href.includes(":")) {
    const targetTitle = decodeURIComponent(href.split("/wiki/")[1].replace(/_/g, " "));
    
    chrome.runtime.sendMessage({
      type: "WIKI_HOP",
      from: currentTitle,
      to: targetTitle
    });
  }
}, true);
