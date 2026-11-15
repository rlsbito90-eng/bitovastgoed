/**
 * Het ENIGE adres waarop een volledig client-only CRM-proefomgeving draait.
 * Geen substring-match: onbedoelde productiedomeinen mogen nooit omleiden.
 */
export const CRM_SANDBOX_HOST = 'bitovastgoed-git-crm-test-bitovastgoed.vercel.app';

export function isCrmSandboxHost(hostname: string): boolean {
  return hostname.toLowerCase() === CRM_SANDBOX_HOST;
}
