// V3 — Bulk-actiedialog voor de Off-Market Acquisitieselectie:
//   • "Markeer geselecteerde brieven als geprint"
//   • "Markeer geselecteerde brieven als gepost"
//
// Hergebruikt uitsluitend bestaande domeinflow:
//   - useUpdateVerzendstatus  → printdatum + verzendstatus + event 'printed'
//   - useMarkBriefVerstuurd   → postdatum + verzendstatus + event 'posted'
//                                + statuspromotie signaal naar 'benaderd'
//   - useDataStore.addTaak    → bestaande opvolgtaaklogica
//   - berekenFollowUpDeadline + defaultFollowupDagen
//
// Idempotent: reeds geprinte/geposte brieven worden overgeslagen.
// Per brief/geadresseerde wordt één append-only event geregistreerd via
// de bestaande hooks — geen dubbele logging.

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Printer, Send } from 'lucide-react';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import { useUpdateVerzendstatus } from '@/hooks/useUpdateVerzendstatus';
import { useMarkBriefVerstuurd } from '@/hooks/useOffMarketBrieven';
import { useDataStore } from '@/hooks/useDataStore';
import { berekenFollowUpDeadline } from '@/lib/offMarket/brieven/markeerVerstuurd';
import { defaultFollowupDagen } from '@/lib/offMarket/email/emailProfielen';

export type MarkeerModus = 'geprint' | 'gepost';

interface Props {
  open: boolean;
  onClose: () => void;
  modus: MarkeerModus;
  signalen: OffMarketSignaal[];
  brieven: OffMarketBrief[];
}

interface Plan {
  /** Te verwerken brieven (post-kanaal, niet gearchiveerd, juiste status). */
  teVerwerken: OffMarketBrief[];
  /** Overgeslagen brieven met reden. */
  overgeslagen: Array<{ brief: OffMarketBrief; reden: string }>;
}

interface Resultaat {
  verwerkt: number;
  overgeslagen: number;
  mislukt: number;
  opvolgtakenAangemaakt: number;
  opvolgtakenHergebruikt: number;
  fouten: string[];
}

function isGeprint(b: OffMarketBrief): boolean {
  const v = (b.verzendstatus ?? '') as string;
  return v === 'geprint' || v === 'in_envelop' || v === 'gepost' || v === 'verzonden';
}

function isGepost(b: OffMarketBrief): boolean {
  const v = (b.verzendstatus ?? '') as string;
  return v === 'gepost' || v === 'verzonden' || b.status === 'verstuurd';
}

function bouwPlan(brieven: OffMarketBrief[], modus: MarkeerModus): Plan {
  const teVerwerken: OffMarketBrief[] = [];
  const overgeslagen: Plan['overgeslagen'] = [];
  for (const b of brieven) {
    if (b.archived_at) {
      overgeslagen.push({ brief: b, reden: 'Brief is gearchiveerd.' });
      continue;
    }
    if ((b.kanaal ?? 'post') !== 'post') {
      overgeslagen.push({ brief: b, reden: 'Brief is geen postbrief.' });
      continue;
    }
    if (modus === 'geprint') {
      if (isGeprint(b)) {
        overgeslagen.push({ brief: b, reden: 'Brief is al geprint of verder.' });
        continue;
      }
      teVerwerken.push(b);
    } else {
      if (!isGeprint(b)) {
        overgeslagen.push({ brief: b, reden: 'Brief is nog niet geprint.' });
        continue;
      }
      if (isGepost(b)) {
        overgeslagen.push({ brief: b, reden: 'Brief is al gepost.' });
        continue;
      }
      teVerwerken.push(b);
    }
  }
  return { teVerwerken, overgeslagen };
}

export default function MarkeerBulkDialog({
  open, onClose, modus, signalen, brieven,
}: Props) {
  const updateStatus = useUpdateVerzendstatus();
  const markeerVerstuurd = useMarkBriefVerstuurd();
  const { addTaak, taken } = useDataStore();

  const signaalIndex = useMemo(() => {
    const m = new Map<string, OffMarketSignaal>();
    for (const s of signalen) m.set(s.id, s);
    return m;
  }, [signalen]);

  const plan = useMemo(() => bouwPlan(brieven, modus), [brieven, modus]);

  const vandaag = new Date().toISOString().slice(0, 10);
  const [postdatum, setPostdatum] = useState(vandaag);
  const [bezig, setBezig] = useState(false);
  const [resultaat, setResultaat] = useState<Resultaat | null>(null);

  useEffect(() => {
    if (!open) {
      setResultaat(null);
      setBezig(false);
      setPostdatum(vandaag);
    }
  }, [open, vandaag]);

  const titel = modus === 'geprint'
    ? 'Markeer geselecteerde brieven als geprint'
    : 'Markeer geselecteerde brieven als gepost';

  const beschrijving = modus === 'geprint'
    ? 'Registreert printdatum en zet verzendstatus naar "geprint". Maakt geen taak aan en wijzigt geen signaalstatus.'
    : `Registreert postdatum, zet verzendstatus naar "gepost", promoveert signaal naar "benaderd" en plant opvolging volgens de bestaande regel (postdatum + ${defaultFollowupDagen('post')} dagen).`;

  async function uitvoeren() {
    setBezig(true);
    const res: Resultaat = {
      verwerkt: 0,
      overgeslagen: plan.overgeslagen.length,
      mislukt: 0,
      opvolgtakenAangemaakt: 0,
      opvolgtakenHergebruikt: 0,
      fouten: [],
    };
    try {
      if (modus === 'geprint') {
        for (const b of plan.teVerwerken) {
          try {
            await updateStatus.mutateAsync({
              id: b.id,
              signaal_id: b.signaal_id,
              geadresseerde_key: b.geadresseerde_key ?? null,
              campagne_stap: b.campagne_stap ?? null,
              kanaal: b.kanaal ?? 'post',
              nieuweStatus: 'geprint',
              printdatum: postdatum,
              event: 'printed',
            });
            res.verwerkt += 1;
          } catch (e: any) {
            res.mislukt += 1;
            res.fouten.push(`${labelVoor(b)}: ${e?.message ?? 'mislukt'}`);
          }
        }
      } else {
        const followUp = berekenFollowUpDeadline(postdatum, defaultFollowupDagen('post'));
        for (const b of plan.teVerwerken) {
          try {
            // Hergebruik/aanmaak van opvolgtaak — exact zelfde regels als
            // bestaande MarkeerVerstuurdDialog, zodat we geen tweede
            // takenregel introduceren.
            const geadresseerdeLabel =
              b.eigenaar_bedrijfsnaam || b.eigenaar_naam || 'eigenaar';
            const stap = (b.campagne_stap ?? '') as string;
            const stapNr = stap.endsWith('_2') ? 2 : stap.endsWith('_3') ? 3 : 1;
            const taakTitel = 'Brief 2 voorbereiden / opvolgen';
            const taakRegex = /brief\s*2|brief opvolgen/i;
            const eigenaarKey =
              (b.eigenaar_naam ?? b.eigenaar_bedrijfsnaam ?? '').trim().toLowerCase();
            const bestaande = (taken ?? []).find((t: any) =>
              t?.offMarketSignaalId === b.signaal_id
              && t?.status === 'open'
              && typeof t?.titel === 'string'
              && taakRegex.test(t.titel)
              && (!eigenaarKey || (t.notities ?? '').toLowerCase().includes(eigenaarKey)),
            );
            let taakId: string | null = null;
            if (bestaande) {
              taakId = (bestaande as any).id ?? null;
              res.opvolgtakenHergebruikt += 1;
            } else {
              try {
                const nieuw = await addTaak({
                  titel: taakTitel,
                  type: 'Follow-up',
                  deadline: followUp,
                  prioriteit: 'normaal',
                  status: 'open',
                  offMarketSignaalId: b.signaal_id,
                  notities: `Opvolging voor brief aan ${geadresseerdeLabel} (stap ${stapNr}) · post ${postdatum} · deadline ${followUp}.`,
                } as any);
                taakId = nieuw?.id ?? null;
                if (taakId) res.opvolgtakenAangemaakt += 1;
              } catch (e) {
                console.warn('Opvolgtaak aanmaken mislukt', e);
              }
            }
            await markeerVerstuurd.mutateAsync({
              id: b.id, postdatum,
              gekoppelde_taak_id: taakId,
              kanaal: 'post',
            });
            res.verwerkt += 1;
          } catch (e: any) {
            res.mislukt += 1;
            res.fouten.push(`${labelVoor(b)}: ${e?.message ?? 'mislukt'}`);
          }
        }
      }
      setResultaat(res);
      if (res.mislukt === 0) {
        toast.success(modus === 'geprint'
          ? `${res.verwerkt} brieven gemarkeerd als geprint.`
          : `${res.verwerkt} brieven gemarkeerd als gepost.`);
      } else {
        toast.warning(`${res.verwerkt} verwerkt, ${res.mislukt} mislukt.`);
      }
    } finally {
      setBezig(false);
    }
  }

  function labelVoor(b: OffMarketBrief): string {
    const s = signaalIndex.get(b.signaal_id);
    const naam = b.eigenaar_naam ?? b.eigenaar_bedrijfsnaam ?? 'onbekend';
    const obj = s?.adres ?? s?.titel ?? '';
    return `${naam}${obj ? ` (${obj})` : ''}`;
  }

  const Icon = modus === 'geprint' ? Printer : Send;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="sm:max-w-lg max-w-[95vw] p-0 overflow-hidden"
        data-testid={`markeer-bulk-dialog-${modus}`}
      >
        <div className="flex flex-col max-h-[90vh]">
          <DialogHeader className="p-5 pb-3 border-b">
            <DialogTitle className="flex items-center gap-2">
              <Icon className="h-4 w-4" /> {titel}
            </DialogTitle>
            <DialogDescription>{beschrijving}</DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-5 space-y-3">
            {!resultaat ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <Stat label="Te verwerken" value={plan.teVerwerken.length} />
                  <Stat label="Overgeslagen" value={plan.overgeslagen.length}
                    tone={plan.overgeslagen.length > 0 ? 'warn' : 'default'} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bulk-datum">
                    {modus === 'geprint' ? 'Printdatum' : 'Postdatum'}
                  </Label>
                  <Input
                    id="bulk-datum"
                    type="date"
                    value={postdatum}
                    onChange={(e) => setPostdatum(e.target.value)}
                    data-testid="bulk-datum-input"
                  />
                </div>
                {modus === 'gepost' && (
                  <p className="text-[11px] text-muted-foreground">
                    Opvolging wordt ingepland op{' '}
                    <span className="font-medium text-foreground">
                      {berekenFollowUpDeadline(postdatum, defaultFollowupDagen('post'))}
                    </span>.
                  </p>
                )}
                {plan.overgeslagen.length > 0 && (
                  <details className="text-[11px] text-muted-foreground">
                    <summary className="cursor-pointer">
                      Toon overgeslagen brieven ({plan.overgeslagen.length})
                    </summary>
                    <ul className="mt-1.5 space-y-0.5 list-disc pl-4">
                      {plan.overgeslagen.map((o) => (
                        <li key={o.brief.id}>
                          {labelVoor(o.brief)} — {o.reden}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            ) : (
              <div className="space-y-3" data-testid="markeer-bulk-resultaat">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <Stat label="Verwerkt" value={resultaat.verwerkt} tone="success" />
                  <Stat label="Overgeslagen" value={resultaat.overgeslagen} />
                  <Stat label="Mislukt" value={resultaat.mislukt}
                    tone={resultaat.mislukt > 0 ? 'danger' : 'default'} />
                  {modus === 'gepost' && (
                    <>
                      <Stat label="Taken aangemaakt" value={resultaat.opvolgtakenAangemaakt} />
                      <Stat label="Taken hergebruikt" value={resultaat.opvolgtakenHergebruikt} />
                    </>
                  )}
                </div>
                {resultaat.fouten.length > 0 && (
                  <ul className="text-[11px] text-destructive list-disc pl-4">
                    {resultaat.fouten.map((m, i) => <li key={i}>{m}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>

          <div
            className="border-t bg-background/95 backdrop-blur px-5 py-3 flex flex-wrap items-center justify-end gap-2"
            style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
          >
            {!resultaat ? (
              <>
                <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={bezig}>
                  Annuleren
                </Button>
                <Button
                  type="button" size="sm" onClick={uitvoeren}
                  disabled={bezig || plan.teVerwerken.length === 0}
                  data-testid="markeer-bulk-bevestig"
                >
                  {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
                  {modus === 'geprint' ? 'Markeer geprint' : 'Markeer gepost'}
                </Button>
              </>
            ) : (
              <Button type="button" size="sm" onClick={onClose} data-testid="markeer-bulk-sluit">
                Sluiten
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({
  label, value, tone = 'default',
}: { label: string; value: number; tone?: 'default' | 'success' | 'warn' | 'danger' }) {
  const cls =
    tone === 'success' ? 'border-success/40 bg-success/10 text-success'
    : tone === 'warn' ? 'border-amber-500/30 bg-amber-500/10 text-amber-700'
    : tone === 'danger' ? 'border-destructive/40 bg-destructive/10 text-destructive'
    : 'border-border bg-card text-foreground';
  return (
    <div className={`rounded-md border px-3 py-2 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-base font-semibold font-mono-data leading-none">{value}</p>
    </div>
  );
}
