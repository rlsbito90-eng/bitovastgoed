import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Bieding, BiedingStatus } from '@/lib/biedingen/types';
import { biedingFromDb, biedingToDb } from '@/lib/biedingen/db';
import { logSystemContactMoment } from '@/lib/contactMoments';
import { fmtEur } from '@/lib/biedingen/format';
import { BIEDING_TYPE_LABELS, BIEDING_STATUS_LABELS } from '@/lib/biedingen/types';

type Scope =
  | { objectId: string }
  | { dealId: string }
  | { relatieId: string }
  | { all: true };

export function useBiedingen(scope: Scope) {
  const [items, setItems] = useState<Bieding[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const scopeKey = JSON.stringify(scope);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      let q: any = supabase.from('biedingen' as any).select('*').order('bieddatum', { ascending: false }).order('created_at', { ascending: false });
      if ('objectId' in scope) q = q.eq('object_id', scope.objectId);
      else if ('dealId' in scope) q = q.eq('deal_id', scope.dealId);
      else if ('relatieId' in scope) q = q.eq('relatie_id', scope.relatieId);
      const { data, error } = await q;
      if (error) throw error;
      setItems(((data ?? []) as any[]).map(biedingFromDb));
      setError(null);
    } catch (e: any) {
      setError(e?.message ?? 'Onbekende fout');
    } finally {
      setLoading(false);
    }
  }, [scopeKey]);

  useEffect(() => { fetch(); }, [fetch]);

  const refresh = fetch;

  const create = useCallback(async (payload: Partial<Bieding>) => {
    const { data: auth } = await supabase.auth.getUser();
    const insertPayload = biedingToDb({
      ...payload,
      aangemaaktDoor: auth.user?.id,
    });
    const { data, error } = await supabase
      .from('biedingen' as any)
      .insert(insertPayload as any)
      .select()
      .maybeSingle();
    if (error) throw error;
    const created = biedingFromDb(data);
    await logSystemContactMoment({
      type: 'bod_ontvangen',
      title: `Bieding toegevoegd · ${BIEDING_TYPE_LABELS[created.offerType]} · ${fmtEur(created.bedrag)}`,
      description: created.notities ?? undefined,
      objectId: created.objectId,
      relatieId: created.relatieId,
      dealId: created.dealId ?? null,
    });
    await fetch();
    return created;
  }, [fetch]);

  const update = useCallback(async (id: string, patch: Partial<Bieding>) => {
    const { data, error } = await supabase
      .from('biedingen' as any)
      .update(biedingToDb(patch) as any)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    const updated = biedingFromDb(data);
    if (patch.status) {
      await logSystemContactMoment({
        type: 'bod_ontvangen',
        title: `Bieding bijgewerkt · ${BIEDING_STATUS_LABELS[updated.status]} · ${fmtEur(updated.bedrag)}`,
        objectId: updated.objectId,
        relatieId: updated.relatieId,
        dealId: updated.dealId ?? null,
      });
    }
    await fetch();
    return updated;
  }, [fetch]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('biedingen' as any).delete().eq('id', id);
    if (error) throw error;
    await fetch();
  }, [fetch]);

  const acceptOffer = useCallback(async (id: string, opts: { wijsAndereAf: boolean }) => {
    const bieding = items.find(b => b.id === id);
    if (!bieding) throw new Error('Bieding niet gevonden');
    await update(id, { status: 'geaccepteerd', acceptedAt: new Date().toISOString() });
    if (opts.wijsAndereAf) {
      const andere = items.filter(b =>
        b.id !== id &&
        b.objectId === bieding.objectId &&
        ['concept', 'ontvangen', 'in_behandeling', 'tegenvoorstel_gedaan', 'aangepast_bod_gevraagd'].includes(b.status),
      );
      for (const a of andere) {
        await update(a.id, {
          status: 'afgewezen',
          rejectedAt: new Date().toISOString(),
          rejectedReason: 'Niet gekozen — ander bod geaccepteerd',
        });
      }
    }
  }, [items, update]);

  const rejectOffer = useCallback(async (id: string, reden: string) => {
    await update(id, { status: 'afgewezen', rejectedAt: new Date().toISOString(), rejectedReason: reden });
  }, [update]);

  const withdrawOffer = useCallback(async (id: string) => {
    await update(id, { status: 'ingetrokken', withdrawnAt: new Date().toISOString() });
  }, [update]);

  return useMemo(() => ({
    items, loading, error,
    refresh, create, update, remove,
    acceptOffer, rejectOffer, withdrawOffer,
  }), [items, loading, error, refresh, create, update, remove, acceptOffer, rejectOffer, withdrawOffer]);
}
