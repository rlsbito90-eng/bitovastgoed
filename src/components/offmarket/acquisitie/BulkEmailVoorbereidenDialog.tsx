import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Copy, Loader2, Mail, MailCheck } from 'lucide-react';
import { toast } from 'sonner';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import {
  useMarkBriefVerstuurd,
  useUpsertBrief,
  type OffMarketBrief,
} from '@/hooks/useOffMarketBrieven';
import { EMAIL_PROFIEL_LABEL, EMAIL_STAP_LABEL } from '@/lib/offMarket/email/emailProfielen';
import { formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import {
  bouwBulkEmailPlan,
  type BulkEmailPlanItem,
} from '@/lib/offMarket/acquisitie/bulkEmail';

interface Props {
  open: boolean;
  onClose: () => void;
  signalen: OffMarketSignaal[];
  brieven: OffMarketBrief[];
}

function ontvangerLabel(item: BulkEmailPlanItem): string {
  return item.bedrijfsnaam || item.naam || item.email || 'Onbekende geadresseerde';
}

function kopieerTekst(item: BulkEmailPlanItem, brief: OffMarketBrief | null) {
  const onderwerp = brief?.onderwerp ?? item.onderwerp ?? '';
  const tekst = brief?.brieftekst ?? item.brieftekst ?? '';
  return [
    `Aan: ${item.email ?? ''}`,
    `Onderwerp: ${onderwerp}`,
    '',
    tekst,
  ].join('\n');
}

export default function BulkEmailVoorbereidenDialog({ open, onClose, signalen, brieven }: Props) {
  const queryClient = useQueryClient();
  const upsert = useUpsertBrief();
  const markVerstuurd = useMarkBriefVerstuurd();
  const [bezig, setBezig] = useState(false);
  const [aangemaaktPerKey, setAangemaaktPerKey] = useState<Record<string, OffMarketBrief>>({});
  const [geselecteerdVoorRegistratie, setGeselecteerdVoorRegistratie] = useState<Set<string>>(new Set());
  const [lokaalVerzonden, setLokaalVerzonden] = useState<Set<string>>(new Set());

  const plan = useMemo(() => bouwBulkEmailPlan(signalen, brieven), [signalen, brieven]);
  const signaalPerId = useMemo(() => new Map(signalen.map((signaal) => [signaal.id, signaal])), [signalen]);

  useEffect(() => {
    if (!open) return;
    setBezig(false);
    setAangemaaktPerKey({});
    setLokaalVerzonden(new Set());
    setGeselecteerdVoorRegistratie(new Set(
      plan.filter((item) => item.actie === 'hergebruiken' && item.bestaandeBrief).map((item) => item.key),
    ));
    // Alleen bij openen resetten; query-refetches mogen lokale voortgang niet wissen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const aanTeMaken = plan.filter((item) => item.actie === 'aanmaken' && !aangemaaktPerKey[item.key]);
  const hergebruikt = plan.filter((item) => item.actie === 'hergebruiken').length;
  const geblokkeerd = plan.filter((item) =>
    item.actie === 'geen_email' || item.actie === 'reeks_compleet' || item.actie === 'respons_geregistreerd',
  ).length;

  const briefVoorItem = (item: BulkEmailPlanItem): OffMarketBrief | null =>
    aangemaaktPerKey[item.key] ?? item.bestaandeBrief ?? null;

  const registreerbaar = plan.filter((item) => {
    const brief = briefVoorItem(item);
    return Boolean(brief && brief.status !== 'verstuurd' && !lokaalVerzonden.has(item.key));
  });
  const geselecteerdeRegistreerbare = registreerbaar.filter((item) => geselecteerdVoorRegistratie.has(item.key));

  const vernieuwBulkCaches = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['off-market-brieven-bulk'] }),
      queryClient.invalidateQueries({ queryKey: ['off-market-brieven-partijoverzicht'] }),
      queryClient.invalidateQueries({ queryKey: ['off_market_brieven'] }),
      queryClient.invalidateQueries({ queryKey: ['radar-party-campaign-context'] }),
    ]);
  };

  const bereidConceptenVoor = async () => {
    if (aanTeMaken.length === 0 || bezig) return;
    setBezig(true);
    let gelukt = 0;
    const fouten: string[] = [];
    const nieuw: Record<string, OffMarketBrief> = {};

    try {
      for (const item of aanTeMaken) {
        const signaal = signaalPerId.get(item.primairSignaalId);
        if (!signaal || !item.email || !item.campagneStap || !item.brieftekst) {
          fouten.push(ontvangerLabel(item));
          continue;
        }
        try {
          const brief = await upsert.mutateAsync({
            signaal_id: signaal.id,
            eigenaar_naam: item.naam,
            eigenaar_bedrijfsnaam: item.bedrijfsnaam,
            verzendadres: item.email,
            objectadres: formatSignaalAdres(signaal) || signaal.adres || null,
            objectomschrijving: formatSignaalAdres(signaal) || signaal.adres || null,
            onderwerp: item.onderwerp,
            brieftekst: item.brieftekst,
            status: 'concept',
            kanaal: 'email',
            campagne_stap: item.campagneStap,
            geadresseerde_key: `email:${item.email.trim().toLowerCase()}`,
            verzendstatus: 'concept',
          });
          nieuw[item.key] = brief;
          gelukt += 1;
        } catch {
          fouten.push(ontvangerLabel(item));
        }
      }

      if (Object.keys(nieuw).length > 0) {
        setAangemaaktPerKey((huidig) => ({ ...huidig, ...nieuw }));
        setGeselecteerdVoorRegistratie((huidig) => {
          const next = new Set(huidig);
          Object.keys(nieuw).forEach((key) => next.add(key));
          return next;
        });
        await vernieuwBulkCaches();
      }

      if (gelukt > 0) {
        toast.success(`${gelukt} e-mailconcept${gelukt === 1 ? '' : 'en'} voorbereid`, {
          description: 'Er is niets automatisch verstuurd.',
        });
      }
      if (fouten.length > 0) {
        toast.error(`${fouten.length} e-mailconcept${fouten.length === 1 ? '' : 'en'} niet voorbereid`, {
          description: fouten.slice(0, 3).join(', '),
        });
      }
    } finally {
      setBezig(false);
    }
  };

  const kopieerEmail = async (item: BulkEmailPlanItem) => {
    const brief = briefVoorItem(item);
    if (!item.email || !(brief?.brieftekst ?? item.brieftekst)) return;
    try {
      await navigator.clipboard.writeText(kopieerTekst(item, brief));
      toast.success('E-mail gekopieerd', { description: `${ontvangerLabel(item)} · ${item.email}` });
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  const registreerAlsVerzonden = async () => {
    if (geselecteerdeRegistreerbare.length === 0 || bezig) return;
    const aantal = geselecteerdeRegistreerbare.length;
    const akkoord = window.confirm(
      `${aantal} e-mail${aantal === 1 ? '' : 's'} als verzonden registreren?\n\nDit verstuurt géén e-mail. Gebruik deze actie pas nadat je de geselecteerde e-mails daadwerkelijk hebt verzonden.`,
    );
    if (!akkoord) return;

    setBezig(true);
    let gelukt = 0;
    const verzondenKeys = new Set<string>();
    try {
      for (const item of geselecteerdeRegistreerbare) {
        const brief = briefVoorItem(item);
        if (!brief) continue;
        try {
          await markVerstuurd.mutateAsync({
            id: brief.id,
            kanaal: 'email',
            email_profiel: item.profiel,
          });
          verzondenKeys.add(item.key);
          gelukt += 1;
        } catch {
          // De overige geselecteerde concepten blijven bewust onaangeraakt.
        }
      }

      if (verzondenKeys.size > 0) {
        setLokaalVerzonden((huidig) => new Set([...huidig, ...verzondenKeys]));
        setGeselecteerdVoorRegistratie((huidig) => {
          const next = new Set(huidig);
          verzondenKeys.forEach((key) => next.delete(key));
          return next;
        });
        await vernieuwBulkCaches();
      }

      if (gelukt === aantal) {
        toast.success(`${gelukt} e-mail${gelukt === 1 ? '' : 's'} als verzonden geregistreerd`, {
          description: 'De opvolgdatum wordt vanuit de bestaande e-maillogica gezet.',
        });
        onClose();
      } else {
        toast.error(`${gelukt} van ${aantal} e-mails geregistreerd`, {
          description: 'Niet-geregistreerde concepten blijven beschikbaar.',
        });
      }
    } finally {
      setBezig(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(waarde) => { if (!waarde) onClose(); }}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" data-testid="bulk-email-opvolging-dialog">
        <DialogHeader>
          <DialogTitle>Centrale e-mailopvolging</DialogTitle>
          <DialogDescription>
            Bereid E-mail 1, 2 of 3 voor vanuit de Radar-selectie. De volgende stap wordt uit de partijbrede e-mailhistorie bepaald. Er wordt niets automatisch verstuurd.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 sm:grid-cols-4" data-testid="bulk-email-opvolging-samenvatting">
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground">Partijen</p><p className="text-lg font-semibold">{plan.length}</p></div>
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground">Nieuw</p><p className="text-lg font-semibold">{aanTeMaken.length}</p></div>
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground">Concept aanwezig</p><p className="text-lg font-semibold">{hergebruikt}</p></div>
          <div className="rounded-md border p-2"><p className="text-[10px] uppercase text-muted-foreground">Geblokkeerd / klaar</p><p className="text-lg font-semibold">{geblokkeerd}</p></div>
        </div>

        <div className="rounded-md border border-amber-300 bg-amber-50/60 px-3 py-2 text-xs text-amber-950">
          Eén e-mail per uniek e-mailadres. Als dezelfde partij via meerdere geselecteerde signalen terugkomt, wordt die binnen deze actie gebundeld. Ontbrekende e-mailadressen en gestopte sequences blijven zichtbaar; er wordt niets stil weggefilterd.
        </div>

        <div className="space-y-2">
          {plan.map((item) => {
            const brief = briefVoorItem(item);
            const klaarVoorRegistratie = Boolean(brief && brief.status !== 'verstuurd' && !lokaalVerzonden.has(item.key));
            const verzonden = lokaalVerzonden.has(item.key) || brief?.status === 'verstuurd';
            return (
              <div key={item.key} className="rounded-lg border p-3" data-testid="bulk-email-opvolging-rij">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground break-words">{ontvangerLabel(item)}</p>
                    <p className="text-xs text-muted-foreground break-all">{item.email ?? 'Geen e-mailadres'}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] text-muted-foreground">
                      {item.campagneStap && <span className="rounded border bg-muted/30 px-1.5 py-0.5 font-medium text-foreground">{EMAIL_STAP_LABEL[item.campagneStap]}</span>}
                      <span className="rounded border bg-muted/30 px-1.5 py-0.5">{EMAIL_PROFIEL_LABEL[item.profiel]}</span>
                      {item.signaalIds.length > 1 && <span className="rounded border bg-muted/30 px-1.5 py-0.5">{item.signaalIds.length} objecten gebundeld</span>}
                      {item.actie === 'hergebruiken' && <span className="rounded border bg-muted/30 px-1.5 py-0.5">Bestaand concept</span>}
                      {aangemaaktPerKey[item.key] && <span className="rounded border bg-muted/30 px-1.5 py-0.5">Nieuw concept</span>}
                      {verzonden && <span className="rounded border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-emerald-900">Verzonden geregistreerd</span>}
                    </div>
                    {item.blokkade && <p className="mt-2 text-xs text-amber-900">{item.blokkade}</p>}
                    {item.onderwerp && <p className="mt-2 text-xs"><span className="font-medium">Onderwerp:</span> {brief?.onderwerp ?? item.onderwerp}</p>}
                  </div>

                  {(brief || item.actie === 'aanmaken') && !item.blokkade && (
                    <div className="flex shrink-0 flex-wrap items-center gap-2" data-no-row-select="true">
                      {klaarVoorRegistratie && (
                        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Checkbox
                            checked={geselecteerdVoorRegistratie.has(item.key)}
                            onCheckedChange={(waarde) => setGeselecteerdVoorRegistratie((huidig) => {
                              const next = new Set(huidig);
                              if (waarde === true) next.add(item.key); else next.delete(item.key);
                              return next;
                            })}
                            aria-label={`Selecteer ${ontvangerLabel(item)} voor verzendregistratie`}
                          />
                          registreren
                        </label>
                      )}
                      {brief && (
                        <Button type="button" size="sm" variant="outline" onClick={() => void kopieerEmail(item)}>
                          <Copy className="h-3.5 w-3.5" />Kopieer e-mail
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-3 sm:flex-row sm:items-center sm:justify-between">
          <Button type="button" variant="ghost" onClick={onClose} disabled={bezig}>Sluiten</Button>
          <div className="flex flex-col gap-2 sm:flex-row">
            {aanTeMaken.length > 0 && (
              <Button type="button" variant="secondary" onClick={() => void bereidConceptenVoor()} disabled={bezig} data-testid="bulk-email-concepten-voorbereiden">
                {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Concepten voorbereiden ({aanTeMaken.length})
              </Button>
            )}
            <Button type="button" onClick={() => void registreerAlsVerzonden()} disabled={bezig || geselecteerdeRegistreerbare.length === 0} data-testid="bulk-email-verzonden-registreren">
              {bezig ? <Loader2 className="h-4 w-4 animate-spin" /> : <MailCheck className="h-4 w-4" />}
              Als verzonden registreren ({geselecteerdeRegistreerbare.length})
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
