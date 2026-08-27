// V1B — Hook: brieven voor alle signalen in de acquisitieselectie + per-
// signaal readiness. Eén bulk-query in plaats van N losse hooks.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import {
  bepaalSignaalReadiness, aggregeerKpis,
  type SignaalReadiness, type AcquisitieKpis,
} from '@/lib/offMarket/acquisitie/readiness';
import { pasCanoniekeRechthebbendenToeOpReadiness } from '@/lib/offMarket/acquisitie/readinessRechthebbenden';
import {
  pasKadasterAanwezigheidToeOpReadiness,
  type KadasterReadinessAanwezigheid,
} from '@/lib/offMarket/acquisitie/kadasterReadiness';

type ProductieKoppeling = {
  brief_id: string;
  brief_versie_id: string;
  batch_id: string;
};

type ProductieBatchProjectie = {
  id: string;
  status: 'concept' | 'documenten_gegenereerd' | 'geprint' | 'gedeeltelijk_gepost' | 'gepost' | 'geannuleerd';
  printdatum: string | null;
  verzenddatum: string | null;
};

type ProductieVersieProjectie = {
  id: string;
  status: 'actief' | 'verzonden' | 'vervallen';
  verzonden_op: string | null;
};

function datumdeel(iso: string | null | undefined): string | null {
  return iso ? iso.slice(0, 10) : null;
}

/**
 * Definitieve Productiekern-brieven zijn databasebreed immutable. De fysieke
 * print/post-status leeft daarom bewust op BAT + briefversie en niet op de
 * legacy briefrij. Voor de operationele werkbak projecteren we die canonieke
 * status read-only over de legacy rij heen, zonder de briefrij te muteren.
 */
async function projecteerProductiekernStatus(
  brieven: OffMarketBrief[],
): Promise<OffMarketBrief[]> {
  const formeleIds = brieven
    .filter((brief) => brief.status === 'definitief' && Boolean(brief.briefnummer?.trim()))
    .map((brief) => brief.id);
  if (formeleIds.length === 0) return brieven;

  const { data: koppelingenData, error: koppelingenError } = await (supabase as any)
    .from('off_market_printbatch_brieven')
    .select('brief_id,brief_versie_id,batch_id')
    .in('brief_id', formeleIds)
    .is('verwijderd_op', null);
  if (koppelingenError) throw new Error(koppelingenError.message);

  const koppelingen = (koppelingenData ?? []) as ProductieKoppeling[];
  if (koppelingen.length === 0) return brieven;

  const batchIds = [...new Set(koppelingen.map((k) => k.batch_id))];
  const versieIds = [...new Set(koppelingen.map((k) => k.brief_versie_id))];
  const [batchesResultaat, versiesResultaat] = await Promise.all([
    (supabase as any)
      .from('off_market_printbatches')
      .select('id,status,printdatum,verzenddatum')
      .in('id', batchIds),
    (supabase as any)
      .from('off_market_brief_versies')
      .select('id,status,verzonden_op')
      .in('id', versieIds),
  ]);
  if (batchesResultaat.error) throw new Error(batchesResultaat.error.message);
  if (versiesResultaat.error) throw new Error(versiesResultaat.error.message);

  const batches = (batchesResultaat.data ?? []) as ProductieBatchProjectie[];
  const versies = (versiesResultaat.data ?? []) as ProductieVersieProjectie[];
  const batchPerId = new Map(batches.map((batch) => [batch.id, batch] as const));
  const versiePerId = new Map(versies.map((versie) => [versie.id, versie] as const));
  const koppelingenPerBrief = new Map<string, ProductieKoppeling[]>();
  for (const koppeling of koppelingen) {
    const bestaand = koppelingenPerBrief.get(koppeling.brief_id) ?? [];
    bestaand.push(koppeling);
    koppelingenPerBrief.set(koppeling.brief_id, bestaand);
  }

  const rang: Record<ProductieBatchProjectie['status'], number> = {
    geannuleerd: 0,
    concept: 1,
    documenten_gegenereerd: 2,
    geprint: 3,
    gedeeltelijk_gepost: 4,
    gepost: 5,
  };

  return brieven.map((brief) => {
    const kandidaten = (koppelingenPerBrief.get(brief.id) ?? [])
      .map((koppeling) => ({
        koppeling,
        batch: batchPerId.get(koppeling.batch_id),
        versie: versiePerId.get(koppeling.brief_versie_id),
      }))
      .filter((item) => item.batch && item.batch.status !== 'geannuleerd')
      .sort((a, b) => rang[b.batch!.status] - rang[a.batch!.status]);
    const actueel = kandidaten[0];
    if (!actueel?.batch || !actueel.versie) return brief;

    const { batch, versie } = actueel;
    if (versie.status === 'verzonden' || batch.status === 'gepost') {
      const verzondenOp = versie.verzonden_op ?? batch.verzenddatum ?? brief.verzonden_op;
      return {
        ...brief,
        status: 'verstuurd',
        verzendstatus: 'gepost',
        printdatum: datumdeel(batch.printdatum) ?? brief.printdatum,
        postdatum: datumdeel(verzondenOp) ?? brief.postdatum,
        verzonden_op: verzondenOp ?? null,
      };
    }

    if (batch.status === 'geprint' || batch.status === 'gedeeltelijk_gepost') {
      return {
        ...brief,
        verzendstatus: 'geprint',
        printdatum: datumdeel(batch.printdatum) ?? brief.printdatum,
      };
    }

    return brief;
  });
}

export function useBrievenVoorSignalen(signaalIds: string[]) {
  const ids = useMemo(() => [...signaalIds].sort(), [signaalIds]);
  return useQuery({
    queryKey: ['off-market-brieven-bulk', ids],
    enabled: ids.length > 0,
    queryFn: async (): Promise<OffMarketBrief[]> => {
      const { data, error } = await (supabase as any)
        .from('off_market_brieven')
        .select('*')
        .in('signaal_id', ids)
        .is('archived_at', null);
      if (error) throw new Error(error.message);
      return projecteerProductiekernStatus((data ?? []) as OffMarketBrief[]);
    },
  });
}

function useKadasterReadinessAanwezigheid(signaalIds: string[]) {
  const ids = useMemo(() => [...signaalIds].sort(), [signaalIds]);
  return useQuery({
    queryKey: ['off-market-kadaster-readiness-aanwezigheid', ids],
    enabled: ids.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<Map<string, KadasterReadinessAanwezigheid>> => {
      const db = supabase as any;
      const [recordsResultaat, documentenResultaat] = await Promise.all([
        db.from('kadaster_data_records')
          .select('signaal_id')
          .in('signaal_id', ids)
          .eq('product_code', 'rechten')
          .in('status', ['geleverd', 'gedeeltelijk']),
        db.from('kadaster_documenten')
          .select('signaal_id,product_codes')
          .in('signaal_id', ids),
      ]);
      if (recordsResultaat.error) throw new Error(recordsResultaat.error.message);
      if (documentenResultaat.error) throw new Error(documentenResultaat.error.message);

      const rechten = new Set<string>();
      for (const rij of recordsResultaat.data ?? []) {
        if (typeof rij.signaal_id === 'string') rechten.add(rij.signaal_id);
      }
      const berichten = new Set<string>();
      for (const rij of documentenResultaat.data ?? []) {
        if (typeof rij.signaal_id === 'string' && Array.isArray(rij.product_codes) && rij.product_codes.includes('rechten')) {
          berichten.add(rij.signaal_id);
        }
      }

      return new Map(ids.map(id => [id, {
        rechtenAanwezig: rechten.has(id),
        internBerichtAanwezig: berichten.has(id),
      }]));
    },
  });
}

export interface AcquisitieReadinessResultaat {
  perSignaal: Map<string, SignaalReadiness>;
  lijst: Array<{ signaal: OffMarketSignaal; readiness: SignaalReadiness }>;
  kpis: AcquisitieKpis;
}

export function useAcquisitieReadiness(
  signalen: OffMarketSignaal[],
): AcquisitieReadinessResultaat & { isLoading: boolean } {
  const ids = useMemo(() => signalen.map(s => s.id), [signalen]);
  const { data: brieven = [], isLoading: brievenLaden } = useBrievenVoorSignalen(ids);
  const { data: kadasterAanwezigheid = new Map<string, KadasterReadinessAanwezigheid>(), isLoading: kadasterLaden } = useKadasterReadinessAanwezigheid(ids);

  const result = useMemo(() => {
    const brievenPerSignaal = new Map<string, OffMarketBrief[]>();
    for (const b of brieven) {
      const arr = brievenPerSignaal.get(b.signaal_id) ?? [];
      arr.push(b);
      brievenPerSignaal.set(b.signaal_id, arr);
    }
    const perSignaal = new Map<string, SignaalReadiness>();
    const lijst: Array<{ signaal: OffMarketSignaal; readiness: SignaalReadiness }> = [];
    for (const s of signalen) {
      const signaalBrieven = brievenPerSignaal.get(s.id) ?? [];
      const basis = bepaalSignaalReadiness({
        signaal: s,
        brieven: signaalBrieven,
      });
      const metRechthebbenden = pasCanoniekeRechthebbendenToeOpReadiness(s, signaalBrieven, basis);
      const r = pasKadasterAanwezigheidToeOpReadiness(metRechthebbenden, kadasterAanwezigheid.get(s.id));
      perSignaal.set(s.id, r);
      lijst.push({ signaal: s, readiness: r });
    }
    const kpis = aggregeerKpis(lijst.map(x => x.readiness));
    return { perSignaal, lijst, kpis };
  }, [signalen, brieven, kadasterAanwezigheid]);

  return { ...result, isLoading: brievenLaden || kadasterLaden };
}
