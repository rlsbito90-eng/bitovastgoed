// V2.4 — Deeplink-helper naar de publieke BAG Viewer van Kadaster.
// Geen externe call; pure URL-bouwer.

export function buildBagViewerUrl(adres: string): string {
  const q = encodeURIComponent((adres ?? '').trim());
  return `https://bagviewer.kadaster.nl/lvbag/bag-viewer/index.html#?searchQuery=${q}`;
}
