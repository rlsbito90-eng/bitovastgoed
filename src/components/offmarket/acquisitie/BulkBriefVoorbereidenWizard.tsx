// Partij- en campagnebewuste wizard "Brieven voorbereiden".
// De expliciete Radar-selectie blijft bronwaarheid. Partij-/campagnerouting wordt
// volledig zichtbaar uitgelegd; niets wordt stil weggefilterd of automatisch
// als nieuw hoofdobject gekozen.

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronLeft, ChevronRight, Loader2, Mail, Save, Users } from 'lucide-react';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { useUpsertBrief } from '@/hooks/useOffMarketBrieven';
import {
  bouwBriefPlan, bouwKandidatenVoorSignaal, inserPayloadVoorPlanItem,
  bouwCanoniekeRadarSelectieScope, samenvatPlan, standaardtekstPayloadVoorPlanItem,
  type BulkKandidaat, type PlanItem,
} from '@/lib/offMarket/acquisitie/bulkBrief';
import { CAMPAGNE_STAP_LABEL, type CampagneStap } from '@/lib/offMarket/brieven/groepering';
import {
  useRadarPartyCampaignContext,
  type RadarBriefCampaignContext,
} from '@/hooks/useRadarPartyCampaignContext';
import {
  usePersistRadarCampaignRouting,
  useSwitchRadarPrimaryObject,
} from '@/hooks/useRadarCampaignMutations';
import { useRadarWorkvoorraadProjection } from '@/hooks/useRadarWorkvoorraadProjection';
import type { PartyIdentity, RoutingResult } from '@/lib/offMarket/acquisitie/partyCampaign';
import { campagnebewustePayload } from '@/lib/offMarket/acquisitie/campaignBriefText';
import {
  classificeerConceptVoorVernieuwing,
  magConceptAutomatischVernieuwen,
  type ConceptRefreshClassificatie,
} from '@/lib/offMarket/acquisitie/conceptRefresh';
import { bepaalWerkvoorraadProjectie } from '@/lib/offMarket/acquisitie/workvoorraadProjection';

interface Props {
  open: boolean;
  onClose: () => void;
  signalen: OffMarketSignaal[];
  brieven: OffMarketBrief[];
}

type Stap = 'geadresseerden' | 'instellingen' | 'controle' | 'klaar';

interface Resultaat {
  aangemaakt: number;
  hergebruikt: number;
  vernieuwd: number;
  handmatigOvergeslagen: number;
  overgeslagen: number;
  gebundeld: number;
  beoordeling: number;
  geblokkeerd: number;
  routingOpgeslagen: number;
  hoofdobjectGewijzigd: number;
  mislukt: number;
  fouten: Array<{ signaalId: string; key: string; bericht: string }>;
}

interface RoutedKandidaat {
  kandidaat: BulkKandidaat;
  partij: PartyIdentity;
  routing: RoutingResult;
  briefContext: RadarBriefCampaignContext;
  gekozenStap: CampagneStap | null;
  productieToegestaan: boolean;
  bestaandeConceptBrief: OffMarketBrief | null;
}

interface ConceptPreview {
  plan: PlanItem;
  classificatie: ConceptRefreshClassificatie | null;
}

function itemKey(signaalId: string, key: string) {
  return `${signaalId}|${key}`;
}

function routeLabel(r: RoutingResult): string {
  switch (r.outcome) {
    case 'nieuwe_campagne_brief_1': return 'Nieuwe campagne';
    case 'meenemen_in_vervolgbrief': return 'Bestaande campagne';
    case 'bundelen_bij_partij': return 'Gebundeld bij partij';
    case 'gespreksonderwerp': return 'Gespreksonderwerp';
    case 'herbenadering_voorstellen': return 'Herbenadering beoordelen';
    case 'benadering_bepalen': return 'Benadering bepalen';
    case 'niet_benaderen': return 'Niet benaderen';
    default: return 'Alleen registreren';
  }
}

function producteerbareStap(
  routing: RoutingResult,
  bestaandConcept: OffMarketBrief | null,
  briefContext: RadarBriefCampaignContext,
): CampagneStap | null {
  if (routing.geadviseerdeStap) return routing.geadviseerdeStap;

  // Een bestaand concept mag alleen zijn opgeslagen stap behouden als er niet
  // intussen partijbreed aantoonbaar eerder contact is geweest. Anders wint de
  // partijhistorie en mag een oud Brief-1-concept nooit een tweede Brief 1 worden.
  if (bestaandConcept && !briefContext.heeftEerderContact) {
    const stap = bestaandConcept.campagne_stap;
    if (stap === 'brief_1' || stap === 'brief_2' || stap === 'brief_3') return stap;
  }
  return null;
}

export default function BulkBriefVoorbereidenWizard({ open, onClose, signalen, brieven }: Props) {
  const upsert = useUpsertBrief();
  const persistRouting = usePersistRadarCampaignRouting();
  const switchPrimary = useSwitchRadarPrimaryObject();
  const projectWerkvoorraad = useRadarWorkvoorraadProjection();
  const partyContext = useRadarPartyCampaignContext(signalen);
  const initKeyRef = useRef<string | null>(null);

  const canoniekeScope = useMemo(
    () => bouwCanoniekeRadarSelectieScope(signalen, brieven),
    [signalen, brieven],
  );

  const allKandidaten = useMemo<BulkKandidaat[]>(() => {
    const brievenPerSignaal = new Map<string, OffMarketBrief[]>();
    for (const b of brieven) {
      const arr = brievenPerSignaal.get(b.signaal_id) ?? [];
      arr.push(b);
      brievenPerSignaal.set(b.signaal_id, arr);
    }
    return signalen.flatMap((s) => bouwKandidatenVoorSignaal(s, brievenPerSignaal.get(s.id) ?? []));
  }, [signalen, brieven]);

  const signaalIndex = useMemo(() => {
    const m = new Map<string, OffMarketSignaal>();
    for (const s of signalen) m.set(s.id, s);
    return m;
  }, [signalen]);

  const routed = useMemo<RoutedKandidaat[]>(() => allKandidaten.map((kandidaat) => {
    const signaal = signaalIndex.get(kandidaat.signaalId);
    const partij = partyContext.resolveParty(kandidaat);
    const briefContext = partyContext.briefContext(kandidaat);
    if (!signaal) {
      const routing = partyContext.route({ id: kandidaat.signaalId } as OffMarketSignaal, kandidaat);
      return { kandidaat, partij, routing, briefContext, gekozenStap: null, productieToegestaan: false, bestaandeConceptBrief: null };
    }

    const routing = partyContext.route(signaal, kandidaat);
    const bestaandConcept = brieven.find((b) =>
      b.signaal_id === kandidaat.signaalId
      && !b.archived_at
      && b.status === 'concept'
      && (b.geadresseerde_key ?? '') === kandidaat.geadresseerdeKey,
    ) ?? null;
    const gekozenStap = producteerbareStap(routing, bestaandConcept, briefContext);
    const geblokkeerdeUitkomst = [
      'benadering_bepalen', 'herbenadering_voorstellen', 'gespreksonderwerp',
      'alleen_registreren', 'niet_benaderen',
    ].includes(routing.outcome);
    const productieToegestaan = kandidaat.geschikt
      && Boolean(gekozenStap)
      && !geblokkeerdeUitkomst
      && (routing.magAutomatischBriefMaken || Boolean(bestaandConcept));
    return { kandidaat, partij, routing, briefContext, gekozenStap, productieToegestaan, bestaandeConceptBrief: bestaandConcept };
  }), [allKandidaten, signaalIndex, partyContext, brieven]);

  const partijGroepen = useMemo(() => {
    const m = new Map<string, RoutedKandidaat[]>();
    for (const r of routed) {
      if (!r.partij.eigenaarId) continue;
      const arr = m.get(r.partij.eigenaarId) ?? [];
      arr.push(r);
      m.set(r.partij.eigenaarId, arr);
    }
    return m;
  }, [routed]);

  const [stap, setStap] = useState<Stap>('geadresseerden');
  const [productieExcluded, setProductieExcluded] = useState<Set<string>>(new Set());
  const [contextExcluded, setContextExcluded] = useState<Set<string>>(new Set());
  const [primaryOverrideByParty, setPrimaryOverrideByParty] = useState<Record<string, string>>({});
  const [primarySwitchConfirmed, setPrimarySwitchConfirmed] = useState<Set<string>>(new Set());
  const [vernieuwBestaandeConcepten, setVernieuwBestaandeConcepten] = useState(false);
  const [overschrijfAfwijkendeConcepten, setOverschrijfAfwijkendeConcepten] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<Resultaat | null>(null);

  const productieKeuzes = useMemo(() => {
    const productie: RoutedKandidaat[] = [];
    const gebundeld = new Set<string>();
    for (const [partyId, groep] of partijGroepen.entries()) {
      const geschikt = groep.filter((r) => r.productieToegestaan);
      if (!geschikt.length) continue;
      geschikt.sort((a, b) => b.routing.nieuwObjectScore.score - a.routing.nieuwObjectScore.score);
      const overrideKey = primaryOverrideByParty[partyId];
      const gekozen = geschikt.find((r) => itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey) === overrideKey) ?? geschikt[0];
      productie.push(gekozen);
      for (const context of geschikt) {
        if (context === gekozen) continue;
        gebundeld.add(itemKey(context.kandidaat.signaalId, context.kandidaat.geadresseerdeKey));
      }
    }
    return { productie, gebundeld };
  }, [partijGroepen, primaryOverrideByParty]);

  useEffect(() => {
    if (!open) {
      initKeyRef.current = null;
      return;
    }
    if (partyContext.isLoading || partyContext.isError) return;
    const initKey = [...signaalIndex.keys()].sort().join('|');
    if (initKeyRef.current === initKey) return;
    initKeyRef.current = initKey;
    setStap('geadresseerden');
    setProductieExcluded(new Set());
    setContextExcluded(new Set());
    setPrimaryOverrideByParty({});
    setPrimarySwitchConfirmed(new Set());
    setVernieuwBestaandeConcepten(false);
    setOverschrijfAfwijkendeConcepten(false);
    setBezig(false);
    setResultaat(null);
  }, [open, partyContext.isLoading, partyContext.isError, signaalIndex]);

  const geselecteerdeProductie = useMemo(() => productieKeuzes.productie.filter((r) =>
    !productieExcluded.has(itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey)),
  ), [productieKeuzes.productie, productieExcluded]);

  const inbegrepenContext = useMemo(() => routed.filter((r) => {
    const key = itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey);
    return productieKeuzes.gebundeld.has(key) && !contextExcluded.has(key);
  }), [routed, productieKeuzes.gebundeld, contextExcluded]);

  const plan = useMemo<PlanItem[]>(() => {
    const perStap = new Map<CampagneStap, BulkKandidaat[]>();
    for (const r of geselecteerdeProductie) {
      if (!r.gekozenStap) continue;
      const arr = perStap.get(r.gekozenStap) ?? [];
      arr.push(r.kandidaat);
      perStap.set(r.gekozenStap, arr);
    }
    const historie = partyContext.data?.partyLetters ?? brieven;
    return [...perStap.entries()].flatMap(([campagneStap, kandidaten]) =>
      bouwBriefPlan({ kandidaten, brieven: historie, campagneStap }),
    );
  }, [geselecteerdeProductie, partyContext.data, brieven]);

  const routingPerItem = useMemo(() => new Map(
    routed.map((r) => [itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey), r]),
  ), [routed]);

  const partySize = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of routed) if (r.partij.eigenaarId) m.set(r.partij.eigenaarId, (m.get(r.partij.eigenaarId) ?? 0) + 1);
    return m;
  }, [routed]);

  function payloadMetCampagneContext(p: PlanItem, mode: 'insert' | 'refresh') {
    const r = routingPerItem.get(itemKey(p.signaalId, p.geadresseerdeKey));
    const s = signaalIndex.get(p.signaalId);
    if (!r || !s) throw new Error('Campagnecontext voor planitem ontbreekt.');
    const base = mode === 'insert'
      ? inserPayloadVoorPlanItem({ signaal: s, plan: p }) as any
      : standaardtekstPayloadVoorPlanItem({ signaal: s, plan: p }) as any;
    return campagnebewustePayload(base, {
      campagneStap: p.campagneStap,
      eerderObject: r.briefContext.eerderObject,
      heeftEerderContact: r.briefContext.heeftEerderContact,
      portefeuille: r.briefContext.portefeuille || (r.partij.eigenaarId ? (partySize.get(r.partij.eigenaarId) ?? 0) > 1 : false),
    });
  }

  const conceptPreviews = useMemo<ConceptPreview[]>(() => plan.map((p) => {
    if (p.actie !== 'hergebruiken' || p.bestaandeBrief?.status !== 'concept') return { plan: p, classificatie: null };
    try {
      const payload = payloadMetCampagneContext(p, 'refresh');
      return { plan: p, classificatie: classificeerConceptVoorVernieuwing(p.bestaandeBrief, payload.brieftekst) };
    } catch {
      return { plan: p, classificatie: 'afwijkend_mogelijk_handmatig' };
    }
  }), [plan, routingPerItem, signaalIndex, partySize]);

  const afwijkendeConcepten = conceptPreviews.filter((p) => p.classificatie === 'afwijkend_mogelijk_handmatig').length;
  const legacyConcepten = conceptPreviews.filter((p) => p.classificatie === 'legacy_standaard').length;
  const actueleConcepten = conceptPreviews.filter((p) => p.classificatie === 'actueel').length;
  const sam = useMemo(() => samenvatPlan(plan), [plan]);
  const gebundeldAantal = inbegrepenContext.length;
  const beoordelingAantal = routed.filter((r) => ['benadering_bepalen', 'herbenadering_voorstellen'].includes(r.routing.outcome)).length;
  const geblokkeerdAantal = routed.filter((r) => r.routing.outcome === 'niet_benaderen').length;

  function toggleProductie(r: RoutedKandidaat) {
    if (!r.productieToegestaan) return;
    const key = itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey);
    setProductieExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleContext(r: RoutedKandidaat) {
    const key = itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey);
    setContextExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function gebruikAlsAanleiding(r: RoutedKandidaat) {
    if (!r.partij.eigenaarId || !r.productieToegestaan) return;
    const key = itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey);
    setPrimaryOverrideByParty((prev) => ({ ...prev, [r.partij.eigenaarId!]: key }));
  }

  function togglePrimarySwitch(r: RoutedKandidaat) {
    const key = itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey);
    setPrimarySwitchConfirmed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  async function bevestigOpslaan() {
    if (bezig) return;
    setBezig(true);
    const uit: Resultaat = {
      aangemaakt: 0, hergebruikt: 0, vernieuwd: 0, handmatigOvergeslagen: 0,
      overgeslagen: 0, gebundeld: gebundeldAantal, beoordeling: beoordelingAantal,
      geblokkeerd: geblokkeerdAantal, routingOpgeslagen: 0, hoofdobjectGewijzigd: 0,
      mislukt: 0, fouten: [],
    };

    try {
      const productieKeys = new Set(geselecteerdeProductie.map((r) => itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey)));
      const tePersisteren = new Map<string, RoutedKandidaat>();

      // Productie + expliciet inbegrepen portefeuillecontext worden opgeslagen.
      for (const r of [...geselecteerdeProductie, ...inbegrepenContext]) {
        tePersisteren.set(itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey), r);
      }
      // Bestaande echte partijen met een no-letter route moeten ook hun nieuwe
      // signaal aan de bestaande campagne kunnen koppelen. Nieuwe synthetische
      // partijen worden nooit aangemaakt als de gebruiker geen brief bevestigt.
      for (const r of routed) {
        if (!r.partij.eigenaarId || r.partij.eigenaarId.startsWith('new-radar-party:')) continue;
        if (['gespreksonderwerp', 'alleen_registreren', 'niet_benaderen', 'herbenadering_voorstellen'].includes(r.routing.outcome)) {
          tePersisteren.set(itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey), r);
        }
      }

      const persistResult = new Map<string, { campagneId: string | null }>();
      for (const [key, r] of tePersisteren) {
        const s = signaalIndex.get(r.kandidaat.signaalId);
        if (!s || !r.partij.eigenaarId) continue;
        try {
          const pr = await persistRouting.mutateAsync({
            eigenaarId: r.partij.eigenaarId,
            signaal: s,
            routing: r.routing,
            gekozenStap: productieKeys.has(key) ? r.gekozenStap : null,
          });
          persistResult.set(key, { campagneId: pr.campagneId });
          uit.routingOpgeslagen += 1;
        } catch (e: any) {
          uit.mislukt += 1;
          uit.fouten.push({ signaalId: r.kandidaat.signaalId, key, bericht: `Routing: ${e?.message ?? 'onbekende fout'}` });
        }
      }

      // Hoofdobject verandert uitsluitend wanneer de gebruiker het zichtbare
      // voorstel expliciet heeft aangevinkt.
      for (const r of routed) {
        const key = itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey);
        if (!primarySwitchConfirmed.has(key) || !r.routing.nieuwHoofdobjectVoorstellen) continue;
        const campagneId = persistResult.get(key)?.campagneId ?? r.briefContext.campagneId;
        if (!campagneId) continue;
        try {
          await switchPrimary.mutateAsync({
            campagneId,
            signaalId: r.kandidaat.signaalId,
            reden: `Expliciet bevestigd: sterker object (${r.routing.nieuwObjectScore.score}${r.routing.huidigObjectScore ? ` vs ${r.routing.huidigObjectScore.score}` : ''}). ${r.routing.nieuwObjectScore.redenen.join(', ')}`,
          });
          uit.hoofdobjectGewijzigd += 1;
        } catch (e: any) {
          uit.mislukt += 1;
          uit.fouten.push({ signaalId: r.kandidaat.signaalId, key, bericht: `Hoofdobject: ${e?.message ?? 'onbekende fout'}` });
        }
      }

      for (const p of plan) {
        const key = itemKey(p.signaalId, p.geadresseerdeKey);
        if (!productieKeys.has(key)) continue;
        const s = signaalIndex.get(p.signaalId);
        if (!s) { uit.overgeslagen += 1; continue; }
        if (p.actie === 'overslaan') { uit.overgeslagen += 1; continue; }
        try {
          if (p.actie === 'hergebruiken') {
            if (!vernieuwBestaandeConcepten || p.bestaandeBrief?.status !== 'concept') {
              uit.hergebruikt += 1;
              continue;
            }
            const payload = payloadMetCampagneContext(p, 'refresh');
            const classificatie = classificeerConceptVoorVernieuwing(p.bestaandeBrief, payload.brieftekst);
            if (classificatie === 'actueel') {
              uit.hergebruikt += 1;
              continue;
            }
            if (!magConceptAutomatischVernieuwen(classificatie, overschrijfAfwijkendeConcepten)) {
              uit.handmatigOvergeslagen += 1;
              continue;
            }
            await upsert.mutateAsync({ ...payload, id: p.bestaandeBrief.id });
            uit.vernieuwd += 1;
          } else {
            await upsert.mutateAsync(payloadMetCampagneContext(p, 'insert'));
            uit.aangemaakt += 1;
          }
        } catch (e: any) {
          uit.mislukt += 1;
          uit.fouten.push({ signaalId: p.signaalId, key, bericht: `Brief: ${e?.message ?? 'onbekende fout'}` });
        }
      }

      // Werkvoorraad is een projectie van de opgeslagen routing. Eén update per
      // signaal voorkomt dat meerdere rechthebbenden elkaar overschrijven.
      const projecties = signalen.map((s) => {
        const rijen = routed.filter((r) => r.kandidaat.signaalId === s.id).map((r) => ({
          itemKey: itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey),
          routing: r.routing,
          partijMatchBevestigd: r.partij.matchStatus === 'bevestigd',
        }));
        const p = bepaalWerkvoorraadProjectie(rijen, productieKeys);
        return {
          signaalId: s.id,
          status: p.status,
          reden: p.reden,
          partijMatchBeoordelen: p.partijMatchBeoordelen,
        };
      });
      try {
        await projectWerkvoorraad.mutateAsync(projecties);
      } catch (e: any) {
        uit.mislukt += 1;
        uit.fouten.push({ signaalId: 'werkvoorraad', key: 'projectie', bericht: `Werkvoorraad: ${e?.message ?? 'onbekende fout'}` });
      }

      setResultaat(uit);
      setStap('klaar');
      const msg = `${uit.aangemaakt} aangemaakt · ${uit.vernieuwd} vernieuwd · ${uit.gebundeld} gebundeld · ${uit.beoordeling} beoordelen`;
      if (uit.mislukt > 0) toast.error(`${msg} · ${uit.mislukt} mislukt`);
      else toast.success(msg);
    } finally {
      setBezig(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-w-[95vw] p-0 overflow-hidden" data-testid="bulk-brief-wizard">
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Brieven voorbereiden</DialogTitle>
            <DialogDescription>
              Partij → campagne → hoofdobject/context → briefstap. Een nieuw signaal start nooit zelfstandig opnieuw bij Brief 1.
            </DialogDescription>
            <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {[
                ['geadresseerden', '1. Partijen & objecten'], ['instellingen', '2. Tekst & veiligheid'],
                ['controle', '3. Controle'], ['klaar', '4. Resultaat'],
              ].map(([k, label]) => (
                <li key={k} data-active={stap === k} className="data-[active=true]:text-foreground data-[active=true]:font-medium">{label}</li>
              ))}
            </ol>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-3" data-testid="bulk-wizard-body">
            {partyContext.isLoading && <p className="rounded-md border p-3 text-sm text-muted-foreground">Partij- en campagnehistorie controleren…</p>}
            {partyContext.isError && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Partij-/campagnecontext kon niet worden geladen. Er worden geen nieuwe brieven geproduceerd totdat deze controle beschikbaar is.</p>}

            {stap === 'geadresseerden' && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {allKandidaten.length} geadresseerden · {canoniekeScope.telling.signalen} signalen · {new Set(routed.map((r) => r.partij.eigenaarId).filter(Boolean)).size} partij-identiteiten
                  </p>
                  <div className="basis-full rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                    Geen stille filtering: {productieKeuzes.gebundeld.size} contextobjecten · {beoordelingAantal} handmatig beoordelen · {geblokkeerdAantal} niet benaderen.
                  </div>
                </div>

                <ul className="rounded-md border divide-y" data-testid="bulk-kandidaten-lijst">
                  {routed.map((r) => {
                    const k = r.kandidaat;
                    const s = signaalIndex.get(k.signaalId);
                    const key = itemKey(k.signaalId, k.geadresseerdeKey);
                    const isChosen = productieKeuzes.productie.includes(r);
                    const isBundled = productieKeuzes.gebundeld.has(key);
                    const checked = isChosen ? !productieExcluded.has(key) : isBundled ? !contextExcluded.has(key) : false;
                    const partyId = r.partij.eigenaarId;
                    return (
                      <li key={key} data-testid="bulk-kandidaat-rij" data-geschikt={r.productieToegestaan} className="flex items-start gap-3 p-3">
                        <Checkbox
                          checked={checked}
                          disabled={!isChosen && !isBundled}
                          onCheckedChange={() => isChosen ? toggleProductie(r) : isBundled ? toggleContext(r) : undefined}
                          aria-label={isBundled ? 'Contextobject meenemen' : 'Brief produceren'}
                        />
                        <div className="min-w-0 flex-1 space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium break-words">{k.naam ?? k.bedrijfsnaam ?? '(zonder naam)'}</p>
                            <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{isBundled ? 'Contextobject' : routeLabel(r.routing)}</span>
                            {isChosen && <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">Concrete aanleiding</span>}
                          </div>
                          {s && <p className="text-[11px] text-muted-foreground">Object: {s.adres ?? s.titel ?? '—'}{s.plaats ? `, ${s.plaats}` : ''}</p>}
                          <p className="text-[11px] text-muted-foreground">{r.routing.reden}</p>
                          {r.partij.matchStatus !== 'bevestigd' && <p className="text-[11px] text-amber-700 dark:text-amber-300">⚠ Mogelijk dezelfde partij — partijmatch eerst bevestigen.</p>}
                          {r.routing.nieuwHoofdobjectVoorstellen && (
                            <div className="rounded-md border border-amber-500/30 bg-amber-500/8 p-2 text-[11px] text-amber-800 dark:text-amber-200 space-y-1">
                              <p className="font-medium">Sterker object gevonden</p>
                              <p>Score {r.routing.nieuwObjectScore.score}{r.routing.huidigObjectScore ? ` vs. huidig ${r.routing.huidigObjectScore.score}` : ''}. {r.routing.nieuwObjectScore.redenen.join(', ')}.</p>
                              {r.briefContext.campagneId && (
                                <label className="flex items-center gap-2">
                                  <Checkbox checked={primarySwitchConfirmed.has(key)} onCheckedChange={() => togglePrimarySwitch(r)} />
                                  Hoofdobject wijzigen bij opslaan
                                </label>
                              )}
                            </div>
                          )}
                          {partyId && r.productieToegestaan && !isChosen && (
                            <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => gebruikAlsAanleiding(r)}>
                              Gebruik als concrete aanleiding
                            </Button>
                          )}
                          {r.gekozenStap && <p className="text-[10px] text-muted-foreground">Advies: {(partyId && (partySize.get(partyId) ?? 0) > 1) ? 'Portefeuillebrief' : 'Objectbrief'} · {CAMPAGNE_STAP_LABEL[r.gekozenStap]}</p>}
                          {k.verzendadres && <p className="text-[10px] text-muted-foreground whitespace-pre-line">{k.verzendadres}</p>}
                        </div>
                      </li>
                    );
                  })}
                  {routed.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Geen geadresseerden gevonden voor de geselecteerde signalen.</li>}
                </ul>
              </section>
            )}

            {stap === 'instellingen' && (
              <section className="space-y-4 max-w-2xl">
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-sm font-medium">Campagnestap automatisch per partij</p>
                  <p className="text-[11px] text-muted-foreground">De stap komt uit de partijbrede verzend- en contacthistorie. Een nieuw object na Brief 1 wordt dus Brief 2-context, niet opnieuw Brief 1.</p>
                </div>

                <label className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
                  <Checkbox checked={vernieuwBestaandeConcepten} onCheckedChange={(waarde) => setVernieuwBestaandeConcepten(waarde === true)} data-testid="bulk-vernieuw-standaardteksten" />
                  <span className="space-y-1 text-sm">
                    <span className="block font-medium">Bestaande conceptteksten vernieuwen met huidige standaardtekst</span>
                    <span className="block text-[11px] leading-relaxed text-muted-foreground">Alleen concepten. Herkenbare oude standaardtekst wordt veilig vernieuwd; definitieve/verstuurde brieven blijven immutable.</span>
                  </span>
                </label>

                {vernieuwBestaandeConcepten && (
                  <div className="rounded-md border p-3 text-xs space-y-2">
                    <p>{legacyConcepten} oude standaardtekst · {actueleConcepten} al actueel · {afwijkendeConcepten} afwijkend/mogelijk handmatig aangepast</p>
                    {afwijkendeConcepten > 0 && (
                      <label className="flex items-start gap-2 text-amber-800 dark:text-amber-200">
                        <Checkbox checked={overschrijfAfwijkendeConcepten} onCheckedChange={(v) => setOverschrijfAfwijkendeConcepten(v === true)} />
                        <span><strong>Ook {afwijkendeConcepten} afwijkende concept(en) overschrijven.</strong> Dit kan handmatige tekstwijzigingen verwijderen en staat daarom standaard uit.</span>
                      </label>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Kanaal: Post. Partij/campagnerouting en werkvoorraad worden pas vastgelegd nadat u in de volgende stap bevestigt.</p>
              </section>
            )}

            {stap === 'controle' && (
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                  <Stat label="Signalen" value={canoniekeScope.telling.signalen} />
                  <Stat label="Brieven" value={sam.aanmaken + sam.hergebruiken} tone="success" />
                  <Stat label="Context" value={gebundeldAantal} />
                  <Stat label="Beoordelen" value={beoordelingAantal} tone={beoordelingAantal ? 'warn' : 'default'} />
                  <Stat label="Blokkade" value={geblokkeerdAantal} tone={geblokkeerdAantal ? 'danger' : 'default'} />
                </div>
                <ul className="rounded-md border divide-y text-sm" data-testid="bulk-controle-lijst">
                  {plan.map((p) => {
                    const s = signaalIndex.get(p.signaalId);
                    const r = routingPerItem.get(itemKey(p.signaalId, p.geadresseerdeKey));
                    const preview = conceptPreviews.find((x) => x.plan === p);
                    return (
                      <li key={`${p.signaalId}|${p.geadresseerdeKey}|${p.campagneStap}`} className="p-3 space-y-0.5" data-actie={p.actie} data-testid="bulk-plan-rij">
                        <p className="font-medium">{p.kandidaat.naam ?? p.kandidaat.bedrijfsnaam ?? '(zonder naam)'} <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">{p.actie === 'aanmaken' ? 'Aanmaken' : 'Bestaand concept'}</span></p>
                        <p className="text-[11px] text-muted-foreground">{CAMPAGNE_STAP_LABEL[p.campagneStap]} · Object: {s?.adres ?? s?.titel ?? '—'}</p>
                        {r && <p className="text-[11px] text-muted-foreground">{r.routing.reden}</p>}
                        {preview?.classificatie === 'legacy_standaard' && vernieuwBestaandeConcepten && <p className="text-[11px] text-success">Oude standaardtekst wordt vernieuwd.</p>}
                        {preview?.classificatie === 'afwijkend_mogelijk_handmatig' && vernieuwBestaandeConcepten && !overschrijfAfwijkendeConcepten && <p className="text-[11px] text-amber-700">Mogelijk handmatig aangepast — tekst wordt niet overschreven.</p>}
                        {p.reden && <p className="text-[11px] text-destructive">⚠ {p.reden}</p>}
                      </li>
                    );
                  })}
                  {plan.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Geen productierijpe brief. Gebundelde, geblokkeerde en beoordelingsdossiers blijven wel zichtbaar en worden bij bevestiging als werkvoorraadprojectie verwerkt.</li>}
                </ul>
              </section>
            )}

            {stap === 'klaar' && resultaat && (
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <Stat label="Aangemaakt" value={resultaat.aangemaakt} tone="success" />
                  <Stat label="Vernieuwd" value={resultaat.vernieuwd} tone="success" />
                  <Stat label="Handmatig behouden" value={resultaat.handmatigOvergeslagen} />
                  <Stat label="Gebundeld" value={resultaat.gebundeld} />
                  <Stat label="Routing opgeslagen" value={resultaat.routingOpgeslagen} />
                  <Stat label="Hoofdobject gewijzigd" value={resultaat.hoofdobjectGewijzigd} />
                  <Stat label="Mislukt" value={resultaat.mislukt} tone={resultaat.mislukt ? 'danger' : 'default'} />
                </div>
                {resultaat.fouten.length > 0 && <ul className="text-[11px] text-destructive list-disc pl-4">{resultaat.fouten.map((f, i) => <li key={i}>{f.bericht}</li>)}</ul>}
                <p className="text-sm text-muted-foreground">Productie gebruikt alleen de expliciet bevestigde partij/campagnebrief. Contextsignalen blijven zichtbaar en gekoppeld zonder een tweede koude reeks te starten.</p>
              </section>
            )}
          </div>

          <div data-testid="bulk-wizard-footer" className="border-t bg-background/95 backdrop-blur px-5 py-3 flex flex-wrap items-center justify-between gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="text-[11px] text-muted-foreground" data-testid="bulk-toolbar-telling">
              {canoniekeScope.telling.signalen} signalen · {new Set(geselecteerdeProductie.map((r) => r.partij.eigenaarId)).size} partijen · {sam.aanmaken + sam.hergebruiken} brieven · {gebundeldAantal} context
            </div>
            <div className="flex flex-wrap gap-2">
              {stap !== 'geadresseerden' && stap !== 'klaar' && <Button type="button" variant="ghost" size="sm" onClick={() => setStap(stap === 'controle' ? 'instellingen' : 'geadresseerden')} disabled={bezig}><ChevronLeft className="h-4 w-4" /> Vorige</Button>}
              {stap === 'geadresseerden' && <Button type="button" size="sm" onClick={() => setStap('instellingen')} disabled={partyContext.isLoading || partyContext.isError} data-testid="bulk-wizard-volgende">Volgende <ChevronRight className="h-4 w-4" /></Button>}
              {stap === 'instellingen' && <Button type="button" size="sm" onClick={() => setStap('controle')} data-testid="bulk-wizard-volgende">Volgende <ChevronRight className="h-4 w-4" /></Button>}
              {stap === 'controle' && <Button type="button" size="sm" onClick={bevestigOpslaan} disabled={bezig || routed.length === 0} data-testid="bulk-wizard-bevestig">{bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Routing & concepten opslaan</Button>}
              {stap === 'klaar' && <Button type="button" size="sm" onClick={onClose} data-testid="bulk-wizard-sluit">Sluiten</Button>}
              {stap !== 'klaar' && <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={bezig}>Annuleren</Button>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'success' | 'warn' | 'danger' }) {
  const toneCls = tone === 'success' ? 'border-success/40 bg-success/10 text-success'
    : tone === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
    : tone === 'danger' ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : 'border-border bg-card text-foreground';
  return <div className={`rounded-md border px-3 py-2 ${toneCls}`}><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-base font-semibold font-mono-data leading-none">{value}</p></div>;
}
