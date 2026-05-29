// Componentstrategie per scenario — compacte tabel + detail-drawer (sub-fase 4C).
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Trash2, Plus, Sparkles, Download, ListChecks } from 'lucide-react';
import type { Component, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { RawNumberInput, RawTextInput, RawTextarea, numberToRaw, parseRawNumber } from './RawInputs';
import { fmtEur, fmtM2 } from './format';
import {
  STRATEGY_LABELS, SALE_STRATEGIES, HOLD_STRATEGIES,
  aggregateStrategy, computeComponentStrategy,
  type ComponentStrategyKey,
} from '@/lib/vastgoedrekenen/componentStrategy';
import BulkFillDialog, { type BulkField } from './BulkFillDialog';
import { formatUnitIdentity } from '@/lib/vastgoedrekenen/unitIdentity';
import { Chip } from './cockpit/tableShared';


type Props = {
  units: SellOffUnit[];
  components: Component[];
  asking: number | null | undefined;
  onCreate: (patch?: Record<string, unknown>) => Promise<unknown>;
  onUpdate: (id: string, patch: Record<string, unknown>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onImport: (mode?: 'default' | 'hybrid') => Promise<void>;
};

function f(u: SellOffUnit): Record<string, unknown> {
  return u as unknown as Record<string, unknown>;
}
function num(v: unknown): number | null | undefined {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function ComponentStrategyTable({ units, components, asking, onCreate, onUpdate, onDelete, onImport }: Props) {
  const totals = useMemo(() => aggregateStrategy(units), [units]);
  const hasUnits = units.length > 0;
  const askingPrice = Number(asking ?? 0);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const openUnit = openId ? units.find((u) => u.id === openId) ?? null : null;
  const openIdx = openUnit ? units.findIndex((u) => u.id === openUnit.id) : -1;

  const totalM2 = units.reduce((s, u) => {
    const r = u as unknown as Record<string, unknown>;
    return s + (num(r.surface_gbo) ?? num(r.surface_vvo) ?? 0);
  }, 0);
  const stratCounts = units.reduce<Record<string, number>>((acc, u) => {
    const k = ((u as unknown as Record<string, unknown>).strategy as string | null) ?? 'later_beslissen';
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const warningsCount = units.filter((u) => computeComponentStrategy(u).warnings.length > 0).length;

  const bulkFields: BulkField[] = [
    { key: 'strategy', label: 'Strategie', kind: 'select', options: Object.entries(STRATEGY_LABELS).map(([v, l]) => ({ value: v, label: l })) },
    { key: 'sale_costs_pct', label: 'Verkoopkosten (%)', kind: 'number', suffix: '%' },
    { key: 'sale_price_per_m2', label: 'Verkoopprijs per m² (€)', kind: 'number', suffix: '€' },
    { key: 'hold_bar', label: 'BAR (%)', kind: 'number', suffix: '%' },
    { key: 'hold_factor', label: 'Factor (×)', kind: 'number' },
    { key: 'hold_valuation_method', label: 'Waarderingsmethode', kind: 'select', options: [
      { value: 'BAR', label: 'BAR' }, { value: 'NAR', label: 'NAR' }, { value: 'factor', label: 'Factor' }, { value: 'handmatige_waarde', label: 'Handmatige waarde' },
    ] },
  ];

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-xl">
          Kies per component wat ermee gebeurt: verkopen, aanhouden, renoveren, splitsen, transformeren of later beslissen. De scenariowaarde wordt opgebouwd uit deze mix.
        </p>
        <div className="flex flex-wrap gap-2">
          {hasUnits && (
            <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)}>
              <ListChecks className="h-3.5 w-3.5 mr-1" /> Bulk invullen
            </Button>
          )}
          {components.length > 0 && (
            <>
              <Button size="sm" variant="outline" onClick={() => onImport('default')}>
                <Download className="h-3.5 w-3.5 mr-1" /> Importeer uit componenten
              </Button>
              <Button size="sm" variant="outline" onClick={() => onImport('hybrid')}>
                <Sparkles className="h-3.5 w-3.5 mr-1" /> Hybride: woningen verkopen, commercieel houden
              </Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => onCreate()}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Unit toevoegen
          </Button>
        </div>
      </div>

      {hasUnits && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <Tile label="Behoudwaarde" value={fmtEur(totals.holdValue)} />
          <Tile label="Netto verkoopopbrengst" value={fmtEur(totals.netSaleProceeds)} />
          <Tile label="Totale scenariowaarde" value={fmtEur(totals.scenarioValue)} accent />
          <Tile
            label="Verschil met vraagprijs"
            value={askingPrice > 0 ? `${totals.scenarioValue >= askingPrice ? '+' : '−'} ${fmtEur(Math.abs(totals.scenarioValue - askingPrice))}` : '—'}
            tone={askingPrice > 0 ? (totals.scenarioValue >= askingPrice ? 'positive' : 'negative') : undefined}
          />
        </div>
      )}
      {hasUnits && totals.mix && (
        <p className="text-xs text-muted-foreground break-words">Mix: {totals.mix}</p>
      )}

      {!hasUnits && (
        <p className="text-xs text-muted-foreground">Nog geen componentstrategie. Voeg units toe of importeer ze uit de scenario-componenten.</p>
      )}

      {hasUnits && (
        <div className="rounded-md border overflow-x-auto">
          <Table className="text-xs w-full min-w-[760px] xl:min-w-0 [&_th]:px-2 [&_td]:px-2">
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">#</TableHead>
                <TableHead className="min-w-[140px] sticky left-0 bg-card z-10">Unit</TableHead>
                <TableHead className="hidden md:table-cell">Type</TableHead>
                <TableHead className="text-right">m²</TableHead>
                <TableHead>Strategie</TableHead>
                <TableHead className="text-right">Bijdrage</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-8" />
              </TableRow>
            </TableHeader>

            <TableBody>
              {units.map((u, idx) => {
                const r = u as unknown as Record<string, unknown>;
                const ident = formatUnitIdentity({
                  label: r.unit_label as string | null,
                  name: (u as unknown as { unit_name?: string }).unit_name,
                  type: r.unit_type as string | null,
                  surface: num(r.surface_gbo) ?? num(r.surface_vvo),
                }, idx);
                const strategy = (r.strategy as ComponentStrategyKey | null) ?? 'later_beslissen';
                const calc = computeComponentStrategy(u);
                const m2 = num(r.surface_gbo) ?? num(r.surface_vvo) ?? 0;
                const isSale = SALE_STRATEGIES.includes(strategy);
                const isHold = HOLD_STRATEGIES.includes(strategy);
                const contribution = isSale ? calc.breakdown.netSaleProceeds : isHold ? calc.breakdown.holdValue : (num(r.hold_value_manual) ?? 0);
                const hasWarning = calc.warnings.length > 0 || !r.strategy || strategy === 'later_beslissen';
                return (
                  <TableRow
                    key={u.id}
                    id={`strategy-unit-${u.id}`}
                    className="cursor-pointer hover:bg-muted/40 scroll-mt-24"
                    onClick={() => setOpenId(u.id)}
                  >
                    <TableCell className="font-mono-data text-muted-foreground tabular-nums">{ident.indexStr}</TableCell>
                    <TableCell className="font-medium break-words min-w-[140px] sticky left-0 bg-card">{ident.primary}</TableCell>
                    <TableCell className="break-words hidden md:table-cell">{(r.unit_type as string | null) ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{m2 > 0 ? fmtM2(m2, 0) : '—'}</TableCell>
                    <TableCell className="break-words">{STRATEGY_LABELS[strategy] ?? '—'}</TableCell>
                    <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{contribution > 0 ? fmtEur(contribution) : '—'}</TableCell>
                    <TableCell>
                      {hasWarning
                        ? <Chip label={strategy === 'later_beslissen' ? 'INCOMPLEET' : 'LET OP'} tone="warning" />
                        : <Chip label="OK" tone="positive" />}
                    </TableCell>

                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button size="sm" variant="ghost" onClick={() => onDelete(u.id)} className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive" aria-label="Verwijderen">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="bg-muted/60 font-semibold border-t-2">
                <TableCell />
                <TableCell className="break-words whitespace-normal sticky left-0 bg-muted/60">
                  Totaal {units.length} units{warningsCount > 0 ? ` · ${warningsCount} aandacht` : ''}
                </TableCell>
                <TableCell className="hidden md:table-cell" />
                <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtM2(totalM2, 0)}</TableCell>
                <TableCell />
                <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtEur(totals.scenarioValue)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>


            </TableBody>
          </Table>
        </div>
      )}

      <Sheet open={openId !== null} onOpenChange={(o) => !o && setOpenId(null)}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {openUnit && (() => {
            const r = openUnit as unknown as Record<string, unknown>;
            const ident = formatUnitIdentity({
              label: r.unit_label as string | null,
              name: (openUnit as unknown as { unit_name?: string }).unit_name,
              type: r.unit_type as string | null,
              surface: num(r.surface_gbo) ?? num(r.surface_vvo),
            }, openIdx);
            return (
              <>
                <SheetHeader>
                  <SheetTitle className="break-words">{ident.indexStr} — {ident.primary}</SheetTitle>
                  <SheetDescription className="break-words">{ident.meta.join(' · ') || 'Strategie-unit'}</SheetDescription>
                </SheetHeader>
                <div className="mt-4">
                  <UnitRow unit={openUnit} index={openIdx} onUpdate={onUpdate} onDelete={async (id) => { await onDelete(id); setOpenId(null); }} hideHeader />
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {hasUnits && totals.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1 break-words leading-snug">
          {totals.warnings.slice(0, 8).map((w, i) => <p key={i}>⚠ {w}</p>)}
        </div>
      )}


      <BulkFillDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        title="Bulk invullen — Componentstrategie"
        fields={bulkFields}
        units={units.map((u) => {
          const r = u as unknown as Record<string, unknown>;
          return {
            id: u.id,
            label: (r.unit_label as string | null) ?? (u as unknown as { unit_name?: string }).unit_name ?? 'Unit',
            type: (r.unit_type as string | null) ?? null,
          };
        })}
        selectedIds={new Set()}
        scopes={['all', 'empty', 'residential', 'commercial']}
        getValue={(unitId, key) => {
          const u = units.find((x) => x.id === unitId);
          if (!u) return null;
          return (u as unknown as Record<string, unknown>)[key];
        }}
        apply={(unitId, key, value) => onUpdate(unitId, { [key]: value as never })}
      />
    </div>
  );
}

function Tile({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: 'positive' | 'negative' }) {
  const cls = tone === 'positive'
    ? 'border-emerald-500/40 bg-emerald-500/5 text-emerald-700 dark:text-emerald-300'
    : tone === 'negative'
      ? 'border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-300'
      : accent
        ? 'border-primary/40 text-primary'
        : '';
  return (
    <div className={`rounded-md border bg-card p-2 ${cls}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold font-mono-data leading-snug">{value}</p>
    </div>
  );
}

function UnitRow({ unit, index, onUpdate, onDelete, hideHeader }: { unit: SellOffUnit; index: number; onUpdate: Props['onUpdate']; onDelete: Props['onDelete']; hideHeader?: boolean }) {
  const r = f(unit);
  const strategy = (r.strategy as ComponentStrategyKey | null) ?? 'later_beslissen';
  const isSale = SALE_STRATEGIES.includes(strategy);
  const isHold = HOLD_STRATEGIES.includes(strategy);
  const isManual = strategy === 'handmatige_waarde';
  const saleSrc = (r.sale_price_source as string | null) ?? 'totaal';
  const valMethod = (r.hold_valuation_method as string | null) ?? 'BAR';
  const ident = formatUnitIdentity({
    label: r.unit_label as string | null,
    name: (unit as unknown as { unit_name?: string }).unit_name,
    type: r.unit_type as string | null,
    surface: num(r.surface_gbo) ?? num(r.surface_vvo),
  }, index);
  const calc = computeComponentStrategy(unit);

  const stratTone: 'positive' | 'warning' | undefined = !r.strategy || strategy === 'later_beslissen' ? 'warning' : 'positive';
  const chips: { label: string; tone?: 'warning' | 'positive' | 'muted' }[] = [];
  chips.push({ label: STRATEGY_LABELS[strategy] ?? '—', tone: stratTone });
  if (isSale) {
    const gross = calc.breakdown.grossSaleValue;
    if (gross > 0) chips.push({ label: `bruto ${fmtEur(gross)}` });
    else chips.push({ label: 'verkoopwaarde ontbreekt', tone: 'warning' });
    if (calc.breakdown.netSaleProceeds > 0) chips.push({ label: `netto ${fmtEur(calc.breakdown.netSaleProceeds)}`, tone: 'positive' });
  }
  if (isHold) {
    const monthly = num(r.hold_monthly_rent);
    const annual = num(r.hold_annual_rent) ?? (monthly != null ? monthly * 12 : null);
    if (annual && annual > 0) chips.push({ label: `huur ${fmtEur(annual)}/jr` });
    else chips.push({ label: 'huur ontbreekt', tone: 'warning' });
    if (valMethod === 'BAR' && num(r.hold_bar)) chips.push({ label: `BAR ${num(r.hold_bar)}%` });
    if (valMethod === 'NAR' && num(r.hold_nar)) chips.push({ label: `NAR ${num(r.hold_nar)}%` });
    if (valMethod === 'factor' && num(r.hold_factor)) chips.push({ label: `×${num(r.hold_factor)}` });
    if (calc.breakdown.holdValue > 0) chips.push({ label: `waarde ${fmtEur(calc.breakdown.holdValue)}`, tone: 'positive' });
  }
  if (isManual) {
    const m = num(r.hold_value_manual);
    chips.push({ label: m && m > 0 ? `handm. ${fmtEur(m)}` : 'handmatige waarde ontbreekt', tone: m && m > 0 ? 'positive' : 'warning' });
  }

  const wrapperCls = hideHeader ? 'space-y-3' : 'border rounded-md p-3 sm:p-4 space-y-3 scroll-mt-20';
  return (
    <div id={hideHeader ? undefined : `strategy-unit-${unit.id}`} className={wrapperCls}>
      {!hideHeader && (
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 min-w-0">
            <span className="text-xs font-mono-data text-muted-foreground tabular-nums">{ident.indexStr}</span>
            <span className="text-sm font-semibold break-words">{ident.primary}</span>
            {ident.meta.length > 0 && <span className="text-xs text-muted-foreground break-words">· {ident.meta.join(' · ')}</span>}
            {chips.map((c, i) => <Chip key={i} label={c.label} tone={c.tone} />)}
          </div>
          <Button size="sm" variant="ghost" onClick={() => onDelete(unit.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      )}
      {hideHeader && chips.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {chips.map((c, i) => <Chip key={i} label={c.label} tone={c.tone} />)}
        </div>
      )}


      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
        <Field label="Label" className="lg:col-span-2">
          <RawTextInput className="h-9" initialValue={(r.unit_label as string | null) ?? ''} onCommit={(raw) => onUpdate(unit.id, { unit_label: raw.trim() || 'Unit' })} />
        </Field>
        <Field label="Type">
          <RawTextInput className="h-9" initialValue={(r.unit_type as string | null) ?? ''} onCommit={(raw) => onUpdate(unit.id, { unit_type: raw.trim() || null })} />
        </Field>
        <Field label="m² (GBO/VVO)">
          <RawNumberInput className="h-9" format="area" initialValue={numberToRaw((r.surface_gbo as number | null) ?? (r.surface_vvo as number | null))} onCommit={(raw) => onUpdate(unit.id, { surface_gbo: parseRawNumber(raw) })} />
        </Field>
        <Field label="Strategie" className="lg:col-span-2">
          <Select value={strategy} onValueChange={(v) => onUpdate(unit.id, { strategy: v })}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>

      {isSale && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t pt-3">
          <Field label="Verkoopprijs bron">
            <Select value={saleSrc} onValueChange={(v) => onUpdate(unit.id, { sale_price_source: v })}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="totaal">Totaalbedrag</SelectItem>
                <SelectItem value="per_m2">Per m²</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {saleSrc === 'totaal' ? (
            <Field label="Verkoopprijs (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.sale_price_total))} onCommit={(raw) => onUpdate(unit.id, { sale_price_total: parseRawNumber(raw) })} /></Field>
          ) : (
            <Field label="Verkoopprijs per m² (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.sale_price_per_m2))} onCommit={(raw) => onUpdate(unit.id, { sale_price_per_m2: parseRawNumber(raw) })} /></Field>
          )}
          <Field label="Verkoopkosten (%)"><RawNumberInput className="h-9" format="percent" initialValue={numberToRaw(num(r.sale_costs_pct))} onCommit={(raw) => onUpdate(unit.id, { sale_costs_pct: parseRawNumber(raw) })} /></Field>
          <Field label="Verkoopkosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.sale_costs_amount))} onCommit={(raw) => onUpdate(unit.id, { sale_costs_amount: parseRawNumber(raw) })} /></Field>
          <Field label="Juridische kosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.legal_costs))} onCommit={(raw) => onUpdate(unit.id, { legal_costs: parseRawNumber(raw) })} /></Field>
          {(strategy === 'renoveren_verkopen' || strategy === 'splitsen_verkopen' || strategy === 'transformeren_verkopen') && (
            <Field label="Renovatiekosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.renovation_costs))} onCommit={(raw) => onUpdate(unit.id, { renovation_costs: parseRawNumber(raw) })} /></Field>
          )}
          {strategy === 'splitsen_verkopen' && (
            <Field label="Splitsingskosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.splitting_costs))} onCommit={(raw) => onUpdate(unit.id, { splitting_costs: parseRawNumber(raw) })} /></Field>
          )}
          {strategy === 'transformeren_verkopen' && (
            <Field label="Transformatiekosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.transformation_costs))} onCommit={(raw) => onUpdate(unit.id, { transformation_costs: parseRawNumber(raw) })} /></Field>
          )}
        </div>
      )}

      {isHold && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t pt-3">
          <Field label="Maandhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.hold_monthly_rent))} onCommit={(raw) => {
            const n = parseRawNumber(raw);
            onUpdate(unit.id, { hold_monthly_rent: n, hold_annual_rent: n != null ? Math.round(n * 12) : null });
          }} /></Field>
          <Field label="Jaarhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.hold_annual_rent))} onCommit={(raw) => onUpdate(unit.id, { hold_annual_rent: parseRawNumber(raw) })} /></Field>
          <Field label="Waarderingsmethode">
            <Select value={valMethod} onValueChange={(v) => onUpdate(unit.id, { hold_valuation_method: v })}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="BAR">BAR</SelectItem>
                <SelectItem value="NAR">NAR</SelectItem>
                <SelectItem value="factor">Factor</SelectItem>
                <SelectItem value="handmatige_waarde">Handmatige waarde</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          {valMethod === 'BAR' && <Field label="BAR (%)"><RawNumberInput className="h-9" format="percent" initialValue={numberToRaw(num(r.hold_bar))} onCommit={(raw) => onUpdate(unit.id, { hold_bar: parseRawNumber(raw) })} /></Field>}
          {valMethod === 'NAR' && <Field label="NAR (%)"><RawNumberInput className="h-9" format="percent" initialValue={numberToRaw(num(r.hold_nar))} onCommit={(raw) => onUpdate(unit.id, { hold_nar: parseRawNumber(raw) })} /></Field>}
          {valMethod === 'factor' && <Field label="Factor (×)"><RawNumberInput className="h-9" format="factor" initialValue={numberToRaw(num(r.hold_factor))} onCommit={(raw) => onUpdate(unit.id, { hold_factor: parseRawNumber(raw) })} /></Field>}
          {valMethod === 'handmatige_waarde' && <Field label="Handmatige waarde (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.hold_value_manual))} onCommit={(raw) => onUpdate(unit.id, { hold_value_manual: parseRawNumber(raw) })} /></Field>}
          {(strategy === 'renoveren_aanhouden') && <Field label="Renovatiekosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.renovation_costs))} onCommit={(raw) => onUpdate(unit.id, { renovation_costs: parseRawNumber(raw) })} /></Field>}
          {(strategy === 'transformeren_aanhouden') && <Field label="Transformatiekosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.transformation_costs))} onCommit={(raw) => onUpdate(unit.id, { transformation_costs: parseRawNumber(raw) })} /></Field>}
        </div>
      )}

      {isManual && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
          <Field label="Handmatige waarde (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(num(r.hold_value_manual))} onCommit={(raw) => onUpdate(unit.id, { hold_value_manual: parseRawNumber(raw) })} /></Field>
        </div>
      )}

      <div className="border-t pt-3">
        <Field label="Toelichting / onderbouwing">
          <RawTextarea rows={2} initialValue={(r.notes as string | null) ?? ''} onCommit={(raw) => onUpdate(unit.id, { notes: raw.trim() || null })} />
        </Field>
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`min-w-0 space-y-1.5 ${className ?? ''}`}>
      <Label className="block text-xs font-medium leading-snug">{label}</Label>
      <div className="min-w-0 [&_input]:w-full [&_[role=combobox]]:w-full">{children}</div>
    </div>
  );
}
