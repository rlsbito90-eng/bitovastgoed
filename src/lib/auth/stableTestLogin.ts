/**
 * Een vast testadres hoeft geen cross-origin pop-up inlogbrug te gebruiken.
 * Dit schakelt geen authenticatie uit: AuthPage gebruikt Supabase signInWithPassword;
 * ProtectedRoute en RLS blijven alle toegangsrechten afdwingen.
 * Productie en willekeurige previewhosts behouden hun bestaande aanmelding.
 */
export const FIXED_CRM_TEST_HOST = 'bitovastgoed-git-crm-test-bitovastgoed.vercel.app';

export function useDirectLoginForHost(hostname: string): boolean {
  return hostname.toLowerCase() === FIXED_CRM_TEST_HOST;
}
