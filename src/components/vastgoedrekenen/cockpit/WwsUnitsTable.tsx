// Compacte WWS-units tabel met detail-drawer (sub-fase 4C).
// Hergebruikt bestaande update/delete/recompute-handlers — geen rekenlogica.
import { useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RotateCw, Trash2 } from 'lucide-react';
import { RawNumberInput, RawTextInput, numberToRaw, parseRawNumber } from '../RawInputs';
import { fmtEur, fmtM2 } from '../format';
import { formatUnitIdentity } from '@/lib/vastgoedrekenen/unitIdentity';
import {
  getWwsUnitStatus,
  WWS_SOURCE_LABEL,
  WWS_SCHEME_LABEL,
  WWS_RELIABILITY_LABEL,
  WWS_MISSING_LABEL,
} from '@/lib/vastgoedrekenen/wws/source';
import {
  suggestWwsMode,
  getEffectiveWwsMode,
  WWS_MODE_LABEL,
  type WwsMode,
} from '@/lib/vastgoedrekenen/wws/mode';
import type { Component, Scenario, SellOffUnit, WwsUnit } from '@/lib/vastgoedrekenen/types';
import { Chip, DrawerField } from './tableShared';

type Props = {
  scenario: Scenario;
  components: Component[];
  strategyUnits: SellOffUnit[];
  wwsUnits: WwsUnit[];
  euroPerPoint: number;
  selectedIds: Set<string>;
  toggleSelect: (id: string) => void;
  updateWwsUnit: (id: string, patch: Partial<WwsUnit>) => Promise<void> | void;
  deleteWwsUnit: (id: string) => Promise<void> | void;
  recomputeWwsUnit: (id: string) => unknown;
};

export default function WwsUnitsTable({ scenario, components, strategyUnits, wwsUnits, euroPerPoint, selectedIds, toggleSelect, updateWwsUnit, deleteWwsUnit, recomputeWwsUnit }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const openUnit = openId ? wwsUnits.find((u) => u.id === openId) ?? null : null;

  const totalM2 = wwsUnits.reduce((s, u) => s + Number(u.living_area_m2 ?? 0), 0);
  const totalRent = wwsUnits.reduce((s, u) => s + Number(u.current_monthly_rent ?? 0), 0);
  const warnings = wwsUnits.filter((u) => getWwsUnitStatus(u, { euroPerPoint }).reliability !== 'volledig').length;

  if (wwsUnits.length === 0) return null;

  const modeCtx = { scenario, components, strategyUnits, wwsUnits };

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <Table className="text-xs w-full min-w-[820px] xl:min-w-0 [&_th]:px-2 [&_td]:px-2">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead className="w-8">#</TableHead>
              <TableHead className="min-w-[140px] sticky left-0 bg-card z-10">Unit</TableHead>
              <TableHead className="text-right">Woon m²</TableHead>
              <TableHead className="text-right hidden md:table-cell">WOZ</TableHead>
              <TableHead className="hidden lg:table-cell">Label</TableHead>
              <TableHead className="text-right">Maandhuur</TableHead>
              <TableHead className="text-right">Punten</TableHead>
              <TableHead className="hidden md:table-cell">Segment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-20" />
            </TableRow>
          </TableHeader>

          <TableBody>
            {wwsUnits.map((u, idx) => {
              const status = getWwsUnitStatus(u, { euroPerPoint });
              const ident = formatUnitIdentity({ name: u.unit_name, type: 'woonunit', surface: u.living_area_m2 }, idx);
              const isSelected = selectedIds.has(u.id);
              const m2 = Number(u.living_area_m2 ?? 0);
              const woz = Number(u.woz_value ?? 0);
              const monthly = Number(u.current_monthly_rent ?? 0);
              const reliabilityTone: 'positive' | 'warning' =
                status.reliability === 'volledig' ? 'positive' : 'warning';
              return (
                <TableRow
                  key={u.id}
                  id={`wws-unit-${u.id}`}
                  className="cursor-pointer hover:bg-muted/40 scroll-mt-24"
                  onClick={() => setOpenId(u.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox checked={isSelected} onCheckedChange={() => toggleSelect(u.id)} aria-label="Selecteer unit" />
                  </TableCell>
                  <TableCell className="font-mono-data text-muted-foreground tabular-nums">{ident.indexStr}</TableCell>
                  <TableCell className="font-medium break-words min-w-[140px] sticky left-0 bg-card">{ident.primary}</TableCell>
                  <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{m2 > 0 ? fmtM2(m2, 0) : '—'}</TableCell>
                  <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap hidden md:table-cell">{woz > 0 ? fmtEur(woz) : '—'}</TableCell>
                  <TableCell className="font-mono-data hidden lg:table-cell">{u.energy_label ?? '—'}</TableCell>
                  <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{monthly > 0 ? fmtEur(monthly) : '—'}</TableCell>
                  <TableCell className="text-right font-mono-data tabular-nums">{u.wws_points ?? '—'}</TableCell>
                  <TableCell className="break-words hidden md:table-cell">{u.rent_segment ?? '—'}</TableCell>
                  <TableCell>
                    <Chip
                      label={
                        status.reliability === 'volledig' ? 'OK'
                        : status.reliability === 'indicatief' ? 'LET OP'
                        : 'INCOMPLEET'
                      }
                      tone={reliabilityTone}
                    />
                  </TableCell>

                  <TableCell className="text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                    <Button size="sm" variant="ghost" onClick={() => recomputeWwsUnit(u.id)} className="h-7 w-7 p-0 text-muted-foreground" aria-label="Herbereken">
                      <RotateCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteWwsUnit(u.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" aria-label="Verwijderen">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="bg-muted/60 font-semibold border-t-2">
              <TableCell />
              <TableCell />
              <TableCell className="break-words whitespace-normal sticky left-0 bg-muted/60">
                Totaal {wwsUnits.length} woonunits{warnings > 0 ? ` · ${warnings} aandacht` : ''}
              </TableCell>
              <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtM2(totalM2, 0)}</TableCell>
              <TableCell className="hidden md:table-cell" />
              <TableCell className="hidden lg:table-cell" />
              <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtEur(totalRent)}</TableCell>
              <TableCell />
              <TableCell className="hidden md:table-cell" />
              <TableCell />
              <TableCell />
            </TableRow>


          </TableBody>
        </Table>
      </div>

      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openUnit && (() => {
            const u = openUnit;
            const idx = wwsUnits.findIndex((x) => x.id === u.id);
            const status = getWwsUnitStatus(u, { euroPerPoint });
            const ident = formatUnitIdentity({ name: u.unit_name, type: 'woonunit', surface: u.living_area_m2 }, idx);
            const independentVal = (u as unknown as { independent_unit?: boolean | null }).independent_unit;
            const unitModeRaw = (u as unknown as { wws_mode?: WwsMode | null }).wws_mode ?? null;
            const unitModeEff = getEffectiveWwsMode(u, modeCtx);
            const reliabilityColor =
              status.reliability === 'volledig' ? 'text-emerald-700 dark:text-emerald-300'
              : status.reliability === 'indicatief' ? 'text-amber-700 dark:text-amber-300'
              : 'text-destructive';
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="break-words">{ident.indexStr} — {ident.primary}</SheetTitle>
                  <SheetDescription className="break-words">{ident.meta.join(' · ') || 'Woonunit'}</SheetDescription>
                </SheetHeader>
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <DrawerField label="Naam"><RawTextInput className="h-9" initialValue={u.unit_name} onCommit={(raw) => updateWwsUnit(u.id, { unit_name: raw.trim() || 'Woonunit' })} /></DrawerField>
                    <DrawerField label="Woon m²"><RawNumberInput className="h-9" format="area" initialValue={numberToRaw(u.living_area_m2)} onCommit={(raw) => updateWwsUnit(u.id, { living_area_m2: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="WOZ (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(u.woz_value)} onCommit={(raw) => updateWwsUnit(u.id, { woz_value: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="Energielabel"><RawTextInput className="h-9" initialValue={u.energy_label ?? ''} onCommit={(raw) => updateWwsUnit(u.id, { energy_label: raw.trim() || null })} /></DrawerField>
                    <DrawerField label="Maandhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(u.current_monthly_rent)} onCommit={(raw) => updateWwsUnit(u.id, { current_monthly_rent: parseRawNumber(raw) })} /></DrawerField>
                    <DrawerField label="Stelsel">
                      <Select
                        value={independentVal == null ? '' : independentVal ? 'zelfstandig' : 'onzelfstandig'}
                        onValueChange={(v) => updateWwsUnit(u.id, { independent_unit: v === 'zelfstandig' } as Partial<WwsUnit>)}
                      >
                        <SelectTrigger className="h-9 w-full"><SelectValue placeholder="Kies stelsel" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zelfstandig">Zelfstandig</SelectItem>
                          <SelectItem value="onzelfstandig">Onzelfstandig (kamer)</SelectItem>
                        </SelectContent>
                      </Select>
                    </DrawerField>
                  </div>

                  <div className="rounded-md border bg-muted/30 px-3 py-2 text-xs space-y-1.5 break-words leading-snug">
                    <div className="font-medium text-sm text-foreground">Punten / segment</div>
                    <div className="font-mono-data">{u.wws_points ?? '—'} punten · {u.rent_segment ?? '—'}</div>
                    {status.source === 'handmatig' && status.computedPoints != null && (
                      <div className="text-[11px] text-amber-700 dark:text-amber-300">Handmatig — CRM zou {status.computedPoints} berekenen.</div>
                    )}
                  </div>

                  <div className="rounded-md bg-muted/30 border border-muted px-3 py-2 text-xs text-muted-foreground space-y-1 break-words leading-snug">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span><span className="font-medium text-foreground">Bron punten:</span> {WWS_SOURCE_LABEL[status.source]}</span>
                      <span><span className="font-medium text-foreground">Stelsel:</span> {WWS_SCHEME_LABEL[status.scheme]}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <span><span className="font-medium text-foreground">Beleidsversie:</span> {status.policyVersion}</span>
                      <span className={reliabilityColor}><span className="font-medium">Betrouwbaarheid:</span> {WWS_RELIABILITY_LABEL[status.reliability]}</span>
                    </div>
                    {status.missing.length > 0 && (
                      <div className="text-amber-700 dark:text-amber-300">
                        <span className="font-medium">Ontbrekend:</span> {status.missing.map((m) => WWS_MISSING_LABEL[m]).join(', ')}
                        {status.source === 'ontbreekt' && ' — vul WWS-punten in of voer een volledige Huurcommissie-check uit.'}
                      </div>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-muted/60">
                      <span className="font-medium text-foreground">WWS-modus:</span>
                      <Select
                        value={unitModeRaw ?? '__auto__'}
                        onValueChange={(v) => updateWwsUnit(u.id, { wws_mode: v === '__auto__' ? null : v } as unknown as Partial<WwsUnit>)}
                      >
                        <SelectTrigger className="h-7 w-auto min-w-[180px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__auto__">Auto — {WWS_MODE_LABEL[suggestWwsMode(modeCtx).mode]}</SelectItem>
                          <SelectItem value="niet_nodig">{WWS_MODE_LABEL.niet_nodig}</SelectItem>
                          <SelectItem value="indicatief">{WWS_MODE_LABEL.indicatief}</SelectItem>
                          <SelectItem value="volledig_vereist">{WWS_MODE_LABEL.volledig_vereist}</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-[11px] opacity-80">({unitModeEff.source})</span>
                      <span className="text-[11px] opacity-80 basis-full">{unitModeEff.reasons.join(' ')}</span>
                    </div>
                  </div>

                  <div className="border-t pt-3 flex flex-wrap justify-end gap-2">
                    <Button variant="outline" onClick={() => recomputeWwsUnit(u.id)}>
                      <RotateCw className="h-4 w-4 mr-1" /> Herbereken
                    </Button>
                    <Button variant="ghost" onClick={() => { void deleteWwsUnit(u.id); setOpenId(null); }} className="text-destructive">
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
