import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { normaliseerPartijNaam } from '@/lib/kadaster/eigenaarInterpretatie';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { BulkKandidaat } from '@/lib/offMarket/acquisitie/bulkBrief';
import {
  routeerPartijCampagne,
  type CampaignSnapshot,
  type PartyIdentity,
  type RoutingResult,
} from '@/lib/offMarket/acquisitie/partyCampaign';

const sb = supabase as any;
const DOELSTELLING = 'radar_acquisitie';

interface EigenaarRow {
  id: string;
  partij_type: 'natuurlijk_persoon' | 'rechtspersoon' | 'onbekend';
  naam: string;
  bedrijfsnaam: string | null;
  crm_relatie_id: string | null;
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
  partySignals: OffMarketSignaal[];
  partyLetters: OffMarketBrief[];
  campaigns: CampaignRow[];
  campaignObjects: CampaignObjectRow[];
  defaultCooldownMonths: number;
  primarySwitchThreshold: number;
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

async function laadContext(signaalIds: string[]): Promise<ContextData> {
  if (signaalIds.length === 0) {
    return {
      selectedLinks: [], allLinks: [], partySignals: [], partyLetters: [], campaigns: [], campaignObjects: [],
      defaultCooldownMonths: 6, primarySwitchThreshold: 15,
    };
  }

  const { data: selectedLinksData, error: selectedLinksError } = await sb
    .from('eigenaar_koppelingen')
    .select('signaal_id,eigenaar_id,betrouwbaarheid,eigenaar:eigenaren(id,partij_type,naam,bedrijfsnaam,crm_relatie_id)')
    .in('signaal_id', signaalIds);
  if (selectedLinksError) throw selectedLinksError;
  const selectedLinks = (selectedLinksData ?? []) as KoppelingRow[];
  const ownerIds = [...new Set(selectedLinks.map((r) => r.eigenaar_id).filter(Boolean))];

  if (ownerIds.length === 0) {
    return {
      selectedLinks, allLinks: [], partySignals: [], partyLetters: [], campaigns: [], campaignObjects: [],
      defaultCooldownMonths: 6, primarySwitchThreshold: 15,
    };
  }

  const [linksRes, campaignsRes, configRes] = await Promise.all([
    sb.from('eigenaar_koppelingen')
      .select('signaal_id,eigenaar_id,betrouwbaarheid,eigenaar:eigenaren(id,partij_type,naam,bedrijfsnaam,crm_relatie_id)')
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

  const allLinks = (linksRes.data ?? []) as KoppelingRow[];
  const linkedSignalIds = [...new Set(allLinks.map((r) => r.signaal_id).filter(Boolean))];
  const campaignIds = ((campaignsRes.data ?? []) as CampaignRow[]).map((c) => c.id);

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
    selectedLinks,
    allLinks,
    partySignals: (signalsRes.data ?? []) as OffMarketSignaal[],
    partyLetters: (lettersRes.data ?? []) as OffMarketBrief[],
    campaigns: (campaignsRes.data ?? []) as CampaignRow[],
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
    queryFn: () => laadContext(signaalIds),
  });

  const api = useMemo(() => {
    const data = query.data;
    const resolveParty = (kandidaat: BulkKandidaat): PartyIdentity => {
      if (!data) return { eigenaarId: null, matchStatus: 'onbekend', matchReden: 'Partijcontext wordt geladen.' };
      const links = data.selectedLinks.filter((l) => l.signaal_id === kandidaat.signaalId && l.eigenaar);
      if (links.length === 0) {
        return {
          eigenaarId: null,
          matchStatus: 'onbekend',
          matchReden: 'Geen stabiele party/entity ID gekoppeld aan dit signaal. Eerst partijmatch beoordelen.',
        };
      }

      const kandidaatNaam = normaal(kandidaat.bedrijfsnaam || kandidaat.naam);
      const exact = links.filter((l) => {
        const e = l.eigenaar!;
        return kandidaatNaam && [normaal(e.bedrijfsnaam), normaal(e.naam)].filter(Boolean).includes(kandidaatNaam);
      });
      const sterke = links.filter((l) => (l.betrouwbaarheid ?? 0) >= 90);
      const matches = exact.length === 1 ? exact : (links.length === 1 && sterke.length === 1 ? sterke : []);
      if (matches.length !== 1) {
        return {
          eigenaarId: null,
          matchStatus: 'mogelijk_dezelfde_partij',
          matchReden: links.length > 1
            ? 'Meerdere juridische rechthebbenden/partijmatches gevonden; kies expliciet welke partij deze geadresseerde vertegenwoordigt.'
            : 'Partijmatch is niet betrouwbaar genoeg om automatisch een campagne te kiezen.',
        };
      }
      const match = matches[0];
      return {
        eigenaarId: match.eigenaar_id,
        partijType: match.eigenaar?.partij_type,
        crmRelatieId: match.eigenaar?.crm_relatie_id,
        naam: match.eigenaar?.naam,
        bedrijfsnaam: match.eigenaar?.bedrijfsnaam,
        matchStatus: 'bevestigd',
        matchReden: exact.length === 1 ? 'Exacte match binnen de expliciete eigenaar_koppelingen.' : 'Enige sterke expliciete eigenaar_koppeling voor dit signaal.',
      };
    };

    const route = (signaal: OffMarketSignaal, kandidaat: BulkKandidaat): RoutingResult => {
      const partij = resolveParty(kandidaat);
      if (!data || !partij.eigenaarId) {
        return routeerPartijCampagne({ signaal, partij, campagne: null, partijBrieven: [] });
      }
      const ownerSignalIds = new Set(
        data.allLinks.filter((l) => l.eigenaar_id === partij.eigenaarId).map((l) => l.signaal_id),
      );
      const partijSignalen = data.partySignals.filter((s) => ownerSignalIds.has(s.id));
      const partijBrieven = data.partyLetters.filter((b) => ownerSignalIds.has(b.signaal_id));
      const campaignRow = kiesCampagne(data.campaigns.filter((c) => c.eigenaar_id === partij.eigenaarId));
      const campagne = campaignRow ? campaignSnapshot(campaignRow, data.campaignObjects) : null;
      return routeerPartijCampagne({
        signaal,
        partij,
        campagne,
        partijBrieven,
        partijSignalen,
        defaultCooldownMaanden: data.defaultCooldownMonths,
        primarySwitchThreshold: data.primarySwitchThreshold,
      });
    };

    return { resolveParty, route };
  }, [query.data]);

  return { ...query, ...api };
}
