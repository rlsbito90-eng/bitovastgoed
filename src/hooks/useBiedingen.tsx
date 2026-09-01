import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Bieding, BiedingStatus } from '@/lib/biedingen/types';
import { biedingFromDb, biedingToDb } from '@/lib/biedingen/db';
import { logSystemContactMoment } from '@/lib/contactMoments';
import { fmtEur } from '@/lib/biedingen/format';
import { BIEDING_TYPE_LABELS, BIEDING_STATUS_LABELS } from '@/lib/biedingen/types';
import { useDataStore } from '@/hooks/useDataStore';
import { getNegotiationPositions, getOfferProgressTarget, shouldAdvanceCandidate } from '@/lib/biedingen/progression';
import type { PipelineKandidaat } from '@/data/mock-data';

type Scope =
  | { objectId: string }
  | { dealId: string }
  | { relatieId: string }
  | { all: true };

export type AcceptOfferResult = {
  dealId?: string;
  objectId: string;
  relatieId: string;
};

export function useBiedingen(scope: Scope) {
  const { pipelineKandidaten, addPipelineKandidaat, updatePipelineKandidaat } = useDataStore();
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

  const syncKandidaatUitBieding = useCallback(async (bieding: Bieding) => {
    const target = getOfferProgressTarget(bieding);
    if (!target) return;

    const existing = pipelineKandidaten.find(k => k.objectId === bieding.objectId && k.relatieId === bieding.relatieId);
    const offerUniverse = [...items.filter(item => item.id !== bieding.id), bieding];
    const latestBuyer = getNegotiationPositions(offerUniverse)
      .find(position => position.relatieId === bieding.relatieId)?.latestBuyer ?? null;
    const buyerProjection: Partial<PipelineKandidaat> = latestBuyer
      ? {
          biedingBedrag: latestBuyer.bedrag ?? undefined,
          biedingVoorwaarden: latestBuyer.voorwaarden ?? undefined,
          gewensteLevering: latestBuyer.gewensteLevering ?? undefined,
          ...(latestBuyer.financieringsvoorbehoud === 'ja' ? { financieringsvoorbehoud: true } : {}),
          ...(latestBuyer.financieringsvoorbehoud === 'geen' ? { financieringsvoorbehoud: false } : {}),
        }
      : {};

    if (!existing) {
      const created = await addPipelineKandidaat({
        objectId: bieding.objectId,
        relatieId: bieding.relatieId,
        pipelineFase: target,
        interesseNiveau: 'warm',
        teaserVerstuurd: false,
        ndaVerstuurd: false,
        ndaGetekend: false,
        informatieGedeeld: false,
        feeAkkoord: false,
        ...buyerProjection,
      });
      if (created) await updatePipelineKandidaat(created.id, { pipelineFase: target });
      return;
    }

    const patch: Partial<PipelineKandidaat> = { ...buyerProjection };
    if (shouldAdvanceCandidate(existing.pipelineFase, target)) {
      patch.pipelineFase = target;
      if (existing.pipelineFase === 'afgevallen') patch.redenAfgevallen = '';
    }
    if (Object.keys(patch).length > 0) await updatePipelineKandidaat(existing.id, patch);
  }, [items, pipelineKandidaten, addPipelineKandidaat, updatePipelineKandidaat]);

  const syncKandidaatVeilig = useCallback(async (bieding: Bieding) => {
    try {
      await syncKandidaatUitBieding(bieding);
    } catch (e) {
      // De bieding zelf is de bron en moet nooit dubbel worden aangemaakt omdat
      // een afgeleide pipelineprojectie faalt. Laat de save slagen en log de drift.
      console.warn('Bieding opgeslagen; kandidaat-pipeline synchronisatie overgeslagen:', e);
    }
  }, [syncKandidaatUitBieding]);

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
    await syncKandidaatVeilig(created);
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
  }, [fetch, syncKandidaatVeilig]);

  const update = useCallback(async (id: string, patch: Partial<Bieding>) => {
    const { data, error } = await supabase
      .from('biedingen' as any)
      .update(biedingToDb(patch) as any)
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) throw error;
    const updated = biedingFromDb(data);
    await syncKandidaatVeilig(updated);
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
  }, [fetch, syncKandidaatVeilig]);

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('biedingen' as any).delete().eq('id', id);
    if (error) throw error;
    await fetch();
  }, [fetch]);

  /**
   * Canonical transaction boundary.
   *
   * A Deal is deliberately NOT created for every interested candidate or
   * indicative bid. The Deal starts when a bid is accepted and the buyer
   * becomes preferred bidder / enters an exclusive transaction position.
   * The database function performs the complete transition atomically so the
   * Object Pipeline, bid and Deal cannot drift apart halfway through a save.
   */
  const acceptOffer = useCallback(async (
    id: string,
    opts: { wijsAndereAf: boolean },
  ): Promise<AcceptOfferResult> => {
    const bieding = items.find(b => b.id === id);
    if (!bieding) throw new Error('Bieding niet gevonden');

    const { data, error } = await (supabase as any).rpc('accept_bieding_en_start_deal', {
      p_bieding_id: id,
      p_wijs_andere_af: opts.wijsAndereAf,
    });
    if (error) throw error;

    await syncKandidaatVeilig({ ...bieding, status: 'geaccepteerd' });

    const row = Array.isArray(data) ? data[0] : data;
    const dealId = row?.deal_id as string | undefined;

    await logSystemContactMoment({
      type: 'bod_ontvangen',
      title: `Bieding geaccepteerd · Preferred bidder · ${fmtEur(bieding.bedrag)}`,
      description: 'Transactiepositie gestart; object doorgezet naar Preferred bidder / exclusiviteit.',
      objectId: bieding.objectId,
      relatieId: bieding.relatieId,
      dealId: dealId ?? null,
    });

    await fetch();
    return {
      dealId,
      objectId: bieding.objectId,
      relatieId: bieding.relatieId,
    };
  }, [items, fetch, syncKandidaatVeilig]);

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
