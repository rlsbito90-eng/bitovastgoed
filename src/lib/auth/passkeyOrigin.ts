/**
 * WebAuthn-credentials zijn cryptografisch gekoppeld aan het vaste CRM-domein.
 * Willekeurige Vercel preview-domeinen zijn hiervan GEEN subdomeinen.
 */
export const PASSKEY_ORIGIN = 'https://bitovastgoed.vercel.app';

export function isPasskeyOriginAllowed(origin: string): boolean {
  return origin === PASSKEY_ORIGIN;
}
