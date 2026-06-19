// V2.3 — Fan-out-helpers voor automatische AI- en BAG-verrijking.
// Fire-and-forget; faalt stil. Roept GEEN betaalde Kadaster-API aan.

import { supabase } from '@/integrations/supabase/client';
import { magAiAutoVerrijken, magBagAutoVerrijken } from './autoTrigger';
import { berekenKadasteradvies } from './kadasteradvies';
import type { SignaalBagInput } from './types';

export function triggerAiAutoVerrijking(signaal: SignaalBagInput & { id: string }) {
  const b = magAiAutoVerrijken(signaal);
  if (!b.toegestaan) return;
  supabase.functions
    .invoke('off-market-enrich-signaal', {
      body: { signaal_id: signaal.id, force: false },
    })
    .catch(() => { /* fail-soft */ });
}

export async function persistKadasteradvies(signaalId: string): Promise<void> {
  const { data: row } = await supabase
    .from('off_market_signalen')
    .select('*')
    .eq('id', signaalId)
    .maybeSingle();
  if (!row) return;
  const advies = berekenKadasteradvies(row as unknown as SignaalBagInput);
  await supabase
    .from('off_market_signalen')
    .update({
      kadasteradvies: advies.niveau,
      kadasteradvies_reden: advies.reden,
      kadasteradvies_berekend_op: new Date().toISOString(),
    } as never)
    .eq('id', signaalId);
}

/**
 * Wordt aangeroepen na succesvolle AI-verrijking. Haalt verse rij op,
 * checkt of BAG mag, en triggert BAG-edge function fire-and-forget.
 */
export async function triggerBagAutoNaAi(signaalId: string): Promise<void> {
  try {
    const { data: row } = await supabase
      .from('off_market_signalen')
      .select('*')
      .eq('id', signaalId)
      .maybeSingle();
    if (!row) return;
    const b = magBagAutoVerrijken(row as unknown as SignaalBagInput);
    if (!b.toegestaan) return;
    await supabase.functions.invoke('off-market-bag-verrijk', {
      body: { signaal_id: signaalId, force: false },
    });
    await persistKadasteradvies(signaalId);
  } catch {
    /* fail-soft */
  }
}
