// Eenvoudige, ontvangergerichte flow voor bestaande Radar-postopvolging.
// De eerder verzonden brief is bronwaarheid; partij-/campagnerouting uit de
// koude acquisitiewizard wordt hier bewust niet opnieuw uitgevoerd.

import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { useUpsertBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { CAMPAGNE_STAP_LABEL } from '@/lib/offMarket/brieven/groepering';
import {
  bouwBulkPostOpvolgPlan,
  type PostOpvolgRij,
} from '@/lib/offMarket/acquisitie/bulkPostOpvolging';
import { standaardtekstPayloadVoorPlanItem } from '@/lib/offMarket/acquisitie/bulkBrief';

interface Props {
  open: boolean;
  onClose: () => void;
  signalen: OffMarketSignaal[];
  brieven: OffMarketBrief[];
}

type Stap = 'ontvangers' | 'controle' | 'klaar';

function rijKey(rij: PostOpvolgRij): string {
  return `${rij.kandidaat.signaalId}|${rij.kandidaat.geadresseerdeKey}`;
}

export default function BulkVolgendeBriefDialog({ open, onClose, signalen, brieven }: Props) {
  const upsert = useUpsertBrief();
  const [stap, setStap] = useState<Stap>('ontvangers');
  const [uitgesloten, setUitgesloten] = useState<Set<string>>(new Set());
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<{ aangemaakt: number; hergebruikt: number; mislukt: number } | null>(null);

  const overzicht = useMemo(
    () => bouwBulkPostOpvolgPlan({ signalen, brieven, uitgeslotenKeys: uitgesloten }),
    [signalen, brieven, uitgesloten],
  );
  const signaalIndex = useMemo(
    () => new Map(signalen.map((signaal) => [signaal.id, signaal])),
    [signalen],
  );

  useEffect(() => {
    if (!open) return;
    setStap('ontvangers');
    setUitgesloten(new Set());
    setBezig(false);
    setResultaat(null);
  }, [open]);

  function toggle(rij: PostOpvolgRij) {
    if (!rij.productieToegestaan) return;
    const key = rijKey(rij);
    setUitgesloten((vorig) => {
      const volgend = new Set(vorig);
      if (volgend.has(key)) volgend.delete(key); else volgend.add(key);
      return volgend;
    });
  }

  async function bereidVoor() {
    if (bezig || overzicht.plan.length === 0) return;
    setBezig(true);
    let aangemaakt = 0;
    let hergebruikt = 0;
    let mislukt = 0;
    try {
      for (const planItem of overzicht.plan) {
        if (planItem.actie === 'hergebruiken') {
          hergebruikt += 1;
          continue;
        }
        if (planItem.actie === 'overslaan') continue;
        const signaal = signaalIndex.get(planItem.signaalId);
        if (!signaal) { mislukt += 1; continue; }
        try {
          await upsert.mutateAsync(standaardtekstPayloadVoorPlanItem({ signaal, plan: planItem }));
          aangemaakt += 1;
        } catch {
          mislukt += 1;
        }
      }
      setResultaat({ aangemaakt, hergebruikt, mislukt });
      setStap('klaar');
      const gereed = aangemaakt + hergebruikt;
      if (mislukt > 0) toast.error(`${gereed} vervolgbrieven voorbereid · ${mislukt} mislukt`);
      else toast.success(`${gereed} vervolgbrieven voorbereid`);
    } finally {
      setBezig(false);
    }
  }

  const geselecteerdeBrieven = overzicht.plan.filter((item) => item.actie !== 'overslaan').length;

  return (
    <Dialog open={open} onOpenChange={(waarde) => { if (!waarde && !bezig) onClose(); }}>
      <DialogContent className="max-w-[95vw] overflow-hidden p-0 sm:max-w-3xl" data-testid="bulk-volgende-brief-dialog">
        <div className="flex max-h-[90vh] flex-col">
          <DialogHeader className="border-b p-5 pb-3">
            <DialogTitle className="flex items-center gap-2"><Mail className="h-4 w-4" />Volgende brief voorbereiden</DialogTitle>
            <DialogDescription>
              De geselecteerde dossiers en bestaande geadresseerden blijven leidend. Per ontvanger wordt Brief 2 of Brief 3 bepaald uit de eigen verzendhistorie.
            </DialogDescription>
            <ol className="mt-2 flex gap-3 text-[11px] text-muted-foreground">
              <li className={stap === 'ontvangers' ? 'font-medium text-foreground' : ''}>1. Ontvangers</li>
              <li className={stap === 'controle' ? 'font-medium text-foreground' : ''}>2. Controle</li>
              <li className={stap === 'klaar' ? 'font-medium text-foreground' : ''}>3. Resultaat</li>
            </ol>
          </DialogHeader>

          <div className="flex-1 space-y-3 overflow-y-auto overflow-x-hidden p-5">
            {stap === 'ontvangers' && (
              <section className="space-y-3">
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                  <span className="font-medium">{overzicht.telling.signalen} dossiers → {overzicht.telling.geadresseerden} geadresseerden → {geselecteerdeBrieven} vervolgbrieven</span>
                  {overzicht.telling.uitzonderingen > 0 && <span className="text-muted-foreground"> · {overzicht.telling.uitzonderingen} uitzonderingen</span>}
                </div>
                <ul className="divide-y rounded-md border" data-testid="bulk-opvolg-ontvangers">
                  {overzicht.rijen.map((rij) => {
                    const key = rijKey(rij);
                    const signaal = signaalIndex.get(rij.kandidaat.signaalId);
                    const actief = rij.productieToegestaan && !uitgesloten.has(key);
                    return (
                      <li key={key} className="flex items-start gap-3 p-3" data-testid="bulk-opvolg-rij" data-productie={rij.productieToegestaan}>
                        <Checkbox
                          checked={actief}
                          disabled={!rij.productieToegestaan}
                          onCheckedChange={() => toggle(rij)}
                          aria-label="Vervolgbrief meenemen"
                        />
                        <div className="min-w-0 flex-1 space-y-1 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-medium break-words">{rij.kandidaat.bedrijfsnaam ?? rij.kandidaat.naam ?? '(zonder naam)'}</p>
                            {rij.volgendeStap && <span className="rounded-full border border-success/40 bg-success/10 px-2 py-0.5 text-[10px] text-success">{CAMPAGNE_STAP_LABEL[rij.volgendeStap]}</span>}
                            {rij.uitzondering && <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-800 dark:text-amber-200">Uitzondering</span>}
                          </div>
                          <p className="text-[11px] text-muted-foreground">Object: {signaal?.adres ?? signaal?.titel ?? '—'}{signaal?.plaats ? `, ${signaal.plaats}` : ''}</p>
                          <p className={`text-[11px] ${rij.uitzondering ? 'text-amber-800 dark:text-amber-200' : 'text-muted-foreground'}`}>{rij.reden}</p>
                          {rij.kandidaat.verzendadres && <p className="whitespace-pre-line text-[10px] text-muted-foreground">{rij.kandidaat.verzendadres}</p>}
                        </div>
                      </li>
                    );
                  })}
                  {overzicht.rijen.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Geen bestaande geadresseerden gevonden.</li>}
                </ul>
              </section>
            )}

            {stap === 'controle' && (
              <section className="space-y-3">
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Stat label="Dossiers" value={overzicht.telling.signalen} />
                  <Stat label="Brieven" value={geselecteerdeBrieven} accent />
                  <Stat label="Uitzonderingen" value={overzicht.telling.uitzonderingen} />
                </div>
                <ul className="divide-y rounded-md border text-sm" data-testid="bulk-opvolg-controle">
                  {overzicht.plan.map((item) => {
                    const signaal = signaalIndex.get(item.signaalId);
                    return (
                      <li key={`${item.signaalId}|${item.geadresseerdeKey}|${item.campagneStap}`} className="space-y-0.5 p-3">
                        <p className="font-medium">{item.kandidaat.bedrijfsnaam ?? item.kandidaat.naam ?? '(zonder naam)'}</p>
                        <p className="text-[11px] text-muted-foreground">{CAMPAGNE_STAP_LABEL[item.campagneStap]} · {signaal?.adres ?? signaal?.titel ?? '—'} · {item.actie === 'hergebruiken' ? 'bestaand concept behouden' : 'nieuw concept'}</p>
                      </li>
                    );
                  })}
                  {overzicht.plan.length === 0 && <li className="p-6 text-center text-sm text-muted-foreground">Geen vervolgbrief geselecteerd. Bekijk de uitzonderingen in de vorige stap.</li>}
                </ul>
                <p className="text-xs text-muted-foreground">Er wordt niets automatisch geprint of verzonden. Bestaande handmatig aangepaste concepten blijven ongewijzigd.</p>
              </section>
            )}

            {stap === 'klaar' && resultaat && (
              <section className="space-y-3">
                <div className="flex items-center gap-2 rounded-md border border-success/35 bg-success/10 p-3 text-sm text-success">
                  <CheckCircle2 className="h-4 w-4" />
                  <span className="font-medium">{resultaat.aangemaakt + resultaat.hergebruikt} vervolgbrieven staan klaar.</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <Stat label="Nieuw" value={resultaat.aangemaakt} accent />
                  <Stat label="Bestaand" value={resultaat.hergebruikt} />
                  <Stat label="Mislukt" value={resultaat.mislukt} />
                </div>
                <p className="text-sm text-muted-foreground">De concepten zijn beschikbaar bij Printen & posten. Verzendhistorie en eerdere brieven zijn niet gewijzigd.</p>
              </section>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t bg-background/95 px-5 py-3 backdrop-blur" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
            <p className="text-[11px] text-muted-foreground" data-testid="bulk-opvolg-telling">
              {overzicht.telling.signalen} dossiers · {overzicht.telling.geadresseerden} geadresseerden · {geselecteerdeBrieven} brieven · {overzicht.telling.uitzonderingen} uitzonderingen
            </p>
            <div className="flex flex-wrap gap-2">
              {stap === 'controle' && <Button type="button" size="sm" variant="ghost" onClick={() => setStap('ontvangers')} disabled={bezig}><ChevronLeft className="h-4 w-4" />Vorige</Button>}
              {stap === 'ontvangers' && <Button type="button" size="sm" onClick={() => setStap('controle')} disabled={geselecteerdeBrieven === 0}>Controle <ChevronRight className="h-4 w-4" /></Button>}
              {stap === 'controle' && <Button type="button" size="sm" onClick={bereidVoor} disabled={bezig || geselecteerdeBrieven === 0}>{bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{geselecteerdeBrieven} concepten voorbereiden</Button>}
              {stap === 'klaar' && <Button type="button" size="sm" onClick={onClose}>Sluiten</Button>}
              {stap !== 'klaar' && <Button type="button" size="sm" variant="ghost" onClick={onClose} disabled={bezig}>Annuleren</Button>}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className={`rounded-md border px-3 py-2 ${accent ? 'border-success/40 bg-success/10 text-success' : 'border-border bg-card text-foreground'}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono-data text-base font-semibold leading-none">{value}</p>
    </div>
  );
}
