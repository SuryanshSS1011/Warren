/**
 * Background script: Coordinates between Wikipedia and the local Warren app.
 */

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "WIKI_PAGE_LOAD" || message.type === "WIKI_HOP") {
    console.log("Syncing to Warren:", message);

    // Send the hop to the local Warren development server
    fetch("http://localhost:3000/api/extension/hop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message)
    }).catch(err => {
      console.error("Warren app not reachable. Make sure localhost:3000 is running.", err);
    });
  }
});
