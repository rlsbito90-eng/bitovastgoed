// Partij- en campagnebewuste wizard "Brieven voorbereiden".
// De expliciete Radar-selectie blijft de bronwaarheid. Afgeleide partijrouting
// wordt zichtbaar uitgelegd en filtert nooit stil een dossier weg.

import { useEffect, useMemo, useState } from 'react';
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
import { useRadarPartyCampaignContext } from '@/hooks/useRadarPartyCampaignContext';
import { usePersistRadarCampaignRouting } from '@/hooks/useRadarCampaignMutations';
import type { PartyIdentity, RoutingResult } from '@/lib/offMarket/acquisitie/partyCampaign';

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
  overgeslagen: number;
  gebundeld: number;
  beoordeling: number;
  mislukt: number;
  fouten: Array<{ signaalId: string; key: string; bericht: string }>;
}

interface RoutedKandidaat {
  kandidaat: BulkKandidaat;
  partij: PartyIdentity;
  routing: RoutingResult;
  gekozenStap: CampagneStap | null;
  productieToegestaan: boolean;
  bestaandeConceptBrief: OffMarketBrief | null;
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

export default function BulkBriefVoorbereidenWizard({ open, onClose, signalen, brieven }: Props) {
  const upsert = useUpsertBrief();
  const persistRouting = usePersistRadarCampaignRouting();
  const partyContext = useRadarPartyCampaignContext(signalen);

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

  const routed = useMemo<RoutedKandidaat[]>(() => {
    return allKandidaten.map((kandidaat) => {
      const signaal = signaalIndex.get(kandidaat.signaalId);
      if (!signaal) {
        const partij: PartyIdentity = { eigenaarId: null, matchStatus: 'onbekend', matchReden: 'Signaal niet beschikbaar.' };
        const routing = partyContext.route({ id: kandidaat.signaalId } as OffMarketSignaal, kandidaat);
        return { kandidaat, partij, routing, gekozenStap: null, productieToegestaan: false, bestaandeConceptBrief: null };
      }
      const partij = partyContext.resolveParty(kandidaat);
      const routing = partyContext.route(signaal, kandidaat);
      const bestaandConcept = brieven.find((b) =>
        b.signaal_id === kandidaat.signaalId
        && !b.archived_at
        && b.status === 'concept'
        && (b.geadresseerde_key ?? '') === kandidaat.geadresseerdeKey,
      ) ?? null;
      // Een bestaand concept mag worden hergebruikt/vernieuwd in zijn reeds
      // vastgelegde campagnestap. Dit start geen nieuwe campagne en is nodig
      // voor de bestaande "standaardtekst herstellen"-flow.
      const conceptStap = bestaandConcept?.campagne_stap;
      const gekozenStap = (
        conceptStap === 'brief_1' || conceptStap === 'brief_2' || conceptStap === 'brief_3'
          ? conceptStap
          : routing.geadviseerdeStap
      ) as CampagneStap | null;
      const productieToegestaan = kandidaat.geschikt && Boolean(
        (bestaandConcept && gekozenStap) || (routing.magAutomatischBriefMaken && gekozenStap),
      );
      return { kandidaat, partij, routing, gekozenStap, productieToegestaan, bestaandeConceptBrief: bestaandConcept };
    });
  }, [allKandidaten, signaalIndex, partyContext, brieven]);

  // Per canonieke partij maximaal één brief in deze run. Het sterkste object
  // is de concrete aanleiding; overige geselecteerde signalen blijven zichtbaar
  // als context en worden hieronder expliciet als gebundeld geteld.
  const productieKeuzes = useMemo(() => {
    const perPartij = new Map<string, RoutedKandidaat[]>();
    const zonderPartij: RoutedKandidaat[] = [];
    for (const r of routed) {
      if (!r.productieToegestaan || !r.partij.eigenaarId) {
        zonderPartij.push(r);
        continue;
      }
      const arr = perPartij.get(r.partij.eigenaarId) ?? [];
      arr.push(r);
      perPartij.set(r.partij.eigenaarId, arr);
    }
    const productie: RoutedKandidaat[] = [];
    const gebundeld = new Set<string>();
    for (const groep of perPartij.values()) {
      groep.sort((a, b) => b.routing.nieuwObjectScore.score - a.routing.nieuwObjectScore.score);
      productie.push(groep[0]);
      for (const context of groep.slice(1)) gebundeld.add(itemKey(context.kandidaat.signaalId, context.kandidaat.geadresseerdeKey));
    }
    return { productie, gebundeld, zonderPartij };
  }, [routed]);

  const [stap, setStap] = useState<Stap>('geadresseerden');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [vernieuwBestaandeConcepten, setVernieuwBestaandeConcepten] = useState(false);
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<Resultaat | null>(null);

  useEffect(() => {
    if (!open) return;
    setStap('geadresseerden');
    setVernieuwBestaandeConcepten(false);
    setExcluded(new Set(
      routed
        .filter((r) => !r.productieToegestaan || productieKeuzes.gebundeld.has(itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey)))
        .map((r) => itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey)),
    ));
    setBezig(false);
    setResultaat(null);
  }, [open, routed, productieKeuzes.gebundeld]);

  function toggle(r: RoutedKandidaat) {
    if (!r.productieToegestaan) return;
    const k = itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey);
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function selecteerAlleGeschikt() {
    setExcluded(new Set(
      routed
        .filter((r) => !r.productieToegestaan || productieKeuzes.gebundeld.has(itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey)))
        .map((r) => itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey)),
    ));
  }

  const geselecteerdeProductie = useMemo(() => productieKeuzes.productie.filter((r) =>
    !excluded.has(itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey)),
  ), [productieKeuzes.productie, excluded]);

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

  const sam = useMemo(() => samenvatPlan(plan), [plan]);
  const routingPerItem = useMemo(() => new Map(routed.map((r) => [itemKey(r.kandidaat.signaalId, r.kandidaat.geadresseerdeKey), r])), [routed]);
  const aantalGeselecteerdeSignalen = canoniekeScope.telling.signalen;
  const gebundeldAantal = productieKeuzes.gebundeld.size;
  const beoordelingAantal = routed.filter((r) => !r.productieToegestaan && r.routing.outcome !== 'niet_benaderen').length;
  const geblokkeerdAantal = routed.filter((r) => r.routing.outcome === 'niet_benaderen').length;

  async function bevestigOpslaan() {
    if (bezig) return;
    setBezig(true);
    const uit: Resultaat = {
      aangemaakt: 0, hergebruikt: 0, vernieuwd: 0, overgeslagen: 0,
      gebundeld: gebundeldAantal, beoordeling: beoordelingAantal, mislukt: 0, fouten: [],
    };
    try {
      for (const p of plan) {
        const r = routingPerItem.get(itemKey(p.signaalId, p.geadresseerdeKey));
        const s = signaalIndex.get(p.signaalId);
        if (!r || !s || !r.partij.eigenaarId) {
          uit.overgeslagen += 1;
          continue;
        }
        if (p.actie === 'overslaan') {
          uit.overgeslagen += 1;
          continue;
        }
        try {
          // Campagnecontext wordt pas gepersisteerd na deze expliciete bevestiging.
          await persistRouting.mutateAsync({
            eigenaarId: r.partij.eigenaarId,
            signaal: s,
            routing: r.routing,
            gekozenStap: p.campagneStap,
          });
          if (p.actie === 'hergebruiken') {
            if (vernieuwBestaandeConcepten && p.bestaandeBrief?.status === 'concept') {
              await upsert.mutateAsync({
                ...standaardtekstPayloadVoorPlanItem({ signaal: s, plan: p }),
                id: p.bestaandeBrief.id,
              });
              uit.vernieuwd += 1;
            } else {
              uit.hergebruikt += 1;
            }
          } else {
            await upsert.mutateAsync(inserPayloadVoorPlanItem({ signaal: s, plan: p }) as any);
            uit.aangemaakt += 1;
          }
        } catch (e: any) {
          uit.mislukt += 1;
          uit.fouten.push({ signaalId: p.signaalId, key: p.geadresseerdeKey, bericht: e?.message ?? 'Onbekende fout' });
        }
      }
      setResultaat(uit);
      setStap('klaar');
      const msg = `${uit.aangemaakt} aangemaakt · ${uit.vernieuwd} vernieuwd · ${uit.hergebruikt} ongewijzigd · ${uit.gebundeld} gebundeld · ${uit.beoordeling} beoordeling`;
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
                ['geadresseerden', '1. Partijen & geadresseerden'], ['instellingen', '2. Instellingen'],
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
                    {allKandidaten.length} geadresseerden · {aantalGeselecteerdeSignalen} signalen · {new Set(routed.map((r) => r.partij.eigenaarId).filter(Boolean)).size} bevestigde partijen
                  </p>
                  <Button type="button" variant="outline" size="sm" onClick={selecteerAlleGeschikt} disabled={partyContext.isLoading || partyContext.isError}>
                    <Users className="h-3.5 w-3.5" />Selecteer productierijp
                  </Button>
                  {(gebundeldAantal + beoordelingAantal + geblokkeerdAantal) > 0 && (
                    <p className="basis-full rounded-md border border-amber-500/35 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
                      Geen stille filtering: {gebundeldAantal} gebundeld bij partij · {beoordelingAantal} handmatig beoordelen · {geblokkeerdAantal} niet benaderen.
                    </p>
                  )}
                </div>
                <ul className="rounded-md border divide-y" data-testid="bulk-kandidaten-lijst">
                  {routed.map((r) => {
                    const k = r.kandidaat;
                    const s = signaalIndex.get(k.signaalId);
                    const key = itemKey(k.signaalId, k.geadresseerdeKey);
                    const isBundled = productieKeuzes.gebundeld.has(key);
                    const checked = !excluded.has(key) && r.productieToegestaan && !isBundled;
                    const disabled = !r.productieToegestaan || isBundled;
                    return (
                      <li key={key} data-testid="bulk-kandidaat-rij" data-geschikt={r.productieToegestaan} className="flex items-start gap-3 p-3">
                        <Checkbox checked={checked} disabled={disabled} onCheckedChange={() => toggle(r)} aria-label="Selecteer geadresseerde" />
                        <div className="min-w-0 flex-1 space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium break-words">{k.naam ?? k.bedrijfsnaam ?? '(zonder naam)'}</p>
                            <span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{isBundled ? 'Gebundeld bij partij' : routeLabel(r.routing)}</span>
                          </div>
                          {s && <p className="text-[11px] text-muted-foreground">Object: {s.adres ?? s.titel ?? '—'}{s.plaats ? `, ${s.plaats}` : ''}</p>}
                          <p className="text-[11px] text-muted-foreground">{r.routing.reden}</p>
                          {r.partij.matchStatus !== 'bevestigd' && <p className="text-[11px] text-amber-700 dark:text-amber-300">⚠ Mogelijk dezelfde partij — partijmatch eerst bevestigen.</p>}
                          {r.routing.nieuwHoofdobjectVoorstellen && (
                            <p className="text-[11px] text-amber-700 dark:text-amber-300">Sterker object gevonden: score {r.routing.nieuwObjectScore.score}{r.routing.huidigObjectScore ? ` vs. ${r.routing.huidigObjectScore.score}` : ''}. Hoofdobject wordt niet automatisch gewijzigd.</p>
                          )}
                          {r.gekozenStap && <p className="text-[10px] text-muted-foreground">Advies: {r.routing.briefAdvies === 'portefeuillebrief' || isBundled ? 'Portefeuillebrief' : 'Objectbrief'} · {CAMPAGNE_STAP_LABEL[r.gekozenStap]}</p>}
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
              <section className="space-y-4 max-w-xl">
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-sm font-medium">Campagnestap automatisch per partij</p>
                  <p className="text-[11px] text-muted-foreground">De stap wordt afgeleid uit de partijbrede brief- en contacthistorie. Brief 1 kan dus niet opnieuw worden gekozen wanneer dezelfde partij al Brief 1 heeft ontvangen.</p>
                </div>
                <label className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3">
                  <Checkbox checked={vernieuwBestaandeConcepten} onCheckedChange={(waarde) => setVernieuwBestaandeConcepten(waarde === true)} data-testid="bulk-vernieuw-standaardteksten" />
                  <span className="space-y-1 text-sm">
                    <span className="block font-medium">Bestaande conceptteksten vernieuwen</span>
                    <span className="block text-[11px] leading-relaxed text-muted-foreground">Gebruikt de actuele templatevariant binnen de al bepaalde partij/campagnestap. Definitieve en verstuurde brieven blijven onaangetast. Handmatig aangepaste concepttekst wordt alleen vervangen wanneer u deze optie bewust aanvinkt.</span>
                  </span>
                </label>
                <p className="text-xs text-muted-foreground">Kanaal: Post. Nieuwe campagnes worden pas vastgelegd nadat u in de volgende stap expliciet bevestigt.</p>
              </section>
            )}

            {stap === 'controle' && (
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-sm">
                  <Stat label="Signalen" value={aantalGeselecteerdeSignalen} />
                  <Stat label="Brieven" value={sam.aanmaken + sam.hergebruiken} tone="success" />
                  <Stat label="Gebundeld" value={gebundeldAantal} />
                  <Stat label="Beoordelen" value={beoordelingAantal} tone={beoordelingAantal ? 'warn' : 'default'} />
                  <Stat label="Blokkade" value={geblokkeerdAantal} tone={geblokkeerdAantal ? 'danger' : 'default'} />
                </div>
                <ul className="rounded-md border divide-y text-sm" data-testid="bulk-controle-lijst">
                  {plan.map((p) => {
                    const s = signaalIndex.get(p.signaalId);
                    const r = routingPerItem.get(itemKey(p.signaalId, p.geadresseerdeKey));
                    return (
                      <li key={`${p.signaalId}|${p.geadresseerdeKey}|${p.campagneStap}`} className="p-3 space-y-0.5" data-actie={p.actie} data-testid="bulk-plan-rij">
                        <p className="font-medium">{p.kandidaat.naam ?? p.kandidaat.bedrijfsnaam ?? '(zonder naam)'} <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">{p.actie === 'aanmaken' ? 'Aanmaken' : p.actie === 'hergebruiken' ? 'Hergebruiken' : 'Overslaan'}</span></p>
                        <p className="text-[11px] text-muted-foreground">{CAMPAGNE_STAP_LABEL[p.campagneStap]} · {r?.routing.briefAdvies === 'portefeuillebrief' || gebundeldAantal > 0 ? 'Portefeuillecontext' : 'Objectbrief'} · Object: {s?.adres ?? s?.titel ?? '—'}</p>
                        {r && <p className="text-[11px] text-muted-foreground">{r.routing.reden}</p>}
                        {p.reden && <p className="text-[11px] text-destructive">⚠ {p.reden}</p>}
                      </li>
                    );
                  })}
                  {plan.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Geen productierijpe brief. Gebundelde, geblokkeerde en beoordelingsdossiers blijven hierboven zichtbaar.</li>}
                </ul>
              </section>
            )}

            {stap === 'klaar' && resultaat && (
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <Stat label="Aangemaakt" value={resultaat.aangemaakt} tone="success" />
                  <Stat label="Vernieuwd" value={resultaat.vernieuwd} tone="success" />
                  <Stat label="Ongewijzigd" value={resultaat.hergebruikt} />
                  <Stat label="Gebundeld" value={resultaat.gebundeld} />
                  <Stat label="Beoordelen" value={resultaat.beoordeling} />
                  <Stat label="Overgeslagen" value={resultaat.overgeslagen} />
                  <Stat label="Mislukt" value={resultaat.mislukt} tone={resultaat.mislukt ? 'danger' : 'default'} />
                </div>
                {resultaat.fouten.length > 0 && <ul className="text-[11px] text-destructive list-disc pl-4">{resultaat.fouten.map((f, i) => <li key={i}>{f.bericht}</li>)}</ul>}
                <p className="text-sm text-muted-foreground">De gecombineerde PDF gebruikt nu alleen de expliciet geproduceerde conceptbrieven; contextsignalen blijven aan de partij/campagne gekoppeld.</p>
              </section>
            )}
          </div>

          <div data-testid="bulk-wizard-footer" className="border-t bg-background/95 backdrop-blur px-5 py-3 flex flex-wrap items-center justify-between gap-2" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <div className="text-[11px] text-muted-foreground" data-testid="bulk-toolbar-telling">
              {aantalGeselecteerdeSignalen} signalen · {new Set(geselecteerdeProductie.map((r) => r.partij.eigenaarId)).size} partijen · {sam.aanmaken + sam.hergebruiken} brieven · {gebundeldAantal} context
            </div>
            <div className="flex flex-wrap gap-2">
              {stap !== 'geadresseerden' && stap !== 'klaar' && <Button type="button" variant="ghost" size="sm" onClick={() => setStap(stap === 'controle' ? 'instellingen' : 'geadresseerden')} disabled={bezig}><ChevronLeft className="h-4 w-4" /> Vorige</Button>}
              {stap === 'geadresseerden' && <Button type="button" size="sm" onClick={() => setStap('instellingen')} disabled={partyContext.isLoading || partyContext.isError || geselecteerdeProductie.length === 0} data-testid="bulk-wizard-volgende">Volgende <ChevronRight className="h-4 w-4" /></Button>}
              {stap === 'instellingen' && <Button type="button" size="sm" onClick={() => setStap('controle')} data-testid="bulk-wizard-volgende">Volgende <ChevronRight className="h-4 w-4" /></Button>}
              {stap === 'controle' && <Button type="button" size="sm" onClick={bevestigOpslaan} disabled={bezig || (sam.aanmaken + sam.hergebruiken) === 0} data-testid="bulk-wizard-bevestig">{bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Concepten opslaan</Button>}
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
