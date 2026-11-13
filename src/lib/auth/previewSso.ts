// Hulpregels aan browserzijde; de Vercel API-controle in de Edge Function
// is de daadwerkelijke autorisatie van een previewdeployment.
export const CRM_PRIMARY_ORIGIN = 'https://bitovastgoed.vercel.app';
const PREVIEW_HOST_RE = /^bitovastgoed-[a-z0-9-]+-bitovastgoed\.vercel\.app$/;

export function isBitoPreviewOrigin(raw: string): boolean {
  try {
    const url = new URL(raw);
    return url.protocol === 'https:'
      && url.origin === raw
      && url.port === ''
      && PREVIEW_HOST_RE.test(url.hostname)
      && url.hostname.length < 220;
  } catch {
    return false;
  }
}

export function createPreviewNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export const PREVIEW_LOGIN_MESSAGE = 'bito-crm-preview-login-v1' as const;
export const PREVIEW_LOGIN_ACK = 'bito-crm-preview-login-ack-v1' as const;
