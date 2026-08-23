import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  bouwAcquisitieConversieDashboard,
  type AcquisitieBriefMeta,
  type AcquisitieConversieEvent,
} from '@/lib/acquisitie/conversieDashboard';

export interface AcquisitieResponsRichtingModel {
  verkoperReacties: number;
  koperReacties: number;
  beideReacties: number;
  onbekendReacties: number;
  gekwalificeerdeVerkoperLeads: number;
  gekwalificeerdeKoperLeads: number;
  perVariant: Array<{
    sleutel: string;
    label: string;
    verkoperReacties: number;
    koperReacties: number;
    gekwalificeerdeVerkoperLeads: number;
    gekwalificeerdeKoperLeads: number;
  }>;
}

export function useAcquisitieConversieDashboard(jaar = new Date().getFullYear()) {
  const eventsQuery = useQuery({
    queryKey: ['acquisitie-conversie-dashboard', 'events'],
    queryFn: async (): Promise<AcquisitieConversieEvent[]> => {
      const { data, error } = await (supabase as any)
        .from('acquisitie_tracking_events_v1')
        .select('occurred_at,acquisitie_bron,event_type,brief_id,kanaal,status,telt_verzonden_communicatie,telt_reactie,telt_positieve_reactie')
        .not('brief_id', 'is', null)
        .order('occurred_at', { ascending: true });
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieConversieEvent[];
    },
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });

  const briefMetaQuery = useQuery({
    queryKey: ['acquisitie-conversie-dashboard', 'brief-meta'],
    queryFn: async (): Promise<AcquisitieBriefMeta[]> => {
      const { data, error } = await (supabase as any)
        .from('off_market_brieven')
        .select('id,campagne_stap,copy_profiel,copy_variant_key,copy_variant_code,copy_hypothese,respons_richting')
        .is('archived_at', null);
      if (error) throw new Error(error.message);
      return (data ?? []) as AcquisitieBriefMeta[];
    },
    staleTime: 0,
    refetchOnWindowFocus: 'always',
  });

  const model = useMemo(
    () => bouwAcquisitieConversieDashboard(eventsQuery.data ?? [], briefMetaQuery.data ?? [], jaar),
    [eventsQuery.data, briefMetaQuery.data, jaar],
  );

  const richting = useMemo<AcquisitieResponsRichtingModel>(() => {
    const events = eventsQuery.data ?? [];
    const metas = (briefMetaQuery.data ?? []) as Array<AcquisitieBriefMeta & { respons_richting?: string | null }>;
    const metaPerBrief = new Map(metas.map(meta => [meta.id, meta]));

    const eersteVerzending = new Map<string, AcquisitieConversieEvent>();
    for (const event of events) {
      if (!event.brief_id || event.telt_verzonden_communicatie !== true) continue;
      const bestaand = eersteVerzending.get(event.brief_id);
      if (!bestaand || new Date(event.occurred_at).getTime() < new Date(bestaand.occurred_at).getTime()) {
        eersteVerzending.set(event.brief_id, event);
      }
    }
    const cohortIds = new Set(
      [...eersteVerzending.entries()]
        .filter(([, event]) => new Date(event.occurred_at).getFullYear() === jaar)
        .map(([id]) => id),
    );

    const reactiePerBrief = new Map<string, AcquisitieConversieEvent>();
    for (const event of events) {
      if (!event.brief_id || event.telt_reactie !== true || !cohortIds.has(event.brief_id)) continue;
      reactiePerBrief.set(event.brief_id, event);
    }

    const result: AcquisitieResponsRichtingModel = {
      verkoperReacties: 0,
      koperReacties: 0,
      beideReacties: 0,
      onbekendReacties: 0,
      gekwalificeerdeVerkoperLeads: 0,
      gekwalificeerdeKoperLeads: 0,
      perVariant: [],
    };
    const variantMap = new Map<string, AcquisitieResponsRichtingModel['perVariant'][number]>();

    for (const [briefId, event] of reactiePerBrief.entries()) {
      const meta = metaPerBrief.get(briefId);
      const r = meta?.respons_richting ?? 'overig_onbekend';
      const isVerkoper = r === 'verkoper' || r === 'beide';
      const isKoper = r === 'koper' || r === 'beide';
      const isQualified = event.status === 'gesprek_gepland';
      if (r === 'beide') result.beideReacties += 1;
      else if (r === 'verkoper') result.verkoperReacties += 1;
      else if (r === 'koper') result.koperReacties += 1;
      else result.onbekendReacties += 1;
      if (isQualified && isVerkoper) result.gekwalificeerdeVerkoperLeads += 1;
      if (isQualified && isKoper) result.gekwalificeerdeKoperLeads += 1;

      if (meta?.copy_variant_key) {
        const code = meta.copy_variant_code ?? '?';
        const row = variantMap.get(meta.copy_variant_key) ?? {
          sleutel: meta.copy_variant_key,
          label: `${meta.copy_profiel ?? 'Profiel'} · ${meta.campagne_stap ?? 'touchpoint'} · Variant ${code}`,
          verkoperReacties: 0,
          koperReacties: 0,
          gekwalificeerdeVerkoperLeads: 0,
          gekwalificeerdeKoperLeads: 0,
        };
        if (isVerkoper) row.verkoperReacties += 1;
        if (isKoper) row.koperReacties += 1;
        if (isQualified && isVerkoper) row.gekwalificeerdeVerkoperLeads += 1;
        if (isQualified && isKoper) row.gekwalificeerdeKoperLeads += 1;
        variantMap.set(meta.copy_variant_key, row);
      }
    }
    result.perVariant = [...variantMap.values()].sort((a, b) => a.label.localeCompare(b.label));
    return result;
  }, [eventsQuery.data, briefMetaQuery.data, jaar]);

  return {
    model,
    richting,
    isLoading: eventsQuery.isLoading || briefMetaQuery.isLoading,
    error: eventsQuery.error ?? briefMetaQuery.error ?? null,
  };
}
