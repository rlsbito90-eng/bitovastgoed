import { useMemo, useState } from 'react';
import { CalendarPlus2, Check, ChevronDown, ChevronUp, Clock3, CornerDownRight, MoreHorizontal, Pencil, Plus, RefreshCw, Trash2, X } from 'lucide-react';
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
import { BIEDING_TYPE_LABELS, EXTRA_VOORWAARDEN_LABELS, type Bieding } from '@/lib/biedingen/types';
import { BIEDBOEK_FASE_LABELS, biedRondeLabel, bouwBiedboek, type BiedboekFase, type BiedboekTraject } from '@/lib/biedingen/offerBook';
import { antwoordRichtingVoorBod } from '@/lib/biedingen/progression';
import { actueleBiedpositie, bodKarakterLabel } from '@/lib/biedingen/actuelePositie';
import { compareConditions } from '@/lib/biedingen/compareConditions';
import { OfferStatusBadge } from './OfferBadges';
import OfferFormDialog from './OfferFormDialog';
import BiedboekAuditPanel from './BiedboekAuditPanel';
import BiedboekOpvolgingDialog from './BiedboekOpvolgingDialog';
import BiedboekAangepastBodDialog from './BiedboekAangepastBodDialog';
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
  const { items, loading, error, remove, update, refresh } = useBiedingen(scope);
  const { relaties, contactpersonen, getObjectById } = useDataStore();
  const trajecten = useMemo(() => bouwBiedboek(items), [items]);
  const [uitgeklapt, setUitgeklapt] = useState<Record<string, boolean>>({});
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Bieding | null>(null);
  const [counterTo, setCounterTo] = useState<Bieding | null>(null);
  const [newContext, setNewContext] = useState<{ objectId: string; relatieId: string } | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<Bieding | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Bieding | null>(null);
  const [revisionTarget, setRevisionTarget] = useState<Bieding | null>(null);
  const [opvolgingVoor, setOpvolgingVoor] = useState<BiedboekTraject | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [behandelingBezigId, setBehandelingBezigId] = useState<string | null>(null);
  const [auditVersie, setAuditVersie] = useState(0);
  const refreshMetAudit = async () => {
    await refresh();
    setAuditVersie(v => v + 1);
  };

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

  const handleAangepastBodGevraagd = async (bieding: Bieding, toelichting: string) => {
    if (bieding.richting !== 'van_koper') throw new Error('Alleen voor een kopersbod kan een aangepast kopersbod worden gevraagd.');
    const datum = new Date().toLocaleDateString('nl-NL');
    const extra = toelichting ? `${datum} · Aangepast bod gevraagd: ${toelichting}` : '';
    await update(bieding.id, {
      status: 'aangepast_bod_gevraagd',
      ...(extra ? { interneNotities: [bieding.interneNotities, extra].filter(Boolean).join('\n\n') } : {}),
    });
    setAuditVersie(v => v + 1);
  };

  const markeerInBehandeling = async (bieding: Bieding) => {
    if (behandelingBezigId || bieding.status !== 'ontvangen' || bieding.richting !== 'van_koper') return;
    setBehandelingBezigId(bieding.id);
    try {
      await update(bieding.id, { status: 'in_behandeling' });
      setAuditVersie(v => v + 1);
      toast.success('Kopersbod staat nu op In behandeling');
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Status aanpassen mislukt');
    } finally {
      setBehandelingBezigId(null);
    }
  };

  const relatieNaam = (relatieId: string) => {
    const r = relaties.find(x => x.id === relatieId);
    return r ? getRelatieNamen(r, contactpersonen).primair : 'Onbekende kandidaat';
  };
  const objectNaam = (objectId: string) => {
    const o = getObjectById(objectId);
    return o?.titel || o?.adres || 'Onbekend object';
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
      setAuditVersie(v => v + 1);
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
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setAuditOpen(v => !v)} aria-expanded={auditOpen}>
            <Clock3 className="h-4 w-4 mr-1" />{auditOpen ? 'Verberg logboek' : 'Wijzigingslogboek'}
          </Button>
          <Button size="sm" onClick={() => handleNew()}>
            <Plus className="h-4 w-4 mr-1" />Nieuw bod
          </Button>
        </div>
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

        {auditOpen && <BiedboekAuditPanel key={auditVersie} scope={scope} />}
        
        {trajecten.map(traject => {
          const open = uitgeklapt[traject.key] ?? trajecten.length === 1;
          const laatste = traject.laatste;
          const laatsteMoment = traject.momenten[traject.momenten.length - 1];
          const positie = actueleBiedpositie(traject);
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
                    {traject.isOpen && laatste.status === 'in_behandeling'
                      ? 'In behandeling'
                      : BIEDBOEK_FASE_LABELS[traject.fase]}
                  </span>
                </div>

                <div className="rounded-lg border border-border/60 bg-muted/20 p-3 space-y-1" aria-label="Actuele onderhandelingspositie">
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground font-semibold">Actuele stand</div>
                  <div className="text-sm font-semibold">{positie.titel}</div>
                  <p className="text-xs text-foreground/80"><span className="font-semibold">Volgende stap:</span> {positie.vervolgstap}</p>
                  <p className="text-[11px] text-muted-foreground">{positie.toelichting}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/30 p-3 min-w-0">
                    <div className="text-[11px] text-muted-foreground">Laatste kopersbod</div>
                    <div className="text-base font-semibold tabular-nums mt-1">{fmtEur(traject.laatsteKopersbod?.bedrag)}</div>
                    <div className="text-[11px] mt-1 text-muted-foreground">Karakter: {bodKarakterLabel(traject.laatsteKopersbod)}</div>
                  </div>
                  <div className="rounded-lg bg-muted/30 p-3 min-w-0">
                    <div className="text-[11px] text-muted-foreground">Laatste verkopersvoorstel</div>
                    <div className="text-base font-semibold tabular-nums mt-1">{fmtEur(traject.laatsteVerkopersvoorstel?.bedrag)}</div>
                    <div className="text-[11px] mt-1 text-muted-foreground">Karakter: {bodKarakterLabel(traject.laatsteVerkopersvoorstel)}</div>
                  </div>
                </div>

                {traject.laatsteKopersbod && traject.laatsteVerkopersvoorstel && (
                  <VoorwaardenVergelijking before={traject.laatsteKopersbod} after={traject.laatsteVerkopersvoorstel} beforeLabel="Koper" afterLabel="Verkoper" />
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  <span>Laatste stap: <span className="font-medium text-foreground">{laatste.status === 'aangepast_bod_gevraagd' ? 'Aangepast bod gevraagd' : laatsteMoment.label}</span> · {laatste.status === 'aangepast_bod_gevraagd' ? 'tijdstip in wijzigingslogboek' : laatsteMoment.datum ? fmtDate(laatsteMoment.datum) : 'datum onbekend'}</span>
                  {traject.verschil != null && <span>Verschil laatste voorstellen: <span className="font-semibold text-foreground">{fmtEur(Math.abs(traject.verschil))}</span></span>}
                  {delta && <span>Laatste kopersbod t.o.v. vraagprijs: {delta.label}</span>}
                  {traject.fase === 'afgewezen' && laatste.rejectedReason && <span className="text-destructive">Reden: {laatste.rejectedReason}</span>}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setUitgeklapt(s => ({ ...s, [traject.key]: !open }))}>
                    {open ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
                    {open ? 'Verberg verloop' : 'Bekijk verloop'} ({traject.momenten.length})
                  </Button>
                  {traject.isOpen && laatste.richting === 'van_koper' && laatste.status === 'ontvangen' && (
                    <Button variant="outline" size="sm"
                      disabled={behandelingBezigId !== null}
                      onClick={() => void markeerInBehandeling(laatste)}>
                      {behandelingBezigId === laatste.id ? 'Opslaan…' : 'In behandeling zetten'}
                    </Button>
                  )}
                  {traject.isOpen && laatste.richting !== 'intern' && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => handleCounter(laatste)}>
                        <CornerDownRight className="h-4 w-4 mr-1" />
                        {antwoordRichtingVoorBod(laatste) === 'van_koper'
                          ? 'Tegenbod koper registreren' : 'Tegenvoorstel verkoper'}
                      </Button>
                      {isKopersbod && laatste.status !== 'aangepast_bod_gevraagd' && (
                        <Button variant="outline" size="sm" onClick={() => setRevisionTarget(laatste)}>
                          <RefreshCw className="h-4 w-4 mr-1" />Aangepast bod gevraagd
                        </Button>
                      )}
                      {isKopersbod && laatste.bedrag != null && laatste.bedrag > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setAcceptTarget(laatste)}>
                          <Check className="h-4 w-4 mr-1" />Accepteren
                        </Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setRejectTarget(laatste)}>
                        <X className="h-4 w-4 mr-1" />{isKopersbod ? 'Bod afwijzen' : 'Afwijzing koper'}
                      </Button>
                    </>
                  )}
                  {traject.isOpen && (
                    <Button variant="ghost" size="sm" onClick={() => setOpvolgingVoor(traject)}>
                      <CalendarPlus2 className="h-4 w-4 mr-1" />Opvolging plannen
                    </Button>
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
                                {['afgewezen', 'ingetrokken', 'verlopen', 'geaccepteerd'].includes(bieding.status)
                                  ? <span className="text-[11px] text-muted-foreground">Voorstel geregistreerd</span>
                                  : <OfferStatusBadge bieding={bieding} />}
                                <span className="text-[11px] text-muted-foreground">{BIEDING_TYPE_LABELS[bieding.offerType]}</span>
                                {!(bieding.offerType === 'indicatief' && bodKarakterLabel(bieding) === 'Indicatief') && (
                                  <span className="text-[11px] text-muted-foreground">Karakter: {bodKarakterLabel(bieding)}</span>
                                )}
                                {parent && <span className="text-[11px] text-muted-foreground">Reactie op {fmtEur(parent.bedrag)}</span>}
                                {bieding.geldigTot && <span className="text-[11px] text-muted-foreground">Geldig t/m {fmtDate(bieding.geldigTot)}</span>}
                              </div>
                              {bieding.voorwaarden && <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">{bieding.voorwaarden}</p>}
                              {bieding.notities && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{bieding.notities}</p>}
                              <VoorwaardenSummary b={bieding} />
                              {parent && <VoorwaardenVergelijking before={parent} after={bieding} beforeLabel="Vorig voorstel" afterLabel="Dit voorstel" />}
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

      {formOpen && (
        <OfferFormDialog
          open={formOpen} onOpenChange={setFormOpen} bieding={editTarget} counterTo={counterTo}
          defaultObjectId={newContext?.objectId ?? defaults?.objectId}
          defaultRelatieId={newContext?.relatieId ?? defaults?.relatieId}
          defaultDealId={defaults?.dealId}
          defaultObjectPipelineId={defaults?.objectPipelineId}
          onSaved={refreshMetAudit}
        />
      )}
      {acceptTarget && (
        <OfferAcceptDialog open onOpenChange={open => !open && setAcceptTarget(null)}
          bieding={acceptTarget} onSaved={refreshMetAudit} />
      )}
      {rejectTarget && (
        <OfferRejectDialog open onOpenChange={open => !open && setRejectTarget(null)}
          bieding={rejectTarget} onSaved={refreshMetAudit} />
      )}
      {revisionTarget && (
        <BiedboekAangepastBodDialog
          bieding={revisionTarget} onOpenChange={open => !open && setRevisionTarget(null)}
          onConfirm={toelichting => handleAangepastBodGevraagd(revisionTarget, toelichting)}
        />
      )}
      {opvolgingVoor && (
        <BiedboekOpvolgingDialog
          traject={opvolgingVoor}
          relatieNaam={relatieNaam(opvolgingVoor.relatieId)}
          objectNaam={objectNaam(opvolgingVoor.objectId)}
          onOpenChange={open => !open && setOpvolgingVoor(null)}
        />
      )}
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
  const extra = b.extraVoorwaarden;
  return <div className="space-y-1 mt-2 text-xs text-muted-foreground">
    {voorwaarden.length > 0 && <p>{voorwaarden.join(' · ')}</p>}
    {extra?.length === 0 && <p>Geen aanvullende gestructureerde voorwaarden</p>}
    {extra?.length ? <ul className="space-y-1">
      {extra.map((v, i) => <li key={i} className="rounded border border-border/60 px-2 py-1.5">
        <span className="font-medium text-foreground">{EXTRA_VOORWAARDEN_LABELS[v.type] ?? v.type}</span>
        {v.karakter !== 'onbekend' && <span> · {v.karakter === 'voorbehoud' ? 'Voorbehoud' : 'Transactiebepaling'}</span>}
        {v.deadline && <span> · Uiterlijk {fmtDate(v.deadline)}</span>}
        {v.toelichting && <p className="whitespace-pre-wrap mt-0.5">{v.toelichting}</p>}
      </li>)}
    </ul> : null}
  </div>;
}

function VoorwaardenVergelijking({before, after, beforeLabel, afterLabel}: {before: Bieding; after: Bieding; beforeLabel: string; afterLabel: string}) {
  const rows = compareConditions(before, after);
  const changes = rows.filter(r => r.status === 'verschillend').length;
  return <details className="rounded-lg border border-border/60 p-2 text-xs">
    <summary className="cursor-pointer font-medium">Voorwaarden vergelijken · {changes} vastgestelde verschil{changes === 1 ? '' : 'len'}</summary>
    <div className="overflow-x-auto mt-2">
      <table className="w-full table-fixed text-left text-xs">
        <thead><tr className="text-muted-foreground"><th scope="col" className="w-1/3 py-2 pr-1 font-normal">Onderdeel</th><th scope="col" className="w-1/3 pr-1 font-normal">{beforeLabel}</th><th scope="col" className="w-1/3 font-normal">{afterLabel}</th></tr></thead>
        <tbody>{rows.map(row => <tr key={row.label} className="border-t align-top">
          <th scope="row" className="py-2 pr-1 font-normal break-words">{row.label}{row.status === 'verschillend' && <span className="block text-[10px] text-foreground font-semibold">Verschil</span>}{row.status === 'onbekend' && <span className="block text-[10px] text-muted-foreground">Niet volledig vergelijkbaar</span>}</th>
          <td className="py-2 pr-1 whitespace-pre-wrap break-words">{row.before}</td>
          <td className="py-2 whitespace-pre-wrap break-words">{row.after}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <p className="mt-2 text-muted-foreground">Niet vastgelegd betekent niet dat een voorwaarde is vervallen.</p>
  </details>;
}
