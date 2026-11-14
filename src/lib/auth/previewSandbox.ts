/**
 * Veiligheidshek voor inlogvrije ontwikkelpreviews.
 *
 * DIT MAG NOOIT INSCHAKELEN WANNEER DE APP AAN EEN PRODUCTIEDATABASE HANGT.
 * Alle voorwaarden zijn nodig: expliciete opt-in, preview-host, én
 * afzonderlijk en expliciet aangewezen Supabase-sandboxproject.
 */
export const PROTECTED_CRM_PROJECT_REFS = [
  'vyjocdlwfxrblusfngfq',
  'ljudxyrqoifhfikueric',
] as const;

const PREVIEW_HOST = /^bitovastgoed-[a-z0-9-]+-bitovastgoed\.vercel\.app$/;
const PROJECT_REF = /^[a-z0-9]{20}$/;

export function isIsolatedPreviewSandbox(config: {
  origin: string;
  enabled: string | undefined;
  supabaseUrl: string | undefined;
  sandboxProjectRef: string | undefined;
}): boolean {
  if (config.enabled !== 'true') return false;
  if (!config.sandboxProjectRef || !PROJECT_REF.test(config.sandboxProjectRef)) return false;
  if (PROTECTED_CRM_PROJECT_REFS.some(ref => ref === config.sandboxProjectRef)) return false;
  try {
    const page = new URL(config.origin);
    const db = new URL(config.supabaseUrl ?? '');
    return page.protocol === 'https:'
      && page.origin === config.origin
      && PREVIEW_HOST.test(page.hostname)
      && db.protocol === 'https:'
      && db.hostname === `${config.sandboxProjectRef}.supabase.co`
      && db.pathname === '/'
      && db.search === ''
      && db.hash === '';
  } catch {
    return false;
  }
}

/**
 * De runtimeconfiguratie wordt pas bij het bouwen van een Vercel-preview
 * geactiveerd. Productie heeft NOOIT de VITE_PREVIEW_SANDBOX_MODE-flag.
 */
export const IS_ISOLATED_PREVIEW_SANDBOX = isIsolatedPreviewSandbox({
  origin: typeof window === 'undefined' ? '' : window.location.origin,
  enabled: import.meta.env.VITE_PREVIEW_SANDBOX_MODE,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  sandboxProjectRef: import.meta.env.VITE_PREVIEW_SANDBOX_PROJECT_REF,
});
