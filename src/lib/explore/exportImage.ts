// Client-side "save my warren as an image" — complements the server OG route by letting a
// user grab a PNG of the live map without a round-trip. Uses modern-screenshot (DOM → PNG).
import { domToPng } from "modern-screenshot";

export async function exportWarrenImage(el: HTMLElement, filename = "warren.png") {
  const dataUrl = await domToPng(el, {
    scale: 2,
    backgroundColor: "#08080f",
    // skip interactive chrome (controls, dialogs) so the export reads like an artifact
    filter: (node) => {
      if (!(node instanceof HTMLElement)) return true;
      return node.dataset.exportHide !== "true";
    },
  });
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}
