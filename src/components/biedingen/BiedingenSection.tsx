import { useMemo, useState } from 'react';
import { Plus, MoreHorizontal, Pencil, Trash2, CornerDownRight, Check, X, Eye, EyeOff, Filter, ArrowDown, ArrowUp, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useBiedingen } from '@/hooks/useBiedingen';
import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen } from '@/lib/relatieNaam';
import { fmtEur, vraagprijsDelta, isVerlopen, dagenTotVerval, effectieveStatus } from '@/lib/biedingen/format';
import { OfferStatusBadge, OfferTypeBadge, OfferDirectionBadge } from './OfferBadges';
import OfferFormDialog from './OfferFormDialog';
import { OfferAcceptDialog, OfferRejectDialog } from './OfferConfirmDialogs';
import type { Bieding, BiedingStatus } from '@/lib/biedingen/types';

type Scope = { objectId: string } | { dealId: string } | { relatieId: string };
const ACTIEF: BiedingStatus[] = ['concept', 'ontvangen', 'in_behandeling', 'tegenvoorstel_gedaan', 'aangepast_bod_gevraagd'];

interface Props {
  scope: Scope;
  /** Vraagprijs voor delta-berekening (alleen object-scope) */
  vraagprijs?: number | null;
  /** Default voorvulwaarden voor "Nieuw" knop */
  defaults?: {
    objectId?: string;
    relatieId?: string;
    dealId?: string;
    objectPipelineId?: string;
  };
  /** Toon koppelingskolommen (object/relatie). Default: alles tonen behalve de eigen scope */
  toonObject?: boolean;
  toonRelatie?: boolean;
  title?: string;
  compact?: boolean;
}

export default function BiedingenSection({
  scope, vraagprijs, defaults, toonObject, toonRelatie,
  title = 'Biedingen', compact,
}: Props) {
  const { items, loading, error, remove, refresh } = useBiedingen(scope);
  const { relaties, contactpersonen, getObjectById } = useDataStore();

  const [showHistory, setShowHistory] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Bieding | null>(null);
  const [counterTo, setCounterTo] = useState<Bieding | null>(null);
  const [acceptTarget, setAcceptTarget] = useState<Bieding | null>(null);
  const [rejectTarget, setRejectTarget] = useState<Bieding | null>(null);

  const showObjectCol = toonObject ?? !('objectId' in scope);
  const showRelatieCol = toonRelatie ?? !('relatieId' in scope);

  const visible = useMemo(
    () => showHistory ? items : items.filter(b => ACTIEF.includes(effectieveStatus(b))),
    [items, showHistory],
  );

  const stats = useMemo(() => {
    const actief = items.filter(b => ACTIEF.includes(effectieveStatus(b)));
    const geaccepteerd = items.find(b => b.status === 'geaccepteerd') ?? null;
    const hoogsteActief = actief.reduce<Bieding | null>(
      (best, b) => (b.bedrag != null && (!best || (best.bedrag ?? 0) < b.bedrag) ? b : best), null);
    const laagsteActief = actief.reduce<Bieding | null>(
      (best, b) => (b.bedrag != null && (!best || (best.bedrag ?? Infinity) > b.bedrag) ? b : best), null);
    return { aantalActief: actief.length, totaalAantal: items.length, hoogsteActief, laagsteActief, geaccepteerd };
  }, [items]);

  const handleNew = () => { setEditTarget(null); setCounterTo(null); setFormOpen(true); };
  const handleEdit = (b: Bieding) => { setEditTarget(b); setCounterTo(null); setFormOpen(true); };
  const handleCounter = (b: Bieding) => { setEditTarget(null); setCounterTo(b); setFormOpen(true); };

  const renderRelatieLabel = (relatieId: string) => {
    const r = relaties.find(x => x.id === relatieId);
    if (!r) return '—';
    const { primair, secundair } = getRelatieNamen(r, contactpersonen);
    return (
      <div className="min-w-0">
        <div className="font-medium truncate">{primair}</div>
        {secundair && <div className="text-xs text-muted-foreground truncate">{secundair}</div>}
      </div>
    );
  };

  const renderObjectLabel = (objectId: string) => {
    const o = getObjectById(objectId);
    if (!o) return '—';
    return (
      <div className="min-w-0">
        <div className="font-medium truncate">{o.titel || o.adres || '(object)'}</div>
        <div className="text-xs text-muted-foreground truncate">{[o.plaats, o.status].filter(Boolean).join(' · ')}</div>
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Card className="section-card">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-3">
          <div className="min-w-0 flex items-center justify-between gap-2 sm:block">
            <CardTitle className="text-base flex items-center gap-2 flex-wrap">
              {title}
              <span className="text-xs font-normal text-muted-foreground">
                {stats.aantalActief} actief{stats.totaalAantal !== stats.aantalActief ? ` · ${stats.totaalAantal} totaal` : ''}
              </span>
            </CardTitle>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
            <Button variant="ghost" size="sm" onClick={() => setShowHistory(s => !s)} className="text-xs">
              {showHistory ? <><EyeOff className="h-3.5 w-3.5 mr-1" />Verberg historie</> : <><History className="h-3.5 w-3.5 mr-1" />Toon historie</>}
            </Button>
            <Button size="sm" onClick={handleNew}><Plus className="h-4 w-4 mr-1" />Nieuw bod</Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* KPI strip */}
          {!compact && items.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <KpiTile label="Open biedingen" value={String(stats.aantalActief)} />
              <KpiTile
                label="Hoogste actief"
                value={stats.hoogsteActief?.bedrag != null ? fmtEur(stats.hoogsteActief.bedrag) : '—'}
                sub={vraagprijs && stats.hoogsteActief?.bedrag
                  ? vraagprijsDelta(stats.hoogsteActief.bedrag, vraagprijs)?.label ?? undefined
                  : undefined}
                subTone={vraagprijs && stats.hoogsteActief?.bedrag
                  ? vraagprijsDelta(stats.hoogsteActief.bedrag, vraagprijs)?.tone : undefined}
                icon={<ArrowUp className="h-3.5 w-3.5" />}
              />
              <KpiTile
                label="Laagste actief"
                value={stats.laagsteActief?.bedrag != null ? fmtEur(stats.laagsteActief.bedrag) : '—'}
                icon={<ArrowDown className="h-3.5 w-3.5" />}
              />
              <KpiTile
                label="Geaccepteerd"
                value={stats.geaccepteerd?.bedrag != null ? fmtEur(stats.geaccepteerd.bedrag) : '—'}
                icon={<Check className="h-3.5 w-3.5" />}
                tone={stats.geaccepteerd ? 'emerald' : 'neutral'}
              />
            </div>
          )}

          {loading && <p className="text-sm text-muted-foreground">Laden…</p>}
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!loading && visible.length === 0 && (
            <div className="text-sm text-muted-foreground border border-dashed rounded-md py-8 text-center">
              {items.length === 0 ? 'Nog geen biedingen vastgelegd.' : 'Geen actieve biedingen. Toon historie om alles te zien.'}
            </div>
          )}

          {visible.length > 0 && (
            <>
              {/* Desktop tabel */}
              <div className="hidden md:block overflow-x-auto rounded-md border border-border/60">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs text-muted-foreground">
                    <tr>
                      <th className="text-left font-medium px-3 py-2">Datum</th>
                      {showObjectCol && <th className="text-left font-medium px-3 py-2">Object</th>}
                      {showRelatieCol && <th className="text-left font-medium px-3 py-2">Bieder</th>}
                      <th className="text-left font-medium px-3 py-2">Type</th>
                      <th className="text-right font-medium px-3 py-2">Bedrag</th>
                      {vraagprijs && <th className="text-right font-medium px-3 py-2">Δ vraagprijs</th>}
                      <th className="text-left font-medium px-3 py-2">Status</th>
                      <th className="text-left font-medium px-3 py-2">Voorwaarden</th>
                      <th className="px-3 py-2 w-10" />
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map(b => {
                      const delta = vraagprijs && b.bedrag ? vraagprijsDelta(b.bedrag, vraagprijs) : null;
                      const verlopen = isVerlopen(b);
                      const dagen = dagenTotVerval(b);
                      return (
                        <tr
                          key={b.id}
                          className="border-t border-border/40 hover:bg-muted/50 transition-colors cursor-pointer"
                          onClick={() => handleEdit(b)}
                        >
                          <td className="px-3 py-2 whitespace-nowrap">
                            <div>{new Date(b.bieddatum).toLocaleDateString('nl-NL')}</div>
                            {b.geldigTot && (
                              <div className={`text-[11px] ${verlopen ? 'text-destructive' : dagen != null && dagen <= 3 ? 'text-warning' : 'text-muted-foreground'}`}>
                                Geldig t/m {new Date(b.geldigTot).toLocaleDateString('nl-NL')}
                              </div>
                            )}
                          </td>
                          {showObjectCol && <td className="px-3 py-2 max-w-[220px]">{renderObjectLabel(b.objectId)}</td>}
                          {showRelatieCol && <td className="px-3 py-2 max-w-[220px]">{renderRelatieLabel(b.relatieId)}</td>}
                          <td className="px-3 py-2"><OfferTypeBadge type={b.offerType} /></td>
                          <td className="px-3 py-2 text-right font-medium whitespace-nowrap">
                            {b.bedrag != null ? fmtEur(b.bedrag) : '—'}
                            {b.counterOfferToId && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <CornerDownRight className="inline-block ml-1 h-3 w-3 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>Tegenvoorstel</TooltipContent>
                              </Tooltip>
                            )}
                          </td>
                          {vraagprijs && (
                            <td className={`px-3 py-2 text-right whitespace-nowrap text-xs ${
                              delta?.tone === 'positive' ? 'text-success' :
                              delta?.tone === 'negative' ? 'text-destructive' : 'text-muted-foreground'
                            }`}>
                              {delta?.label ?? '—'}
                            </td>
                          )}
                          <td className="px-3 py-2"><OfferStatusBadge bieding={b} /></td>
                          <td className="px-3 py-2 max-w-[200px]">
                            <VoorwaardenSummary b={b} />
                          </td>
                          <td className="px-3 py-2 text-right" onClick={e => e.stopPropagation()}>
                            <RowActions
                              b={b}
                              onEdit={() => handleEdit(b)}
                              onCounter={() => handleCounter(b)}
                              onAccept={() => setAcceptTarget(b)}
                              onReject={() => setRejectTarget(b)}
                              onDelete={async () => { await remove(b.id); }}
                            />
                          </td>
                        </tr>
                      );

                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-2">
                {visible.map(b => {
                  const delta = vraagprijs && b.bedrag ? vraagprijsDelta(b.bedrag, vraagprijs) : null;
                  return (
                    <div
                      key={b.id}
                      role="button"
                      tabIndex={0}
                      onClick={() => handleEdit(b)}
                      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleEdit(b); } }}
                      className="rounded-md border border-border/60 p-3 space-y-2 bg-card cursor-pointer hover:bg-muted/40 active:bg-muted/60 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {showRelatieCol && <div className="text-sm">{renderRelatieLabel(b.relatieId)}</div>}
                          {showObjectCol && <div className="mt-1 text-xs text-muted-foreground">{renderObjectLabel(b.objectId)}</div>}
                        </div>
                        <div onClick={e => e.stopPropagation()}>
                          <RowActions
                            b={b}
                            onEdit={() => handleEdit(b)}
                            onCounter={() => handleCounter(b)}
                            onAccept={() => setAcceptTarget(b)}
                            onReject={() => setRejectTarget(b)}
                            onDelete={async () => { await remove(b.id); }}
                          />
                        </div>
                      </div>
                      <div className="flex items-baseline justify-between gap-2 flex-wrap">
                        <div className="text-lg font-semibold">{b.bedrag != null ? fmtEur(b.bedrag) : '—'}</div>
                        {delta && (
                          <div className={`text-xs ${
                            delta.tone === 'positive' ? 'text-success' :
                            delta.tone === 'negative' ? 'text-destructive' : 'text-muted-foreground'
                          }`}>{delta.label}</div>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        <OfferStatusBadge bieding={b} />
                        <OfferTypeBadge type={b.offerType} />
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        {new Date(b.bieddatum).toLocaleDateString('nl-NL')}
                        {b.geldigTot && ` · geldig t/m ${new Date(b.geldigTot).toLocaleDateString('nl-NL')}`}
                      </div>
                      <VoorwaardenSummary b={b} className="text-xs" />
                    </div>
                  );

                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <OfferFormDialog
        open={formOpen} onOpenChange={setFormOpen}
        bieding={editTarget}
        counterTo={counterTo}
        defaultObjectId={defaults?.objectId}
        defaultRelatieId={defaults?.relatieId}
        defaultDealId={defaults?.dealId}
        defaultObjectPipelineId={defaults?.objectPipelineId}
        onSaved={refresh}
      />

      <OfferAcceptDialog open={!!acceptTarget} onOpenChange={o => !o && setAcceptTarget(null)} bieding={acceptTarget} />
      <OfferRejectDialog open={!!rejectTarget} onOpenChange={o => !o && setRejectTarget(null)} bieding={rejectTarget} />
    </TooltipProvider>
  );
}

function VoorwaardenSummary({ b, className = '' }: { b: Bieding; className?: string }) {
  const parts: string[] = [];
  if (b.financieringsvoorbehoud === 'ja') parts.push('Financiering: ja');
  if (b.financieringsvoorbehoud === 'geen') parts.push('Geen financ.voorb.');
  if (b.ddVoorbehoud === 'ja') parts.push('DD: ja');
  if (b.ddVoorbehoud === 'geen') parts.push('Geen DD-voorb.');
  if (b.gewensteLeveringTekst) parts.push(`Levering: ${b.gewensteLeveringTekst}`);
  else if (b.gewensteLevering) parts.push(`Levering: ${new Date(b.gewensteLevering).toLocaleDateString('nl-NL')}`);
  if (b.kostenType === 'kk') parts.push('k.k.');
  if (b.kostenType === 'von') parts.push('v.o.n.');

  if (parts.length === 0) return <span className={`text-muted-foreground ${className}`}>—</span>;
  return <span className={`text-muted-foreground line-clamp-2 ${className}`}>{parts.join(' · ')}</span>;
}

function RowActions({ b, onEdit, onCounter, onAccept, onReject, onDelete }: {
  b: Bieding;
  onEdit: () => void; onCounter: () => void;
  onAccept: () => void; onReject: () => void;
  onDelete: () => Promise<void>;
}) {
  const isActief = ACTIEF.includes(effectieveStatus(b));
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onEdit}><Pencil className="h-3.5 w-3.5 mr-2" />Bewerken</DropdownMenuItem>
        {isActief && (
          <>
            <DropdownMenuItem onClick={onCounter}><CornerDownRight className="h-3.5 w-3.5 mr-2" />Tegenvoorstel</DropdownMenuItem>
            <DropdownMenuItem onClick={onAccept}><Check className="h-3.5 w-3.5 mr-2 text-success" />Accepteren</DropdownMenuItem>
            <DropdownMenuItem onClick={onReject}><X className="h-3.5 w-3.5 mr-2 text-destructive" />Afwijzen</DropdownMenuItem>
          </>
        )}
        <DropdownMenuSeparator />
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem onSelect={e => e.preventDefault()} className="text-destructive">
              <Trash2 className="h-3.5 w-3.5 mr-2" />Verwijderen
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Bieding verwijderen?</AlertDialogTitle>
              <AlertDialogDescription>Deze actie is onomkeerbaar.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete}>Verwijderen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Tiny helper to avoid duplicate AlertDialogTitle typo in JSX above
function AlertingDialogTitleSafe() {
  return <>Bieding verwijderen?</>;
}

function KpiTile({ label, value, sub, subTone, icon, tone = 'neutral' }: {
  label: string; value: string; sub?: string;
  subTone?: 'positive' | 'negative' | 'neutral';
  icon?: React.ReactNode;
  tone?: 'neutral' | 'emerald';
}) {
  const subClass =
    subTone === 'positive' ? 'text-success' :
    subTone === 'negative' ? 'text-destructive' : 'text-muted-foreground';
  return (
    <div className={`rounded-md border border-border/60 p-3 ${tone === 'emerald' ? 'bg-success/5' : 'bg-muted/20'}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
        {icon}{label}
      </div>
      <div className="text-base font-semibold mt-1 truncate">{value}</div>
      {sub && <div className={`text-[11px] mt-0.5 ${subClass}`}>{sub}</div>}
    </div>
  );
}
