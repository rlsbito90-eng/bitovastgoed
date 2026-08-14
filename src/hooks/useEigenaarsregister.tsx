import { useEffect, useMemo, useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { KadasterEigenaarVoorstel } from '@/lib/kadaster/eigenaarInterpretatie';
import { normaliseerPartijNaam } from '@/lib/kadaster/eigenaarInterpretatie';

const sb = supabase as any;

export interface EigenaarRegisterRecord {
  id: string;
  partij_type: 'natuurlijk_persoon' | 'rechtspersoon' | 'onbekend';
  naam: string;
  bedrijfsnaam: string | null;
  voornamen: string | null;
  voorletters: string | null;
  kvk_nummer: string | null;
  adres: string | null;
  postcode: string | null;
  plaats: string | null;
  land: string | null;
  telefoon: string | null;
  email: string | null;
  website: string | null;
  linkedin_url: string | null;
  bron: string;
  bron_betrouwbaarheid: number | null;
  bron_details: Record<string, unknown>;
  dedupe_sleutel: string | null;
  crm_relatie_id: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EigenaarKoppelingRecord {
  id: string;
  eigenaar_id: string;
  vastgoedkans_id: string | null;
  signaal_id: string | null;
  object_id: string | null;
  kadaster_record_id: string | null;
  rol: string;
  rechtsoort: string | null;
  aandeel: string | null;
  bron: string;
  betrouwbaarheid: number | null;
  eigenaar: EigenaarRegisterRecord | null;
}

function compact(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function normaliseerPostcode(value: string | null | undefined): string {
  return compact(value).replace(/\s+/g, '').toUpperCase();
}

function normaliseerAdres(value: string | null | undefined): string {
  return compact(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('nl-NL')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Alleen sterke identiteiten mogen automatisch over dossiers heen worden samengevoegd.
 * - KvK is deterministisch voor rechtspersonen.
 * - Volledige genormaliseerde naam + eigenaaradres + postcode is sterk genoeg voor
 *   een idempotente acquisitie-identiteit, maar naam alleen is dat nadrukkelijk niet.
 */
export function eigenaarDedupeSleutel(voorstel: KadasterEigenaarVoorstel): string | null {
  const kvk = compact(voorstel.kvkNummer).replace(/\D/g, '');
  if (kvk) return `kvk:${kvk}`;

  const naam = normaliseerPartijNaam(voorstel.bedrijfsnaam ?? voorstel.naam);
  const adres = normaliseerAdres(voorstel.adresRegels[0]);
  const postcode = normaliseerPostcode(voorstel.postcode);
  if (naam && adres && postcode) return `naam_adres:${naam}|${postcode}|${adres}`;
  return null;
}

function partijType(voorstel: KadasterEigenaarVoorstel): EigenaarRegisterRecord['partij_type'] {
  if (voorstel.persoonType === 'natuurlijk') return 'natuurlijk_persoon';
  if (voorstel.persoonType === 'rechtspersoon') return 'rechtspersoon';
  return 'onbekend';
}

function displayNaam(voorstel: KadasterEigenaarVoorstel): string {
  if (voorstel.bedrijfsnaam) return voorstel.bedrijfsnaam;
  if (voorstel.voorletters) {
    const parts = voorstel.naam.trim().split(/\s+/);
    const achternaam = parts.at(-1) ?? voorstel.naam;
    return `${voorstel.voorletters} ${achternaam}`.trim();
  }
  return voorstel.naam;
}

function recordPayload(voorstel: KadasterEigenaarVoorstel, dedupeSleutel: string | null) {
  return {
    partij_type: partijType(voorstel),
    naam: displayNaam(voorstel),
    bedrijfsnaam: voorstel.bedrijfsnaam || null,
    voornamen: voorstel.voornamen || null,
    voorletters: voorstel.voorletters || null,
    kvk_nummer: compact(voorstel.kvkNummer) || null,
    adres: voorstel.adresRegels[0] || null,
    postcode: compact(voorstel.postcode) || null,
    plaats: compact(voorstel.plaats) || null,
    bron: 'kadaster',
    bron_betrouwbaarheid: 95,
    dedupe_sleutel: dedupeSleutel,
    bron_details: {
      kadaster_record_ids: voorstel.bronRecordIds,
      bron_adressen: voorstel.bronAdressen,
      kadastrale_aanduiding: voorstel.kadastraleAanduiding,
      rechtsoort: voorstel.rechtsoort,
      aandeel: voorstel.aandeel,
    },
  };
}

async function haalVastgoedkansKoppelingen(vastgoedkansId: string): Promise<EigenaarKoppelingRecord[]> {
  const { data, error } = await sb
    .from('eigenaar_koppelingen')
    .select('id,eigenaar_id,vastgoedkans_id,signaal_id,object_id,kadaster_record_id,rol,rechtsoort,aandeel,bron,betrouwbaarheid,eigenaar:eigenaren(*)')
    .eq('vastgoedkans_id', vastgoedkansId);
  if (error) throw error;
  return (data ?? []) as EigenaarKoppelingRecord[];
}

async function synchroniseerVastgoedkansEigenaren(vastgoedkansId: string, voorstellen: KadasterEigenaarVoorstel[]) {
  const bestaandeKoppelingen = await haalVastgoedkansKoppelingen(vastgoedkansId);
  const gekoppeldPerNaam = new Map<string, EigenaarKoppelingRecord>();
  for (const koppeling of bestaandeKoppelingen) {
    const e = koppeling.eigenaar;
    const naam = normaliseerPartijNaam(e?.bedrijfsnaam ?? e?.naam);
    if (naam) gekoppeldPerNaam.set(naam, koppeling);
  }

  for (const voorstel of voorstellen) {
    const naamNorm = normaliseerPartijNaam(voorstel.bedrijfsnaam ?? voorstel.naam);
    const dedupeSleutel = eigenaarDedupeSleutel(voorstel);
    let eigenaar = gekoppeldPerNaam.get(naamNorm)?.eigenaar ?? null;

    if (!eigenaar && dedupeSleutel) {
      const { data, error } = await sb
        .from('eigenaren')
        .select('*')
        .eq('dedupe_sleutel', dedupeSleutel)
        .is('archived_at', null)
        .maybeSingle();
      if (error) throw error;
      eigenaar = data as EigenaarRegisterRecord | null;
    }

    const payload = recordPayload(voorstel, dedupeSleutel);
    if (!eigenaar) {
      const { data, error } = await sb.from('eigenaren').insert(payload).select('*').single();
      if (error) throw error;
      eigenaar = data as EigenaarRegisterRecord;
    } else {
      const patch = Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== null && value !== '' && value !== undefined));
      const { data, error } = await sb.from('eigenaren').update(patch).eq('id', eigenaar.id).select('*').single();
      if (error) throw error;
      eigenaar = data as EigenaarRegisterRecord;
    }

    const alGekoppeld = bestaandeKoppelingen.some((k) => k.eigenaar_id === eigenaar!.id);
    if (!alGekoppeld) {
      const { error } = await sb.from('eigenaar_koppelingen').insert({
        eigenaar_id: eigenaar.id,
        vastgoedkans_id: vastgoedkansId,
        kadaster_record_id: voorstel.bronRecordIds[0] ?? null,
        rol: 'rechthebbende',
        rechtsoort: voorstel.rechtsoort || null,
        aandeel: voorstel.aandeel || null,
        bron: 'kadaster',
        betrouwbaarheid: 95,
      });
      if (error) throw error;
      bestaandeKoppelingen.push({
        id: `nieuw:${eigenaar.id}`,
        eigenaar_id: eigenaar.id,
        vastgoedkans_id: vastgoedkansId,
        signaal_id: null,
        object_id: null,
        kadaster_record_id: voorstel.bronRecordIds[0] ?? null,
        rol: 'rechthebbende',
        rechtsoort: voorstel.rechtsoort || null,
        aandeel: voorstel.aandeel || null,
        bron: 'kadaster',
        betrouwbaarheid: 95,
        eigenaar,
      });
    }
  }

  const namen = voorstellen.map(displayNaam).filter(Boolean);
  if (namen.length > 0) {
    const vandaag = new Date().toISOString().slice(0, 10);
    const { error } = await sb.from('vastgoedkansen').update({
      eigenaar_naam: namen.join('; '),
      eigenaar_bron: 'Kadaster',
      eigenaar_laatst_gecontroleerd_op: vandaag,
    }).eq('id', vastgoedkansId);
    if (error) throw error;
  }

  return haalVastgoedkansKoppelingen(vastgoedkansId);
}

export function useVastgoedkansEigenaarsregister(
  vastgoedkansId: string,
  voorstellen: KadasterEigenaarVoorstel[],
) {
  const queryClient = useQueryClient();
  const laatsteSync = useRef('');
  const signature = useMemo(
    () => voorstellen.map((v) => `${v.sleutel}:${v.bronRecordIds.join(',')}:${v.adresRegels.join('|')}`).sort().join('||'),
    [voorstellen],
  );

  const query = useQuery({
    queryKey: ['eigenaarsregister', 'vastgoedkans', vastgoedkansId],
    enabled: !!vastgoedkansId,
    queryFn: () => haalVastgoedkansKoppelingen(vastgoedkansId),
  });

  const sync = useMutation({
    mutationFn: () => synchroniseerVastgoedkansEigenaren(vastgoedkansId, voorstellen),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['eigenaarsregister', 'vastgoedkans', vastgoedkansId] }),
        queryClient.invalidateQueries({ queryKey: ['vastgoedkansen'] }),
      ]);
    },
    onError: () => {
      laatsteSync.current = '';
    },
  });

  useEffect(() => {
    if (!signature || voorstellen.length === 0 || sync.isPending) return;
    if (laatsteSync.current === signature) return;
    laatsteSync.current = signature;
    sync.mutate();
  }, [signature, voorstellen.length, sync.isPending]); // mutation is intentionally automatic: this only stores free acquisition data, never a paid call or CRM relation.

  return {
    koppelingen: query.data ?? [],
    isLoading: query.isLoading,
    syncIsPending: sync.isPending,
    syncError: sync.error,
    retrySync: () => {
      laatsteSync.current = '';
      sync.mutate();
    },
  };
}
