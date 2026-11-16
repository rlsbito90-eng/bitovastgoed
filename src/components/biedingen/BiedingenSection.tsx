import { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, CornerDownRight, MoreHorizontal, Pencil, Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { useBiedingen } from '@/hooks/useBiedingen';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen } from '@/lib/relatieNaam';
import { fmtDate, fmtEur, vraagprijsDelta } from '@/lib/biedingen/format';
import { BIEDING_STATUS_LABELS, BIEDING_TYPE_LABELS, type Bieding } from '@/lib/biedingen/types';
import { BIEDBOEK_FASE_LABELS, biedRondeLabel, bouwBiedboek, type BiedboekFase } from '@/lib/biedingen/offerBook';
import { nextCounterDirection } from '@/lib/biedingen/progression';
import { OfferStatusBadge } from './OfferBadges';
import OfferFormDialog from './OfferFormDialog';
import { OfferAcceptDialog, OfferRejectDialog } from './OfferConfirmDialogs';

type Scope = { objectId: string } | { dealId: string } | { relatieId: string };

interface Props {
  scope: Scope;
  vraagprijs?: number | null;
  defaults?: {
    objectId?: string;
    relatieId?: string;
    dealId?: string;
    objectPipelineId?: string;
  };
  toonObject?: boolean;
  toonRelatie?: boolean;
  title?: string;
  compact?: boolean;
}

const faseKleur: Record<BiedboekFase, string> = {
  concept: 'bg-muted text-muted-foreground',
  wacht_op_verkoper: 'bg-primary/10 text-primary',
  wacht_op_koper: 'bg-warning/10 text-warning',
  geaccepteerd: 'bg-success/10 text-success',
  afgewezen: 'bg-destructive/10 text-destructive',
  ingetrokken: 'bg-muted text-muted-foreground',
  verlopen: 'bg-muted text-muted-foreground',
};

export default function BiedingenSection({
  scope, vraagprijs, defaults, toonObject, toonRelatie, title = 'Biedingen', compact,
}: Props) {
  const { items, loading, error, remove, refresh } = useBiedingen(scope);
  const { relaties, contactpersonen, getObjectById } = useDataStore();
  const trajecten = useMemo(() => bouwBiedboek(items), [items]);
  const [uitgeklapt, setUitgeklapt] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Bieding | null>(null);
  const [counterTo, setCounterTo] = useState<Bieding | null>(null);
  const [newContext, setNewContext] = useState<{ objectId: string; relatieId: string } | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<Bieding | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Bieding | null>(null);

  const showObject = toonObject ?? !('objectId' in scope);
  const showRelatie = toonRelatie ?? !('relatieId' in scope);
  const aantalOpen = trajecten.filter(t => t.isOpen).length;
  const aantalGeaccepteerd = trajecten.filter(t => t.fase === 'geaccepteerd').length;

  const handleNew = (context?: { objectId: string; relatieId: string }) => {
    setNewContext(context ?? null);
    setEditTarget(null);
    setCounterTo(null);
    setFormOpen(true);
  };
  const handleEdit = (bieding: Bieding) => {
    setEditTarget(bieding);
    setCounterTo(null);
    setNewContext(null);
    setFormOpen(true);
  };
  const handleCounter = (bieding: Bieding) => {
    setCounterTo(bieding);
    setEditTarget(null);
    setNewContext(null);
    setFormOpen(true);
  };

  const renderRelatie = (relatieId: string) => {
    const relatie = relaties.find(r => r.id === relatieId);
    if (!relatie) return 'Onbekende kandidaat';
    const naam = getRelatieNamen(relatie, contactpersonen);
    return (
      <div className="min-w-0">
        <div className="font-semibold truncate">{naam.primair}</div>
        {naam.secundair && <div className="text-xs text-muted-foreground truncate">{naam.secundair}</div>}
      </div>
    );
  };

  const renderObject = (objectId: string) => {
    const object = getObjectById(objectId);
    if (!object) return 'Onbekend object';
    return <span>{object.titel || object.adres || '(object)'}{object.plaats ? ' · ' + object.plaats : ''}</span>;
  };

  const handleDelete = async (bieding: Bieding) => {
    try {
      await remove(bieding.id);
      toast.success('Bieding verwijderd');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Verwijderen mislukt');
    }
  };

  return (
    <Card className="section-card">
      <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">
            {aantalOpen} lopend · {trajecten.length} traject{trajecten.length === 1 ? '' : 'en'} · {items.length} onderhandelingsstap{items.length === 1 ? '' : 'pen'}
          </p>
        </div>
        <Button size="sm" onClick={() => handleNew()} className="self-start sm:self-auto">
          <Plus className="h-4 w-4 mr-1" />Nieuw bod
        </Button>
      </CardHeader>

      <CardContent className="space-y-3">
        {!compact && aantalGeaccepteerd > 0 && (
          <p className="text-xs text-success">{aantalGeaccepteerd} geaccepteerd traject{aantalGeaccepteerd === 1 ? '' : 'en'}</p>
        )}
        {loading && <p className="text-sm text-muted-foreground">Biedboek laden…</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!loading && !error && trajecten.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground text-center">
            Er zijn nog geen biedingen vastgelegd.
          </div>
        )}

        {trajecten.map(traject => {
          const open = uitgeklapt[traject.key] ?? trajecten.length === 1;
          const laatste = traject.laatste;
          const laatsteMoment = traject.momenten[traject.momenten.length - 1];
          const isKopersbod = laatste.richting === 'van_koper';
          const delta = vraagprijs && traject.laatsteKopersbod?.bedrag != null
            ? vraagprijsDelta(traject.laatsteKopersbod.bedrag, vraagprijs) : null;

          return (
            <section key={traject.key} className="rounded-xl border border-border/70 bg-card overflow-hidden">
              <div className="p-3 sm:p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 text-sm">
                    {showRelatie && renderRelatie(traject.relatieId)}
                    {showObject && <div className="text-xs text-muted-foreground mt-1">{renderObject(traject.objectId)}</div>}
                    {!showRelatie && !showObject && <div className="font-semibold">Onderhandeling</div>}
                  </div>
                  <span className={['rounded-full px-2.5 py-1 text-[11px] font-medium text-center shrink-0', faseKleur[traject.fase]].join(' ')}>
                    {BIEDBOEK_FASE_LABELS[traject.fase]}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/30 p-3 min-w-0">
                    <div className="text-[11px] text-muted-foreground">Laatste kopersbod</div>
                    <div className="text-base font-semibold tabular-nums mt-1">{fmtEur(traject.laatsteKopersbod?.bedrag)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3 min-w-0">
                    <div className="text-[11px] text-muted-foreground">Laatste verkopersvoorstel</div>
                    <div className="text-base font-semibold tabular-nums mt-1">{fmtEur(traject.laatsteVerkopersvoorstel?.bedrag)}</div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Laatste stap: <span className="font-medium text-foreground">{laatsteMoment.label}</span> · {laatsteMoment.datum ? fmtDate(laatsteMoment.datum) : 'datum onbekend'}</span>
                  {traject.verschil != null && <span>Verschil: <span className="font-semibold text-foreground">{fmtEur(Math.abs(traject.verschil))}</span></span>}
                  {delta && <span>Laatste kopersbod t.o.v. vraagprijs: {delta.label}</span>}
                  {traject.fase === 'afgewezen' && laatste.rejectedReason && <span className="text-destructive">Reden: {laatste.rejectedReason}</span>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setUitgeklapt(s => ({ ...s, [traject.key]: !open }))}>
                    {open ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    {open ? 'Verberg verloop' : 'Bekijk verloop'} ({traject.momenten.length})
                  </Button>
                  {traject.isOpen && laatste.richting !== 'intern' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleCounter(laatste)}>
                        <CornerDownRight className="h-4 w-4 mr-1" />
                        {nextCounterDirection(laatste.richting) === 'van_koper' ? 'Tegenbod koper' : 'Tegenvoorstel verkoper'}
                      </Button>
                      {isKopersbod && (
                        <Button variant="outline" size="sm" onClick={() => setAcceptTarget(laatste)}>
                          <Check className="h-4 w-4 mr-1" />Accepteren
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setRejectTarget(laatste)}>
                        <X className="h-4 w-4 mr-1" />Afwijzen
                      </Button>
                    </>
                  )}
                  {!traject.isOpen && (
                    <Button variant="ghost" size="sm" onClick={() => handleNew({ objectId: traject.objectId, relatieId: traject.relatieId })}>
                      <Plus className="h-4 w-4 mr-1" />Nieuw bod in traject
                    </Button>
                  )}
                </div>
              </div>

              {open && (
                <div className="border-t border-border/60 bg-muted/10 p-3 sm:p-4">
                  <div className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground mb-3">
                    Onderhandelingsverloop · oudste eerst
                  </div>
                  <ol className="space-y-2" aria-label="Onderhandelingsverloop">
                    {traject.momenten.map((moment, index) => {
                      const bieding = moment.bieding;
                      const beslissing = moment.soort !== 'bod';
                      const vanVerkoper = bieding.richting === 'van_verkoper' || bieding.richting === 'namens_verkoper';
                      const parent = traject.rondes.find(r => r.id === bieding.counterOfferToId);
                      return (
                        <li key={moment.key} className={[
                          'rounded-lg border-l-[3px] p-3 shadow-sm',
                          beslissing ? 'border-l-muted-foreground/50 bg-muted/30' : vanVerkoper ? 'border-l-accent bg-card' : 'border-l-primary bg-card',
                        ].join(' ')}>
                          <div className="flex items-start gap-2 justify-between">
                            <div className="min-w-0">
                              <div className="text-[11px] text-muted-foreground">
                                Stap {index + 1} · {moment.datum ? fmtDate(moment.datum) : 'Datum niet vastgelegd'}
                              </div>
                              <div className="font-semibold text-sm mt-0.5">{moment.label}</div>
                            </div>
                            {!beslissing && (
                              <div className="flex items-start gap-1 shrink-0">
                                <div className="text-base font-semibold tabular-nums">{fmtEur(bieding.bedrag)}</div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Acties voor deze biedingsstap">
                                      <MoreHorizontal className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => handleEdit(bieding)}>
                                      <Pencil className="h-3.5 w-3.5 mr-2" />Bewerken
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
                                          <Trash2 className="h-3.5 w-3.5 mr-2" />Verwijderen
                                        </DropdownMenuItem>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Biedingsstap verwijderen?</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Dit verwijdert een deel van de onderhandelingshistorie. Doe dit alleen bij een foutieve registratie.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Annuleren</AlertDialogCancel>
                                          <AlertDialogAction onClick={() => void handleDelete(bieding)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Verwijderen</AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            )}
                          </div>
                          {!beslissing ? (
                            <>
                              <div className="mt-2 flex flex-wrap items-center gap-2">
                                <OfferStatusBadge bieding={bieding} />
                                <span className="text-[11px] text-muted-foreground">{BIEDING_TYPE_LABELS[bieding.offerType]}</span>
                                {parent && <span className="text-[11px] text-muted-foreground">Reactie op {fmtEur(parent.bedrag)}</span>}
                                {bieding.geldigTot && <span className="text-[11px] text-muted-foreground">Geldig t/m {fmtDate(bieding.geldigTot)}</span>}
                              </div>
                              {bieding.voorwaarden && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{bieding.voorwaarden}</p>}
                              {bieding.notities && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{bieding.notities}</p>}
                              <VoorwaardenSummary b={bieding} />
                            </>
                          ) : (
                            <>
                              <p className="text-xs text-muted-foreground mt-1">
                                Betreft {biedRondeLabel(bieding).toLowerCase()} van {fmtEur(bieding.bedrag)}.
                              </p>
                              {moment.soort === 'afwijzing' && bieding.rejectedReason && (
                                <p className="text-xs text-destructive mt-1">Reden: {bieding.rejectedReason}</p>
                              )}
                            </>
                          )}
                        </li>
                      );
                    })}
                  </ol>
                </div>
              )}
            </section>
          );
        })}
      </CardContent>

      <OfferFormDialog
        open={formOpen} onOpenChange={setFormOpen} bieding={editTarget} counterTo={counterTo}
        defaultObjectId={newContext?.objectId ?? defaults?.objectId}
        defaultRelatieId={newContext?.relatieId ?? defaults?.relatieId}
        defaultDealId={defaults?.dealId}
        defaultObjectPipelineId={defaults?.objectPipelineId}
        onSaved={refresh}
      />
      <OfferAcceptDialog open={!!acceptTarget} onOpenChange={open => !open && setAcceptTarget(null)}
        bieding={acceptTarget} onSaved={refresh} />
      <OfferRejectDialog open={!!rejectTarget} onOpenChange={open => !open && setRejectTarget(null)}
        bieding={rejectTarget} onSaved={refresh} />
    </Card>
  );
}

function VoorwaardenSummary({ b }: { b: Bieding }) {
  const voorwaarden: string[] = [];
  if (b.financieringsvoorbehoud === 'ja') voorwaarden.push('Met financieringsvoorbehoud');
  if (b.financieringsvoorbehoud === 'geen') voorwaarden.push('Geen financieringsvoorbehoud');
  if (b.ddVoorbehoud === 'ja') voorwaarden.push('Met DD-voorbehoud');
  if (b.ddVoorbehoud === 'geen') voorwaarden.push('Geen DD-voorbehoud');
  if (b.gewensteLeveringTekst) voorwaarden.push('Levering: ' + b.gewensteLeveringTekst);
  else if (b.gewensteLevering) voorwaarden.push('Levering: ' + fmtDate(b.gewensteLevering));
  if (b.kostenType === 'kk') voorwaarden.push('k.k.');
  if (b.kostenType === 'von') voorwaarden.push('v.o.n.');
  if (voorwaarden.length === 0) return null;
  return <p className="text-xs text-muted-foreground mt-2">{voorwaarden.join(' · ')}</p>;
}
