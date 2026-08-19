import { supabase } from '@/integrations/supabase/client';
import { queryClient } from '@/lib/queryClient';

const TABLE = 'off_market_acquisitie_selectie';
const LIST_KEY = ['off-market-acquisitie-selectie'] as const;
const SIGNALEN_KEY = ['off-market-signalen'] as const;
const VERZONDEN_BRIEVEN_KEY = ['off-market-acquisitie-selectie', 'verzonden-brieven'] as const;

function invalidateAll(signaalId?: string) {
  void queryClient.invalidateQueries({ queryKey: LIST_KEY });
  void queryClient.invalidateQueries({ queryKey: VERZONDEN_BRIEVEN_KEY });
  void queryClient.invalidateQueries({ queryKey: SIGNALEN_KEY });
  void queryClient.invalidateQueries({ queryKey: ['off-market-kpi'] });
  if (signaalId) void queryClient.invalidateQueries({ queryKey: ['off-market-signaal', signaalId] });
}

/**
 * Imperatieve variant voor grote, gecontroleerde lijsten.
 * Vermijdt één React Query MutationObserver per zichtbare rij, maar behoudt
 * exact dezelfde idempotente database-operatie en cache-invalidaties.
 */
export async function voegSignaalToeAanAcquisitieSelectie(signaalId: string): Promise<void> {
  const { data: u } = await supabase.auth.getUser();
  const door = u.user?.id ?? null;

  const { data: bestaand, error: leesFout } = await (supabase as any)
    .from(TABLE)
    .select('*')
    .eq('signaal_id', signaalId)
    .order('toegevoegd_op', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (leesFout) throw new Error(leesFout.message);

  if (bestaand?.archived_at === null) {
    invalidateAll(signaalId);
    return;
  }

  if (bestaand) {
    const { error } = await (supabase as any)
      .from(TABLE)
      .update({
        archived_at: null,
        toegevoegd_door: door,
        toegevoegd_op: new Date().toISOString(),
      })
      .eq('id', bestaand.id);
    if (error) throw new Error(error.message);
    invalidateAll(signaalId);
    return;
  }

  const { error } = await (supabase as any)
    .from(TABLE)
    .insert({ signaal_id: signaalId, toegevoegd_door: door });

  if (error) {
    const { data: nu } = await (supabase as any)
      .from(TABLE)
      .select('id')
      .eq('signaal_id', signaalId)
      .is('archived_at', null)
      .maybeSingle();
    if (!nu) throw new Error(error.message);
  }

  invalidateAll(signaalId);
}

/** Soft-remove voor gecontroleerde lijsten; historie en brondossier blijven intact. */
export async function verwijderSignaalUitAcquisitieSelectie(signaalId: string): Promise<void> {
  const { error } = await (supabase as any)
    .from(TABLE)
    .update({ archived_at: new Date().toISOString() })
    .eq('signaal_id', signaalId)
    .is('archived_at', null);
  if (error) throw new Error(error.message);
  invalidateAll(signaalId);
}
