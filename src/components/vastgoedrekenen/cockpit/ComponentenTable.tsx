// Compacte componententabel met detail-drawer (sub-fase 4C).
// Gebruikt bestaande update/delete-handlers — geen rekenlogica.
// Mobiele UX: tap-vs-scroll (geen open bij scrollen), read-only-first met "Bewerken"-knop.
// Bulkselectie: checkboxes openen niet de drawer; verwijderen vereist bevestiging.
import { memo, useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Pencil, X } from 'lucide-react';
import { RawNumberInput, RawTextInput, numberToRaw, parseRawNumber } from '../RawInputs';
import { fmtEur, fmtEurPerM2, fmtM2 } from '../format';
import { formatUnitIdentity } from '@/lib/vastgoedrekenen/unitIdentity';
import { VR_COMPONENT_LABELS, VR_OVB_CLASSIFICATION_LABELS, isWoonComponentType } from '@/lib/vastgoedrekenen/defaults';
import type { Component, ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { Chip, DrawerField } from './tableShared';
import { useIsTouch } from '@/hooks/useIsTouch';
import { useTapVsScroll } from '@/hooks/useTapVsScroll';

type Props = {
  components: Component[];
  ovbPerComponent: ComputedOutputs['ovbPerComponent'];
  ovbMode: string;
  sellOffUnitsCount: number;
  updateComponent: (id: string, patch: Partial<Component>) => Promise<void> | void;
  deleteComponent: (id: string) => Promise<void> | void;
  bulkDeleteComponents?: (ids: string[]) => Promise<void> | void;
};

/** Componentwaarde voor €/m²: voorkeur toegerekend → anders OVB-grondslag bij per-component. */
function componentValueFor(c: Component, diag: ComputedOutputs['ovbPerComponent'][number] | null): number {
  const v = Number(c.allocated_component_value ?? 0);
  if (v > 0) return v;
  if (diag && diag.basisValue > 0) return diag.basisValue;
  return 0;
}

function areaSummary(c: Pick<Component, 'surface_gbo' | 'surface_vvo' | 'surface_bvo'>): string[] {
  const values: string[] = [];
  const gbo = Number(c.surface_gbo ?? 0);
  const vvo = Number(c.surface_vvo ?? 0);
  const bvo = Number(c.surface_bvo ?? 0);
  if (gbo > 0) values.push(`GBO ${fmtM2(gbo)}`);
  if (vvo > 0) values.push(`VVO ${fmtM2(vvo)}`);
  if (bvo > 0) values.push(`BVO ${fmtM2(bvo)}`);
  return values;
}

function ComponentenTable({ components, ovbPerComponent, ovbMode, sellOffUnitsCount, updateComponent, deleteComponent, bulkDeleteComponents }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const isTouch = useIsTouch();
  const [editMode, setEditMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmOpen, setConfirmOpen] = useState(false);
  const perComp = ovbMode === 'per_component';
  const openComp = openId ? components.find((c) => c.id === openId) ?? null : null;

  const totalGbo = components.reduce((sum, component) => sum + Number(component.surface_gbo ?? 0), 0);
  const totalVvo = components.reduce((sum, component) => sum + Number(component.surface_vvo ?? 0), 0);
  const totalBvo = components.reduce((sum, component) => sum + Number(component.surface_bvo ?? 0), 0);
  const totalRent = components.reduce((s, c) => s + Number(c.current_monthly_rent ?? 0), 0);
  const totalOvb = perComp ? ovbPerComponent.reduce((s, d) => s + Number(d.amount ?? 0), 0) : 0;
  const woon = components.filter((c) => isWoonComponentType(c.component_type)).length;
  const comm = components.length - woon;
  const warnings = perComp ? ovbPerComponent.filter((d) => d.missingValueBasis || d.missingStrategyBasis || d.missingManualAmount).length : 0;

  const { totalValue, avgEurPerM2 } = useMemo(() => {
    let val = 0; let m2 = 0;
    for (const c of components) {
      const diag = perComp ? ovbPerComponent.find((p) => p.id === c.id) ?? null : null;
      const v = componentValueFor(c, diag);
      const a = Number(c.surface_gbo ?? 0);
      if (v > 0 && a > 0) { val += v; m2 += a; }
    }
    return { totalValue: val, avgEurPerM2: m2 > 0 ? Math.round(val / m2) : 0 };
  }, [components, ovbPerComponent, perComp]);

  const allSelected = components.length > 0 && selected.size === components.length;
  const someSelected = selected.size > 0 && !allSelected;
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(components.map((c) => c.id)));
  const clearSelection = () => setSelected(new Set());

  async function doBulkDelete() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (bulkDeleteComponents) await bulkDeleteComponents(ids);
    else for (const id of ids) await deleteComponent(id);
    clearSelection();
    setConfirmOpen(false);
  }

  if (components.length === 0) return null;

  return (
    <>
      {(totalValue > 0 || totalGbo > 0 || totalVvo > 0 || totalBvo > 0) && (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2 mb-2">
          <Tile label="Totale componentwaarde" value={fmtEur(totalValue)} />
          <Tile label="Totaal GBO" value={totalGbo > 0 ? fmtM2(totalGbo) : '—'} />
          <Tile label="Totaal VVO" value={totalVvo > 0 ? fmtM2(totalVvo) : '—'} />
          <Tile label="Totaal BVO" value={totalBvo > 0 ? fmtM2(totalBvo) : '—'} />
          <Tile label="Gem. €/m² GBO" value={avgEurPerM2 > 0 ? fmtEurPerM2(avgEurPerM2) : '—'} accent />
        </div>
      )}

      {selected.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">
          <span className="font-medium">{selected.size} component(en) geselecteerd</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={clearSelection}><X className="h-3.5 w-3.5 mr-1" /> Selectie wissen</Button>
            <Button size="sm" variant="destructive" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="h-3.5 w-3.5 mr-1" /> Verwijderen
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-md border overflow-x-auto">
        <Table className="text-xs w-full min-w-[700px] xl:min-w-0 [&_th]:px-2 [&_td]:px-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Alles selecteren"
                />
              </TableHead>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[88px] sm:min-w-[120px]">Unit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right min-w-[145px]">Oppervlakte</TableHead>
              <TableHead className="text-right">Maandhuur</TableHead>
              <TableHead className="text-right hidden md:table-cell">Markthuur</TableHead>
              <TableHead className="text-right hidden lg:table-cell">€/m² GBO</TableHead>
              {perComp && <TableHead className="text-right hidden lg:table-cell">OVB-%</TableHead>}
              {perComp && <TableHead className="text-right">OVB</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((c, idx) => (
              <ComponentRow
                key={c.id}
                c={c}
                idx={idx}
                perComp={perComp}
                diag={perComp ? ovbPerComponent.find((p) => p.id === c.id) ?? null : null}
                selected={selected.has(c.id)}
                onToggleSelect={() => toggle(c.id)}
                onOpen={() => openRow(c.id)}
                onDelete={() => deleteComponent(c.id)}
              />
            ))}
            <TableRow className="bg-muted/60 font-semibold border-t-2">
              <TableCell />
              <TableCell />
              <TableCell colSpan={2} className="break-words whitespace-normal">
                Totaal {components.length} units · {woon} woon · {comm} commercieel{warnings > 0 ? ` · ${warnings} incompleet` : ''}
              </TableCell>
              <TableCell className="text-right font-mono-data tabular-nums whitespace-normal leading-snug">
                {totalGbo > 0 && <div>GBO {fmtM2(totalGbo)}</div>}
                {totalVvo > 0 && <div>VVO {fmtM2(totalVvo)}</div>}
                {totalBvo > 0 && <div>BVO {fmtM2(totalBvo)}</div>}
                {totalGbo <= 0 && totalVvo <= 0 && totalBvo <= 0 && '—'}
              </TableCell>
              <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtEur(totalRent)}</TableCell>
              <TableCell className="hidden md:table-cell" />
              <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap hidden lg:table-cell">{avgEurPerM2 > 0 ? fmtEurPerM2(avgEurPerM2) : '—'}</TableCell>
              {perComp && <TableCell className="hidden lg:table-cell" />}
              {perComp && <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtEur(totalOvb)}</TableCell>}
              <TableCell colSpan={2} />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{selected.size} component(en) verwijderen?</AlertDialogTitle>
            <AlertDialogDescription>
              Je staat op het punt {selected.size} component(en) te verwijderen. Dit kan gevolgen hebben voor OVB, WWS, componentstrategie en scenario-uitkomst. Weet je het zeker?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuleren</AlertDialogCancel>
            <AlertDialogAction onClick={() => void doBulkDelete()} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Verwijderen
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={openId !== null} onOpenChange={(o) => { if (!o) { setOpenId(null); setEditMode(false); } }}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openComp && (() => {
            const c = openComp;
            const idx = components.findIndex((x) => x.id === c.id);
            const identitySurface = Number(c.surface_gbo ?? 0) || Number(c.surface_vvo ?? 0) || Number(c.surface_bvo ?? 0) || null;
            const ident = formatUnitIdentity({ label: c.component_name, type: c.component_type, surface: identitySurface }, idx);
            const diag = perComp ? ovbPerComponent.find((p) => p.id === c.id) : null;
            const ovbMissing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);
            const readOnly = !editMode;
            const v = componentValueFor(c, diag ?? null);
            const gbo = Number(c.surface_gbo ?? 0);
            const epm2 = v > 0 && gbo > 0 ? Math.round(v / gbo) : 0;
            const areas = areaSummary(c);
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="break-words">{ident.indexStr} — {ident.primary}</SheetTitle>
                  <SheetDescription className="break-words">{ident.meta.join(' · ') || 'Componentdetails'}</SheetDescription>
                </SheetHeader>

                {readOnly && (
                  <div className="mt-3 flex items-center justify-between rounded-md border border-dashed bg-muted/30 px-3 py-2 text-xs">
                    <span className="text-muted-foreground">Alleen-lezen weergave — tik op "Bewerken" om wijzigingen te maken.</span>
                    <Button size="sm" variant="outline" onClick={() => setEditMode(true)} className="ml-2 shrink-0">
                      <Pencil className="h-3.5 w-3.5 mr-1" /> Bewerken
                    </Button>
                  </div>
                )}

                <div className={`mt-4 space-y-4 ${readOnly ? 'pointer-events-none opacity-90 [&_input]:bg-muted/40' : ''}`}>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DrawerField label="Naam"><RawTextInput className="h-9" initialValue={c.component_name} onCommit={(raw) => updateComponent(c.id, { component_name: raw.trim() || 'Component' })} /></DrawerField>
                    <DrawerField label="Type">
                      <Select value={c.component_type} onValueChange={(value) => updateComponent(c.id, { component_type: value as Component['component_type'] })} disabled={readOnly}>
                        <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(VR_COMPONENT_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                      </Select>
                    </DrawerField>
                    <DrawerField label="GBO — gebruiksoppervlakte (m²)"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(c.surface_gbo)} onCommit={(raw) => updateComponent(c.id, { surface_gbo: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="VVO — verhuurbare vloeroppervlakte (m²)"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(c.surface_vvo)} onCommit={(raw) => updateComponent(c.id, { surface_vvo: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="BVO — bruto vloeroppervlakte (m²)"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(c.surface_bvo)} onCommit={(raw) => updateComponent(c.id, { surface_bvo: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="Maandhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.current_monthly_rent)} onCommit={(raw) => updateComponent(c.id, { current_monthly_rent: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="Markthuur / maand (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.market_monthly_rent)} onCommit={(raw) => updateComponent(c.id, { market_monthly_rent: parseRawNumber(raw) })} /></DrawerField>
                  </div>
                  {(v > 0 || areas.length > 0) && (
                    <div className="text-[11px] rounded-md border border-dashed bg-muted/30 px-2 py-1.5 text-muted-foreground">
                      Componentwaarde: <span className="font-mono-data">{v > 0 ? fmtEur(v) : '—'}</span>
                      {areas.length > 0 && <> · <span className="font-mono-data">{areas.join(' · ')}</span></>}
                      {' · '}€/m² GBO: <span className="font-mono-data">{epm2 > 0 ? fmtEurPerM2(epm2) : '—'}</span>
                      {v > 0 && gbo <= 0 && <span className="ml-2 text-amber-700 dark:text-amber-300">⚠ GBO ontbreekt — €/m² GBO niet berekenbaar.</span>}
                    </div>
                  )}
                  {perComp && (
                    <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <DrawerField label="Toegerekende waarde (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.allocated_component_value)} onCommit={(raw) => updateComponent(c.id, { allocated_component_value: parseRawNumber(raw) })} /></DrawerField>
                      <DrawerField label="OVB-classificatie">
                        <Select value={c.transfer_tax_classification ?? 'woning_belegging'} onValueChange={(value) => updateComponent(c.id, { transfer_tax_classification: value as Component['transfer_tax_classification'] })} disabled={readOnly}>
                          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(VR_OVB_CLASSIFICATION_LABELS).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent>
                        </Select>
                      </DrawerField>
                      <DrawerField label="Toerekeningsmethode">
                        <Select value={c.transfer_tax_allocation_method ?? 'value'} onValueChange={(value) => updateComponent(c.id, { transfer_tax_allocation_method: value as Component['transfer_tax_allocation_method'] })} disabled={readOnly}>
                          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="value">Op waarde (handmatige toerekening)</SelectItem>
                            <SelectItem value="m2">Op m² (verdeling vraagprijs)</SelectItem>
                            <SelectItem value="strategy" disabled={sellOffUnitsCount === 0}>Uit componentstrategie{sellOffUnitsCount === 0 ? ' — geen units' : ''}</SelectItem>
                            <SelectItem value="manual">Handmatig bedrag</SelectItem>
                          </SelectContent>
                        </Select>
                      </DrawerField>
                      <DrawerField label="OVB-% (override)"><RawNumberInput className="h-9" format="percent" initialValue={numberToRaw(c.transfer_tax_percentage)} onCommit={(raw) => updateComponent(c.id, { transfer_tax_percentage: parseRawNumber(raw), transfer_tax_manual_override: raw.trim() !== '' })} /></DrawerField>
                    </div>
                  )}
                  {diag && (
                    <div className={`text-[11px] rounded-md border px-2 py-1.5 break-words whitespace-normal leading-snug ${ovbMissing ? 'border-amber-500/50 bg-amber-500/10 text-amber-900 dark:text-amber-200' : 'border-dashed bg-muted/30 text-muted-foreground'}`}>
                      <span className="font-medium">OVB:</span>{' '}
                      methode <span className="font-mono-data">{diag.basisMethod}</span> ·{' '}
                      grondslag <span className="font-mono-data">€ {diag.basisValue.toLocaleString('nl-NL')}</span> ·{' '}
                      {diag.pct.toFixed(2)}% ·{' '}
                      bedrag <span className="font-mono-data">€ {diag.amount.toLocaleString('nl-NL')}</span>
                      {diag.missingValueBasis && <div>⚠ Toegerekende waarde ontbreekt — OVB komt op € 0. Vul "Toegerekende waarde" in, kies "Op m²", "Uit componentstrategie" of voer handmatig bedrag in.</div>}
                      {diag.missingStrategyBasis && <div>⚠ Geen waarde uit componentstrategie gevonden — koppel het component aan een sell_off_unit of kies een andere methode.</div>}
                      {diag.missingManualAmount && <div>⚠ Handmatig bedrag niet ingevuld — OVB komt op € 0.</div>}
                    </div>
                  )}
                </div>

                <div className="border-t mt-4 pt-3 flex flex-wrap justify-between gap-2">
                  <Button variant="ghost" onClick={() => { void deleteComponent(c.id); setOpenId(null); setEditMode(false); }} className="text-destructive" disabled={readOnly}>
                    <Trash2 className="h-4 w-4 mr-1" /> Verwijderen
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" onClick={() => { setOpenId(null); setEditMode(false); }}>Sluiten</Button>
                    {readOnly && (
                      <Button onClick={() => setEditMode(true)}>
                        <Pencil className="h-4 w-4 mr-1" /> Bewerken
                      </Button>
                    )}
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );

  function openRow(id: string) {
    setOpenId(id);
    setEditMode(!isTouch);
  }
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border bg-card p-2 ${accent ? 'border-primary/40 text-primary' : ''}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold font-mono-data leading-snug">{value}</p>
    </div>
  );
}

/** Aparte rij-component zodat tap-vs-scroll hook per rij gebruikt kan worden. */
function ComponentRow({ c, idx, perComp, diag, selected, onToggleSelect, onOpen, onDelete }: {
  c: Component;
  idx: number;
  perComp: boolean;
  diag: ComputedOutputs['ovbPerComponent'][number] | null;
  selected: boolean;
  onToggleSelect: () => void;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const identitySurface = Number(c.surface_gbo ?? 0) || Number(c.surface_vvo ?? 0) || Number(c.surface_bvo ?? 0) || null;
  const ident = formatUnitIdentity({ label: c.component_name, type: c.component_type, surface: identitySurface }, idx);
  const missing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);
  const monthly = Number(c.current_monthly_rent ?? 0);
  const markt = Number(c.market_monthly_rent ?? 0);
  const gbo = Number(c.surface_gbo ?? 0);
  const value = componentValueFor(c, diag);
  const epm2 = value > 0 && gbo > 0 ? Math.round(value / gbo) : 0;
  const areas = areaSummary(c);
  const tap = useTapVsScroll(() => onOpen());
  return (
    <TableRow
      id={`componenten-unit-${c.id}`}
      className={`cursor-pointer hover:bg-muted/40 scroll-mt-24 ${selected ? 'bg-primary/5' : ''}`}
      onClick={onOpen}
      onTouchStart={tap.onTouchStart}
      onTouchMove={tap.onTouchMove}
      onTouchEnd={tap.onTouchEnd}
    >
      <TableCell onClick={(e) => e.stopPropagation()} onTouchStart={(e) => e.stopPropagation()} onTouchEnd={(e) => e.stopPropagation()}>
        <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Selecteer component" />
      </TableCell>
      <TableCell className="font-mono-data text-muted-foreground tabular-nums">{ident.indexStr}</TableCell>
      <TableCell className="font-medium break-words min-w-[88px] sm:min-w-[120px]">{ident.primary}</TableCell>
      <TableCell className="break-words">{VR_COMPONENT_LABELS[c.component_type] ?? c.component_type}</TableCell>
      <TableCell className="text-right font-mono-data tabular-nums whitespace-normal leading-snug">
        {areas.length > 0 ? areas.map((area) => <div key={area}>{area}</div>) : '—'}
      </TableCell>
      <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{monthly > 0 ? fmtEur(monthly) : '—'}</TableCell>
      <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap hidden md:table-cell">{markt > 0 ? fmtEur(markt) : '—'}</TableCell>
      <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap hidden lg:table-cell">{epm2 > 0 ? fmtEurPerM2(epm2) : (value > 0 ? <span className="text-amber-700 dark:text-amber-300" title="GBO ontbreekt">GBO ?</span> : '—')}</TableCell>
      {perComp && <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap hidden lg:table-cell">{diag ? `${diag.pct.toFixed(diag.pct % 1 === 0 ? 0 : 1)}%` : '—'}</TableCell>}
      {perComp && <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{diag ? fmtEur(diag.amount) : '—'}</TableCell>}
      <TableCell>
        {missing ? <Chip label="Incompleet" tone="danger" /> : <Chip label="Volledig" tone="positive" />}
      </TableCell>
      <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
        <Button size="sm" variant="ghost" onClick={onDelete} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" aria-label="Component verwijderen">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export default memo(ComponentenTable);
