/**
 * Background worker: relays Wikipedia hops to the Warren app. The server URL and the
 * shared auth token are configured by the user in the popup (chrome.storage), so nothing
 * is hardcoded and the POST is authenticated.
 */

chrome.runtime.onMessage.addListener((message) => {
  if (message.type !== "WIKI_PAGE_LOAD" && message.type !== "WIKI_HOP") return;

  chrome.storage.sync.get(["warrenUrl", "warrenToken"], ({ warrenUrl, warrenToken }) => {
    if (!warrenUrl || !warrenToken) {
      console.warn("Warren extension not configured — set the app URL + token in the popup.");
      return;
    }
    const base = warrenUrl.replace(/\/$/, "");
    fetch(`${base}/api/extension/hop`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${warrenToken}`,
      },
      body: JSON.stringify(message),
    }).catch((err) => console.error("Warren app not reachable:", err));
  });
});
