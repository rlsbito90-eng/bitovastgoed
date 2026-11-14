/** KOSTELOZE, VOLLEDIG LOKALE demo voor Vercel-previewbuilds.
 * Productie kan deze modus nooit activeren: een preview-only buildvariabele is
 * verplicht, net als een *.vercel.app-previewhostname van dit project.
 */
const PREVIEW_HOST_RE = /^bitovastgoed-[a-z0-9-]+-bitovastgoed\.vercel\.app$/;

export function isOfflinePreviewMode(args: {
  flag: string | undefined;
  origin: string;
}): boolean {
  if (args.flag !== 'true') return false;
  try {
    const url = new URL(args.origin);
    return url.protocol === 'https:'
      && url.origin === args.origin
      && PREVIEW_HOST_RE.test(url.hostname)
      && url.hostname.length < 220;
  } catch {
    return false;
  }
}

export const IS_OFFLINE_PREVIEW = isOfflinePreviewMode({
  flag: import.meta.env.VITE_NOLOGIN_PREVIEW,
  origin: typeof window === 'undefined' ? '' : window.location.origin,
});
