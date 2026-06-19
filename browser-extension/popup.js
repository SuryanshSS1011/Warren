const urlEl = document.getElementById("url");
const tokenEl = document.getElementById("token");
const statusEl = document.getElementById("status");

chrome.storage.sync.get(["warrenUrl", "warrenToken"], ({ warrenUrl, warrenToken }) => {
  if (warrenUrl) urlEl.value = warrenUrl;
  if (warrenToken) tokenEl.value = warrenToken;
  if (warrenUrl && warrenToken) {
    statusEl.textContent = "Connected — browse Wikipedia to grow your map.";
    statusEl.className = "status ok";
  }
});

document.getElementById("save").addEventListener("click", () => {
  const warrenUrl = urlEl.value.trim().replace(/\/$/, "");
  const warrenToken = tokenEl.value.trim();
  if (!warrenUrl || !warrenToken) {
    statusEl.textContent = "Both fields are required.";
    statusEl.className = "status";
    return;
  }
  // Request host permission for the configured origin so background fetch is allowed.
  chrome.permissions.request({ origins: [`${warrenUrl}/*`] }, (granted) => {
    if (!granted) {
      statusEl.textContent = "Permission denied for that URL.";
      statusEl.className = "status";
      return;
    }
    chrome.storage.sync.set({ warrenUrl, warrenToken }, () => {
      statusEl.textContent = "Connected — browse Wikipedia to grow your map.";
      statusEl.className = "status ok";
    });
  });
});
