// Compacte componententabel met detail-drawer (sub-fase 4C).
// Gebruikt bestaande update/delete-handlers — geen rekenlogica.
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2 } from 'lucide-react';
import { RawNumberInput, RawTextInput, numberToRaw, parseRawNumber } from '../RawInputs';
import { fmtEur, fmtM2 } from '../format';
import { formatUnitIdentity } from '@/lib/vastgoedrekenen/unitIdentity';
import { VR_COMPONENT_LABELS, VR_OVB_CLASSIFICATION_LABELS } from '@/lib/vastgoedrekenen/defaults';
import type { Component, ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { Chip, DrawerField } from './tableShared';

type Props = {
  components: Component[];
  ovbPerComponent: ComputedOutputs['ovbPerComponent'];
  ovbMode: string;
  sellOffUnitsCount: number;
  updateComponent: (id: string, patch: Partial<Component>) => Promise<void> | void;
  deleteComponent: (id: string) => Promise<void> | void;
};

export default function ComponentenTable({ components, ovbPerComponent, ovbMode, sellOffUnitsCount, updateComponent, deleteComponent }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const perComp = ovbMode === 'per_component';
  const openComp = openId ? components.find((c) => c.id === openId) ?? null : null;

  const totalM2 = components.reduce((s, c) => s + Number(c.surface_gbo ?? 0), 0);
  const totalRent = components.reduce((s, c) => s + Number(c.current_monthly_rent ?? 0), 0);
  const totalOvb = perComp ? ovbPerComponent.reduce((s, d) => s + Number(d.amount ?? 0), 0) : 0;
  const woon = components.filter((c) => c.component_type === 'woning' || c.component_type === 'appartement').length;
  const comm = components.length - woon;
  const warnings = perComp ? ovbPerComponent.filter((d) => d.missingValueBasis || d.missingStrategyBasis || d.missingManualAmount).length : 0;

  if (components.length === 0) return null;

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table className="text-xs w-full min-w-[520px] xl:min-w-0 [&_th]:px-2 [&_td]:px-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[88px] sm:min-w-[120px] sm:sticky sm:left-0 sm:bg-card sm:z-10">Unit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">m²</TableHead>
              <TableHead className="text-right">Maandhuur</TableHead>
              <TableHead className="text-right hidden md:table-cell">Markthuur</TableHead>
              {perComp && <TableHead className="text-right hidden lg:table-cell">OVB-%</TableHead>}
              {perComp && <TableHead className="text-right">OVB</TableHead>}
              <TableHead>Status</TableHead>
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {components.map((c, idx) => {
              const ident = formatUnitIdentity({ label: c.component_name, type: c.component_type, surface: c.surface_gbo as number | null }, idx);
              const diag = perComp ? ovbPerComponent.find((p) => p.id === c.id) : null;
              const missing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);
              const monthly = Number(c.current_monthly_rent ?? 0);
              const markt = Number(c.market_monthly_rent ?? 0);
              const m2 = Number(c.surface_gbo ?? 0);
              return (
                <TableRow
                  key={c.id}
                  id={`componenten-unit-${c.id}`}
                  className="cursor-pointer hover:bg-muted/40 scroll-mt-24"
                  onClick={() => setOpenId(c.id)}
                >
                  <TableCell className="font-mono-data text-muted-foreground tabular-nums">{ident.indexStr}</TableCell>
                  <TableCell className="font-medium break-words min-w-[88px] sm:min-w-[120px] sm:sticky sm:left-0 sm:bg-card sm:group-hover:bg-muted/40">{ident.primary}</TableCell>
                  <TableCell className="break-words">{VR_COMPONENT_LABELS[c.component_type] ?? c.component_type}</TableCell>
                  <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{m2 > 0 ? fmtM2(m2, 0) : '—'}</TableCell>
                  <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{monthly > 0 ? fmtEur(monthly) : '—'}</TableCell>
                  <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap hidden md:table-cell">{markt > 0 ? fmtEur(markt) : '—'}</TableCell>
                  {perComp && <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap hidden lg:table-cell">{diag ? `${diag.pct.toFixed(diag.pct % 1 === 0 ? 0 : 1)}%` : '—'}</TableCell>}
                  {perComp && <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{diag ? fmtEur(diag.amount) : '—'}</TableCell>}
                  <TableCell>
                    {missing
                      ? <Chip label="Niet compleet" tone="warning" />
                      : <Chip label="OK" tone="positive" />}
                  </TableCell>

                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => deleteComponent(c.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" aria-label="Component verwijderen">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/60 font-semibold border-t-2">
              <TableCell />
              <TableCell colSpan={2} className="break-words whitespace-normal">
                Totaal {components.length} units · {woon} woon · {comm} commercieel{warnings > 0 ? ` · ${warnings} aandacht` : ''}
              </TableCell>
              <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtM2(totalM2, 0)}</TableCell>
              <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtEur(totalRent)}</TableCell>
              <TableCell className="hidden md:table-cell" />
              {perComp && <TableCell className="hidden lg:table-cell" />}
              {perComp && <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtEur(totalOvb)}</TableCell>}
              <TableCell colSpan={2} />
            </TableRow>
          </TableBody>
        </Table>
      </div>

      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openComp && (() => {
            const c = openComp;
            const idx = components.findIndex((x) => x.id === c.id);
            const ident = formatUnitIdentity({ label: c.component_name, type: c.component_type, surface: c.surface_gbo as number | null }, idx);
            const diag = perComp ? ovbPerComponent.find((p) => p.id === c.id) : null;
            const ovbMissing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="break-words">{ident.indexStr} — {ident.primary}</SheetTitle>
                  <SheetDescription className="break-words">{ident.meta.join(' · ') || 'Componentdetails'}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DrawerField label="Naam"><RawTextInput className="h-9" initialValue={c.component_name} onCommit={(raw) => updateComponent(c.id, { component_name: raw.trim() || 'Component' })} /></DrawerField>
                    <DrawerField label="Type">
                      <Select value={c.component_type} onValueChange={(v) => updateComponent(c.id, { component_type: v as Component['component_type'] })}>
                        <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(VR_COMPONENT_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                      </Select>
                    </DrawerField>
                    <DrawerField label="GBO (m²)"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(c.surface_gbo)} onCommit={(raw) => updateComponent(c.id, { surface_gbo: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="Maandhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.current_monthly_rent)} onCommit={(raw) => updateComponent(c.id, { current_monthly_rent: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="Markthuur / maand (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.market_monthly_rent)} onCommit={(raw) => updateComponent(c.id, { market_monthly_rent: parseRawNumber(raw) })} /></DrawerField>
                  </div>
                  {perComp && (
                    <div className="border-t pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <DrawerField label="Toegerekende waarde (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(c.allocated_component_value)} onCommit={(raw) => updateComponent(c.id, { allocated_component_value: parseRawNumber(raw) })} /></DrawerField>
                      <DrawerField label="OVB-classificatie">
                        <Select value={c.transfer_tax_classification ?? 'woning_belegging'} onValueChange={(v) => updateComponent(c.id, { transfer_tax_classification: v as Component['transfer_tax_classification'] })}>
                          <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
                          <SelectContent>{Object.entries(VR_OVB_CLASSIFICATION_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
                        </Select>
                      </DrawerField>
                      <DrawerField label="Toerekeningsmethode">
                        <Select value={c.transfer_tax_allocation_method ?? 'value'} onValueChange={(v) => updateComponent(c.id, { transfer_tax_allocation_method: v as Component['transfer_tax_allocation_method'] })}>
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
                  <div className="border-t pt-3 flex justify-end">
                    <Button variant="ghost" onClick={() => { void deleteComponent(c.id); setOpenId(null); }} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-1" /> Verwijderen
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>
    </>
  );
}
