import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normaliseerPartijNaam } from '@/lib/kadaster/eigenaarInterpretatie';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { bouwKandidatenVoorSignaal, type BulkKandidaat } from '@/lib/offMarket/acquisitie/bulkBrief';
import {
  routeerPartijCampagne,
  type CampaignSnapshot,
  type PartyIdentity,
  type RoutingResult,
} from '@/lib/offMarket/acquisitie/partyCampaign';
import {
  sterkeRadarPartijSleutel,
  synthetischeRadarPartijId,
} from '@/lib/offMarket/acquisitie/partyIdentity';

const sb = supabase as any;
const DOELSTELLING = 'radar_acquisitie';

interface EigenaarRow {
  id: string;
  partij_type: 'natuurlijk_persoon' | 'rechtspersoon' | 'onbekend';
  naam: string;
  bedrijfsnaam: string | null;
  crm_relatie_id: string | null;
  dedupe_sleutel?: string | null;
}

interface KoppelingRow {
  signaal_id: string;
  eigenaar_id: string;
  betrouwbaarheid: number | null;
  eigenaar: EigenaarRow | null;
}

interface CampaignRow {
  id: string;
  eigenaar_id: string;
  doelstelling: string;
  status: CampaignSnapshot['status'];
  contact_status: CampaignSnapshot['contactStatus'];
  huidige_stap: CampaignSnapshot['huidigeStap'];
  laatste_koude_contact_op: string | null;
  herbenaderen_vanaf: string | null;
  cooldown_maanden: number;
  created_at: string;
}

interface CampaignObjectRow {
  campagne_id: string;
  signaal_id: string;
  rol: 'primary' | 'context' | 'archived';
  relevantiescore: number | null;
  noemen_in_volgend_contact: boolean;
}

interface ContextData {
  selectedLinks: KoppelingRow[];
  allLinks: KoppelingRow[];
  identityOwners: EigenaarRow[];
  partySignals: OffMarketSignaal[];
  partyLetters: OffMarketBrief[];
  campaigns: CampaignRow[];
  campaignObjects: CampaignObjectRow[];
  defaultCooldownMonths: number;
  primarySwitchThreshold: number;
}

export interface RadarBriefCampaignContext {
  partijNaam: string | null;
  eerderObject: string | null;
  heeftEerderContact: boolean;
  portefeuille: boolean;
  campagneId: string | null;
  campagneStatus: CampaignSnapshot['status'] | null;
  huidigeStap: CampaignSnapshot['huidigeStap'] | null;
  laatsteContactOp: string | null;
  primarySignaalId: string | null;
  primaryObjectAdres: string | null;
}

function normaal(value: string | null | undefined): string {
  return normaliseerPartijNaam((value ?? '').trim());
}

function campaignSnapshot(row: CampaignRow, objects: CampaignObjectRow[]): CampaignSnapshot {
  return {
    id: row.id,
    eigenaarId: row.eigenaar_id,
    doelstelling: row.doelstelling,
    status: row.status,
    contactStatus: row.contact_status,
    huidigeStap: row.huidige_stap,
    laatsteKoudeContactOp: row.laatste_koude_contact_op,
    herbenaderenVanaf: row.herbenaderen_vanaf,
    cooldownMaanden: row.cooldown_maanden,
    primarySignaalId: objects.find((o) => o.campagne_id === row.id && o.rol === 'primary')?.signaal_id ?? null,
  };
}

function kiesCampagne(rows: CampaignRow[]): CampaignRow | null {
  if (rows.length === 0) return null;
  const rang: Record<string, number> = { warm: 5, actief: 4, gepauzeerd: 3, afgerond_geen_reactie: 2, afgesloten: 1 };
  return [...rows].sort((a, b) => {
    const status = (rang[b.status] ?? 0) - (rang[a.status] ?? 0);
    if (status !== 0) return status;
    return (b.created_at ?? '').localeCompare(a.created_at ?? '');
  })[0];
}

async function laadContext(signalen: OffMarketSignaal[]): Promise<ContextData> {
  const signaalIds = [...new Set(signalen.map((s) => s.id))];
  const leeg: ContextData = {
    selectedLinks: [], allLinks: [], identityOwners: [], partySignals: [], partyLetters: [],
    campaigns: [], campaignObjects: [], defaultCooldownMonths: 6, primarySwitchThreshold: 15,
  };
  if (signaalIds.length === 0) return leeg;

  const [selectedLinksRes, selectedLettersRes] = await Promise.all([
    sb.from('eigenaar_koppelingen')
      .select('signaal_id,eigenaar_id,betrouwbaarheid,eigenaar:eigenaren(id,partij_type,naam,bedrijfsnaam,crm_relatie_id,dedupe_sleutel)')
      .in('signaal_id', signaalIds),
    sb.from('off_market_brieven').select('*').in('signaal_id', signaalIds).is('archived_at', null),
  ]);
  if (selectedLinksRes.error) throw selectedLinksRes.error;
  if (selectedLettersRes.error) throw selectedLettersRes.error;

  const selectedLinks = (selectedLinksRes.data ?? []) as KoppelingRow[];
  const selectedLetters = (selectedLettersRes.data ?? []) as OffMarketBrief[];
  const lettersPerSignaal = new Map<string, OffMarketBrief[]>();
  for (const brief of selectedLetters) {
    const arr = lettersPerSignaal.get(brief.signaal_id) ?? [];
    arr.push(brief);
    lettersPerSignaal.set(brief.signaal_id, arr);
  }

  const candidateKeys = [...new Set(signalen.flatMap((s) =>
    bouwKandidatenVoorSignaal(s, lettersPerSignaal.get(s.id) ?? [])
      .map(sterkeRadarPartijSleutel)
      .filter((key): key is string => Boolean(key)),
  ))];

  const identityOwnersRes = candidateKeys.length
    ? await sb.from('eigenaren')
      .select('id,partij_type,naam,bedrijfsnaam,crm_relatie_id,dedupe_sleutel')
      .in('dedupe_sleutel', candidateKeys)
      .is('archived_at', null)
    : { data: [], error: null };
  if (identityOwnersRes.error) throw identityOwnersRes.error;
  const identityOwners = (identityOwnersRes.data ?? []) as EigenaarRow[];

  const ownerIds = [...new Set([
    ...selectedLinks.map((r) => r.eigenaar_id),
    ...identityOwners.map((r) => r.id),
  ].filter(Boolean))];
  if (ownerIds.length === 0) return { ...leeg, selectedLinks, identityOwners };

  const [linksRes, campaignsRes, configRes] = await Promise.all([
    sb.from('eigenaar_koppelingen')
      .select('signaal_id,eigenaar_id,betrouwbaarheid,eigenaar:eigenaren(id,partij_type,naam,bedrijfsnaam,crm_relatie_id,dedupe_sleutel)')
      .in('eigenaar_id', ownerIds)
      .not('signaal_id', 'is', null),
    sb.from('off_market_benadercampagnes')
      .select('id,eigenaar_id,doelstelling,status,contact_status,huidige_stap,laatste_koude_contact_op,herbenaderen_vanaf,cooldown_maanden,created_at')
      .in('eigenaar_id', ownerIds)
      .eq('doelstelling', DOELSTELLING),
    sb.from('off_market_campaign_config')
      .select('sleutel,waarde')
      .in('sleutel', ['default_cooldown_months', 'primary_switch_threshold']),
  ]);
  if (linksRes.error) throw linksRes.error;
  if (campaignsRes.error) throw campaignsRes.error;
  if (configRes.error) throw configRes.error;

  const allLinks = (linksRes.data ?? []) as KoppelingRow[];
  const linkedSignalIds = [...new Set(allLinks.map((r) => r.signaal_id).filter(Boolean))];
  const campaigns = (campaignsRes.data ?? []) as CampaignRow[];
  const campaignIds = campaigns.map((c) => c.id);

  const [signalsRes, lettersRes, objectsRes] = await Promise.all([
    linkedSignalIds.length
      ? sb.from('off_market_signalen').select('*').in('id', linkedSignalIds)
      : Promise.resolve({ data: [], error: null }),
    linkedSignalIds.length
      ? sb.from('off_market_brieven').select('*').in('signaal_id', linkedSignalIds).is('archived_at', null)
      : Promise.resolve({ data: [], error: null }),
    campaignIds.length
      ? sb.from('off_market_campagne_objecten')
        .select('campagne_id,signaal_id,rol,relevantiescore,noemen_in_volgend_contact')
        .in('campagne_id', campaignIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (signalsRes.error) throw signalsRes.error;
  if (lettersRes.error) throw lettersRes.error;
  if (objectsRes.error) throw objectsRes.error;

  let defaultCooldownMonths = 6;
  let primarySwitchThreshold = 15;
  for (const row of configRes.data ?? []) {
    const waarde = Number(row.waarde);
    if (!Number.isFinite(waarde)) continue;
    if (row.sleutel === 'default_cooldown_months') defaultCooldownMonths = waarde;
    if (row.sleutel === 'primary_switch_threshold') primarySwitchThreshold = waarde;
  }

  return {
    selectedLinks, allLinks, identityOwners,
    partySignals: (signalsRes.data ?? []) as OffMarketSignaal[],
    partyLetters: (lettersRes.data ?? []) as OffMarketBrief[],
    campaigns,
    campaignObjects: (objectsRes.data ?? []) as CampaignObjectRow[],
    defaultCooldownMonths,
    primarySwitchThreshold,
  };
}

export function useRadarPartyCampaignContext(signalen: OffMarketSignaal[]) {
  const signaalIds = useMemo(() => [...new Set(signalen.map((s) => s.id))].sort(), [signalen]);
  const query = useQuery({
    queryKey: ['radar-party-campaign-context', signaalIds],
    enabled: signaalIds.length > 0,
    queryFn: () => laadContext(signalen),
  });

  const api = useMemo(() => {
    const data = query.data;

    const resolveParty = (kandidaat: BulkKandidaat): PartyIdentity => {
      if (!data) return { eigenaarId: null, matchStatus: 'onbekend', matchReden: 'Partijcontext wordt geladen.' };
      const links = data.selectedLinks.filter((l) => l.signaal_id === kandidaat.signaalId && l.eigenaar);
      const kandidaatNaam = normaal(kandidaat.bedrijfsnaam || kandidaat.naam);
      const exact = links.filter((l) => {
        const e = l.eigenaar!;
        return kandidaatNaam && [normaal(e.bedrijfsnaam), normaal(e.naam)].filter(Boolean).includes(kandidaatNaam);
      });
      const sterke = links.filter((l) => (l.betrouwbaarheid ?? 0) >= 90);
      const explicieteMatch = exact.length === 1 ? exact[0] : (links.length === 1 && sterke.length === 1 ? sterke[0] : null);
      if (explicieteMatch?.eigenaar) {
        return {
          eigenaarId: explicieteMatch.eigenaar_id,
          partijType: explicieteMatch.eigenaar.partij_type,
          crmRelatieId: explicieteMatch.eigenaar.crm_relatie_id,
          naam: explicieteMatch.eigenaar.naam,
          bedrijfsnaam: explicieteMatch.eigenaar.bedrijfsnaam,
          matchStatus: 'bevestigd',
          matchReden: exact.length === 1 ? 'Exacte expliciete eigenaar_koppeling.' : 'Enige sterke expliciete eigenaar_koppeling voor dit signaal.',
        };
      }
      if (links.length > 1) {
        return {
          eigenaarId: null,
          matchStatus: 'mogelijk_dezelfde_partij',
          matchReden: 'Meerdere juridische rechthebbenden/partijmatches gevonden; kies expliciet welke partij deze geadresseerde vertegenwoordigt.',
        };
      }

      const identityKey = sterkeRadarPartijSleutel(kandidaat);
      if (!identityKey) {
        return {
          eigenaarId: null,
          matchStatus: 'onbekend',
          matchReden: 'Onvoldoende sterke identiteit: naam/bedrijfsnaam én volledig postadres zijn vereist.',
        };
      }
      const owner = data.identityOwners.find((e) => e.dedupe_sleutel === identityKey);
      if (owner) {
        return {
          eigenaarId: owner.id,
          partijType: owner.partij_type,
          crmRelatieId: owner.crm_relatie_id,
          naam: owner.naam,
          bedrijfsnaam: owner.bedrijfsnaam,
          matchStatus: 'bevestigd',
          matchReden: 'Sterke bestaande Radar-identiteit op naam/bedrijfsnaam + volledig postadres.',
        };
      }
      return {
        eigenaarId: synthetischeRadarPartijId(identityKey),
        partijType: kandidaat.bedrijfsnaam ? 'rechtspersoon' : kandidaat.naam ? 'natuurlijk_persoon' : 'onbekend',
        naam: kandidaat.naam,
        bedrijfsnaam: kandidaat.bedrijfsnaam,
        matchStatus: 'bevestigd',
        matchReden: 'Nieuwe sterke Radar-identiteit; wordt pas bij expliciete briefbevestiging als partij vastgelegd.',
      };
    };

    const gegevensVoorPartij = (kandidaat: BulkKandidaat) => {
      const partij = resolveParty(kandidaat);
      if (!data || !partij.eigenaarId || partij.eigenaarId.startsWith('new-radar-party:')) {
        return { partij, ownerSignalIds: new Set<string>(), partijSignalen: [] as OffMarketSignaal[], partijBrieven: [] as OffMarketBrief[], campaignRow: null as CampaignRow | null };
      }
      const ownerSignalIds = new Set(
        data.allLinks.filter((l) => l.eigenaar_id === partij.eigenaarId).map((l) => l.signaal_id),
      );
      const partijSignalen = data.partySignals.filter((s) => ownerSignalIds.has(s.id));
      const partijBrieven = data.partyLetters.filter((b) => ownerSignalIds.has(b.signaal_id));
      const campaignRow = kiesCampagne(data.campaigns.filter((c) => c.eigenaar_id === partij.eigenaarId));
      return { partij, ownerSignalIds, partijSignalen, partijBrieven, campaignRow };
    };

    const route = (signaal: OffMarketSignaal, kandidaat: BulkKandidaat): RoutingResult => {
      const info = gegevensVoorPartij(kandidaat);
      if (!data || !info.partij.eigenaarId || info.partij.eigenaarId.startsWith('new-radar-party:')) {
        return routeerPartijCampagne({ signaal, partij: info.partij, campagne: null, partijBrieven: [] });
      }
      const campagne = info.campaignRow ? campaignSnapshot(info.campaignRow, data.campaignObjects) : null;
      return routeerPartijCampagne({
        signaal,
        partij: info.partij,
        campagne,
        partijBrieven: info.partijBrieven,
        partijSignalen: info.partijSignalen,
        defaultCooldownMaanden: data.defaultCooldownMonths,
        primarySwitchThreshold: data.primarySwitchThreshold,
      });
    };

    const briefContext = (kandidaat: BulkKandidaat): RadarBriefCampaignContext => {
      const info = gegevensVoorPartij(kandidaat);
      const verstuurd = info.partijBrieven
        .filter((b) => b.status === 'verstuurd')
        .sort((a, b) => (b.verzonden_op ?? b.updated_at).localeCompare(a.verzonden_op ?? a.updated_at));
      const laatste = verstuurd[0] ?? null;
      const primarySignaalId = info.campaignRow
        ? data?.campaignObjects.find((o) => o.campagne_id === info.campaignRow!.id && o.rol === 'primary')?.signaal_id ?? null
        : null;
      const primarySignaal = primarySignaalId ? info.partijSignalen.find((s) => s.id === primarySignaalId) ?? null : null;
      const eerderObject = laatste?.objectomschrijving?.trim() || laatste?.objectadres?.trim() || null;
      return {
        partijNaam: info.partij.bedrijfsnaam?.trim() || info.partij.naam?.trim() || kandidaat.bedrijfsnaam?.trim() || kandidaat.naam?.trim() || null,
        eerderObject,
        heeftEerderContact: Boolean(laatste),
        portefeuille: info.ownerSignalIds.size > 1,
        campagneId: info.campaignRow?.id ?? null,
        campagneStatus: info.campaignRow?.status ?? null,
        huidigeStap: info.campaignRow?.huidige_stap ?? null,
        laatsteContactOp: info.campaignRow?.laatste_koude_contact_op ?? laatste?.verzonden_op ?? laatste?.postdatum ?? null,
        primarySignaalId,
        primaryObjectAdres: primarySignaal ? (primarySignaal.adres || primarySignaal.titel || null) : null,
      };
    };

    return { resolveParty, route, briefContext };
  }, [query.data]);

  return useMemo(() => ({
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    resolveParty: api.resolveParty,
    route: api.route,
    briefContext: api.briefContext,
  }), [query.data, query.isLoading, query.isError, query.error, api]);
}
