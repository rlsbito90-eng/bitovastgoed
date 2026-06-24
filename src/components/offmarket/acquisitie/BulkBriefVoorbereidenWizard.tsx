// V2 — Wizard "Brieven voorbereiden" voor de Off-Market Acquisitieselectie.
// Hergebruikt:
//   - bestaande brievenarchitectuur (useUpsertBrief, useBrievenVoorSignalen)
//   - bestaande dedupe via geadresseerde_key + campagne_stap + kanaal
//   - bestaande viewmodel/brieftekst-helpers
// Géén Kadaster, BAG, AI of e-mail. Mutaties pas in de laatste stap.

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ChevronLeft, ChevronRight, Loader2, Mail, Save, Users } from 'lucide-react';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { useUpsertBrief } from '@/hooks/useOffMarketBrieven';
import {
  bouwBriefPlan, bouwKandidatenVoorSignaal, inserPayloadVoorPlanItem,
  samenvatPlan, type BulkKandidaat, type PlanItem,
} from '@/lib/offMarket/acquisitie/bulkBrief';
import {
  CAMPAGNE_STAP_LABEL, STAP_VOLGORDE, type CampagneStap,
} from '@/lib/offMarket/brieven/groepering';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Geselecteerde signalen (mag al gefilterd zijn). */
  signalen: OffMarketSignaal[];
  /** Alle actieve brieven van die signalen (voor dedupe & plan). */
  brieven: OffMarketBrief[];
}

type Stap = 'geadresseerden' | 'instellingen' | 'controle' | 'klaar';

interface Resultaat {
  aangemaakt: number;
  hergebruikt: number;
  overgeslagen: number;
  mislukt: number;
  fouten: Array<{ signaalId: string; key: string; bericht: string }>;
}

export default function BulkBriefVoorbereidenWizard({
  open, onClose, signalen, brieven,
}: Props) {
  const upsert = useUpsertBrief();

  // ---- Stap 0: alle kandidaten per signaal -----------------------------
  const allKandidaten = useMemo<BulkKandidaat[]>(() => {
    const brievenPerSignaal = new Map<string, OffMarketBrief[]>();
    for (const b of brieven) {
      const arr = brievenPerSignaal.get(b.signaal_id) ?? [];
      arr.push(b);
      brievenPerSignaal.set(b.signaal_id, arr);
    }
    const out: BulkKandidaat[] = [];
    for (const s of signalen) {
      out.push(...bouwKandidatenVoorSignaal(s, brievenPerSignaal.get(s.id) ?? []));
    }
    return out;
  }, [signalen, brieven]);

  // ---- Wizard-state ----------------------------------------------------
  const [stap, setStap] = useState<Stap>('geadresseerden');
  const [excluded, setExcluded] = useState<Set<string>>(new Set());
  const [campagneStap, setCampagneStap] = useState<CampagneStap>('brief_1');
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<Resultaat | null>(null);

  // Init bij openen — vink alleen ongeschikte standaard uit.
  useEffect(() => {
    if (!open) return;
    setStap('geadresseerden');
    setCampagneStap('brief_1');
    setExcluded(new Set(
      allKandidaten
        .filter(k => !k.geschikt)
        .map(k => itemKey(k.signaalId, k.geadresseerdeKey)),
    ));
    setBezig(false);
    setResultaat(null);
  }, [open, allKandidaten]);

  function itemKey(signaalId: string, key: string) {
    return `${signaalId}|${key}`;
  }

  function toggle(signaalId: string, key: string) {
    const k = itemKey(signaalId, key);
    setExcluded(prev => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  }

  function selecteerAlleGeschikt() {
    setExcluded(new Set(
      allKandidaten
        .filter(k => !k.geschikt)
        .map(k => itemKey(k.signaalId, k.geadresseerdeKey)),
    ));
  }

  const kandidatenInScope = useMemo(
    () => allKandidaten.filter(k => !excluded.has(itemKey(k.signaalId, k.geadresseerdeKey))),
    [allKandidaten, excluded],
  );

  const plan = useMemo<PlanItem[]>(
    () => bouwBriefPlan({ kandidaten: kandidatenInScope, brieven, campagneStap }),
    [kandidatenInScope, brieven, campagneStap],
  );

  const sam = useMemo(() => samenvatPlan(plan), [plan]);

  const signaalIndex = useMemo(() => {
    const m = new Map<string, OffMarketSignaal>();
    for (const s of signalen) m.set(s.id, s);
    return m;
  }, [signalen]);

  // Toolbar-telling: signalen, geadresseerden, te maken brieven.
  const aantalGeselecteerdeSignalen = useMemo(() => {
    const s = new Set<string>();
    for (const k of kandidatenInScope) s.add(k.signaalId);
    return s.size;
  }, [kandidatenInScope]);

  async function bevestigOpslaan() {
    if (bezig) return; // beschermt tegen dubbelklik
    setBezig(true);
    const uit: Resultaat = {
      aangemaakt: 0, hergebruikt: 0, overgeslagen: 0, mislukt: 0, fouten: [],
    };
    try {
      for (const p of plan) {
        if (p.actie === 'overslaan') {
          uit.overgeslagen += 1;
          continue;
        }
        if (p.actie === 'hergebruiken') {
          // Niets overschrijven — bewaar bestaande handmatige tekst.
          uit.hergebruikt += 1;
          continue;
        }
        const s = signaalIndex.get(p.signaalId);
        if (!s) {
          uit.mislukt += 1;
          uit.fouten.push({
            signaalId: p.signaalId, key: p.geadresseerdeKey,
            bericht: 'Signaal niet meer beschikbaar.',
          });
          continue;
        }
        try {
          await upsert.mutateAsync(
            inserPayloadVoorPlanItem({ signaal: s, plan: p }) as any,
          );
          uit.aangemaakt += 1;
        } catch (e: any) {
          uit.mislukt += 1;
          uit.fouten.push({
            signaalId: p.signaalId, key: p.geadresseerdeKey,
            bericht: e?.message ?? 'Onbekende fout',
          });
        }
      }
      setResultaat(uit);
      setStap('klaar');
      const msg = `${uit.aangemaakt} aangemaakt · ${uit.hergebruikt} hergebruikt · ${uit.overgeslagen} overgeslagen`;
      if (uit.mislukt > 0) toast.error(`${msg} · ${uit.mislukt} mislukt`);
      else toast.success(msg);
    } finally {
      setBezig(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-3xl max-w-[95vw] p-0 overflow-hidden"
        data-testid="bulk-brief-wizard"
      >
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Brieven voorbereiden
            </DialogTitle>
            <DialogDescription>
              Bereid fysieke brieven voor alle geselecteerde geadresseerden voor.
              Concepten worden pas opgeslagen na expliciete bevestiging.
            </DialogDescription>
            <ol className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
              {[
                ['geadresseerden', '1. Geadresseerden'],
                ['instellingen', '2. Instellingen'],
                ['controle', '3. Controle'],
                ['klaar', '4. Resultaat'],
              ].map(([k, label]) => (
                <li
                  key={k}
                  data-active={stap === k}
                  className="data-[active=true]:text-foreground data-[active=true]:font-medium"
                >
                  {label}
                </li>
              ))}
            </ol>
          </DialogHeader>

          <div
            className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-3"
            data-testid="bulk-wizard-body"
          >
            {stap === 'geadresseerden' && (
              <section className="space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-muted-foreground">
                    {allKandidaten.length} geadresseerden gevonden voor {signalen.length} signaal{signalen.length === 1 ? '' : 'en'}.
                  </p>
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={selecteerAlleGeschikt}
                    data-testid="bulk-selecteer-alle-geschikt"
                  >
                    <Users className="h-3.5 w-3.5" />
                    Selecteer alle geschikte
                  </Button>
                </div>
                <ul className="rounded-md border divide-y" data-testid="bulk-kandidaten-lijst">
                  {allKandidaten.map((k) => {
                    const s = signaalIndex.get(k.signaalId);
                    const itm = itemKey(k.signaalId, k.geadresseerdeKey);
                    const checked = !excluded.has(itm);
                    return (
                      <li
                        key={itm}
                        data-testid="bulk-kandidaat-rij"
                        data-geschikt={k.geschikt}
                        className="flex items-start gap-3 p-3"
                      >
                        <Checkbox
                          checked={checked}
                          disabled={!k.geschikt}
                          onCheckedChange={() => toggle(k.signaalId, k.geadresseerdeKey)}
                          aria-label="Selecteer geadresseerde"
                        />
                        <div className="min-w-0 flex-1 space-y-0.5 text-sm">
                          <p className="font-medium break-words">
                            {k.naam ?? k.bedrijfsnaam ?? '(zonder naam)'}
                            {k.naam && k.bedrijfsnaam ? <span className="text-muted-foreground"> — {k.bedrijfsnaam}</span> : null}
                          </p>
                          {s && (
                            <p className="text-[11px] text-muted-foreground break-words">
                              Object: {s.adres ?? s.titel ?? '—'}{s.plaats ? `, ${s.plaats}` : ''}
                            </p>
                          )}
                          {k.verzendadres && (
                            <p className="text-[11px] text-muted-foreground whitespace-pre-line break-words">
                              {k.verzendadres}
                            </p>
                          )}
                          {!k.geschikt && k.blokkade && (
                            <p className="text-[11px] text-destructive">⚠ {k.blokkade}</p>
                          )}
                          {k.hints.length > 0 && (
                            <p className="text-[10px] text-muted-foreground">{k.hints.join(' · ')}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                  {allKandidaten.length === 0 && (
                    <li className="p-6 text-center text-sm text-muted-foreground">
                      Geen geadresseerden gevonden voor de geselecteerde signalen.
                    </li>
                  )}
                </ul>
              </section>
            )}

            {stap === 'instellingen' && (
              <section className="space-y-4 max-w-md">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium">Kanaal</label>
                  <div className="inline-flex items-center rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
                    Post
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Bulkverzending is in deze fase uitsluitend per post mogelijk.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="bulk-stap" className="text-sm font-medium">Campagne-stap</label>
                  <Select value={campagneStap} onValueChange={(v) => setCampagneStap(v as CampagneStap)}>
                    <SelectTrigger id="bulk-stap" data-testid="bulk-campagne-stap-trigger">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STAP_VOLGORDE.map(s => (
                        <SelectItem key={s} value={s} data-testid={`bulk-stap-${s}`}>
                          {CAMPAGNE_STAP_LABEL[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground">
                    Wordt op alle geselecteerde geadresseerden toegepast. Bestaande
                    concepten voor dezelfde stap worden hergebruikt — handmatig
                    aangepaste tekst blijft behouden.
                  </p>
                </div>
              </section>
            )}

            {stap === 'controle' && (
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <Stat label="Totaal" value={sam.totaal} />
                  <Stat label="Aanmaken" value={sam.aanmaken} tone="success" />
                  <Stat label="Hergebruiken" value={sam.hergebruiken} />
                  <Stat label="Overslaan" value={sam.overslaan} tone={sam.overslaan > 0 ? 'warn' : 'default'} />
                </div>
                <ul className="rounded-md border divide-y text-sm" data-testid="bulk-controle-lijst">
                  {plan.map(p => {
                    const s = signaalIndex.get(p.signaalId);
                    const k = p.kandidaat;
                    return (
                      <li
                        key={`${p.signaalId}|${p.geadresseerdeKey}|${p.campagneStap}`}
                        className="p-3 space-y-0.5"
                        data-actie={p.actie}
                        data-testid="bulk-plan-rij"
                      >
                        <p className="font-medium break-words">
                          {k.naam ?? k.bedrijfsnaam ?? '(zonder naam)'}
                          <span className="ml-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                            {p.actie === 'aanmaken' ? 'Aanmaken' : p.actie === 'hergebruiken' ? 'Hergebruiken' : 'Overslaan'}
                          </span>
                        </p>
                        <p className="text-[11px] text-muted-foreground break-words">
                          Object: {s?.adres ?? s?.titel ?? '—'}
                        </p>
                        {p.reden && (
                          <p className="text-[11px] text-destructive">⚠ {p.reden}</p>
                        )}
                      </li>
                    );
                  })}
                  {plan.length === 0 && (
                    <li className="p-6 text-center text-sm text-muted-foreground">
                      Geen geadresseerden geselecteerd.
                    </li>
                  )}
                </ul>
              </section>
            )}

            {stap === 'klaar' && resultaat && (
              <section className="space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
                  <Stat label="Aangemaakt" value={resultaat.aangemaakt} tone="success" />
                  <Stat label="Hergebruikt" value={resultaat.hergebruikt} />
                  <Stat label="Overgeslagen" value={resultaat.overgeslagen} />
                  <Stat label="Mislukt" value={resultaat.mislukt} tone={resultaat.mislukt > 0 ? 'danger' : 'default'} />
                </div>
                {resultaat.fouten.length > 0 && (
                  <ul className="text-[11px] text-destructive list-disc pl-4">
                    {resultaat.fouten.map((f, i) => (
                      <li key={i}>{f.bericht}</li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-muted-foreground">
                  U kunt nu de gecombineerde brief-PDF genereren vanuit de
                  Acquisitieselectie.
                </p>
              </section>
            )}
          </div>

          {/* Sticky footer — sluit aan op modalbodem, safe-area aware. */}
          <div
            data-testid="bulk-wizard-footer"
            className="border-t bg-background/95 backdrop-blur px-5 py-3 flex flex-wrap items-center justify-between gap-2"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            <div className="text-[11px] text-muted-foreground" data-testid="bulk-toolbar-telling">
              {aantalGeselecteerdeSignalen} signaal{aantalGeselecteerdeSignalen === 1 ? '' : 'en'} ·{' '}
              {kandidatenInScope.length} geadresseerde{kandidatenInScope.length === 1 ? '' : 'n'} ·{' '}
              {sam.aanmaken + sam.hergebruiken} brieven
            </div>
            <div className="flex flex-wrap gap-2">
              {stap !== 'geadresseerden' && stap !== 'klaar' && (
                <Button
                  type="button" variant="ghost" size="sm"
                  onClick={() => setStap(stap === 'controle' ? 'instellingen' : 'geadresseerden')}
                  disabled={bezig}
                >
                  <ChevronLeft className="h-4 w-4" /> Vorige
                </Button>
              )}
              {stap === 'geadresseerden' && (
                <Button
                  type="button" size="sm" onClick={() => setStap('instellingen')}
                  disabled={kandidatenInScope.length === 0}
                  data-testid="bulk-wizard-volgende"
                >
                  Volgende <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {stap === 'instellingen' && (
                <Button
                  type="button" size="sm" onClick={() => setStap('controle')}
                  data-testid="bulk-wizard-volgende"
                >
                  Volgende <ChevronRight className="h-4 w-4" />
                </Button>
              )}
              {stap === 'controle' && (
                <Button
                  type="button" size="sm"
                  onClick={bevestigOpslaan}
                  disabled={bezig || (sam.aanmaken + sam.hergebruiken) === 0}
                  data-testid="bulk-wizard-bevestig"
                >
                  {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Concepten opslaan
                </Button>
              )}
              {stap === 'klaar' && (
                <Button type="button" size="sm" onClick={onClose} data-testid="bulk-wizard-sluit">
                  Sluiten
                </Button>
              )}
              {stap !== 'klaar' && (
                <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={bezig}>
                  Annuleren
                </Button>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label, value, tone = 'default',
}: { label: string; value: number; tone?: 'default' | 'success' | 'warn' | 'danger' }) {
  const toneCls =
    tone === 'success' ? 'border-success/40 bg-success/10 text-success'
    : tone === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
    : tone === 'danger' ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : 'border-border bg-card text-foreground';
  return (
    <div className={`rounded-md border px-3 py-2 ${toneCls}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold font-mono-data leading-none">{value}</p>
    </div>
  );
}
