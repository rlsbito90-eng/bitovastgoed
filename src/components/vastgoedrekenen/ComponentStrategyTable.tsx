// Componentstrategie per scenario — UI.
// Per unit kan strategie + bijbehorende velden worden ingevuld.
import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Trash2, Plus, Sparkles, Download } from 'lucide-react';
import type { Component, SellOffUnit } from '@/lib/vastgoedrekenen/types';
import { RawNumberInput, RawTextInput, RawTextarea, numberToRaw, parseRawNumber } from './RawInputs';
import { fmtEur } from './format';
import {
  STRATEGY_LABELS, SALE_STRATEGIES, HOLD_STRATEGIES,
  aggregateStrategy,
  type ComponentStrategyKey,
} from '@/lib/vastgoedrekenen/componentStrategy';

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

export default function ComponentStrategyTable({ units, components, asking, onCreate, onUpdate, onDelete, onImport }: Props) {
  const totals = useMemo(() => aggregateStrategy(units), [units]);
  const hasUnits = units.length > 0;
  const askingPrice = Number(asking ?? 0);

  return (
    <div className="space-y-3 pt-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-xs text-muted-foreground max-w-xl">
          Kies per component wat ermee gebeurt: verkopen, aanhouden, renoveren, splitsen, transformeren of later beslissen. De scenariowaarde wordt opgebouwd uit deze mix.
        </p>
        <div className="flex flex-wrap gap-2">
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
        <p className="text-xs text-muted-foreground">Mix: {totals.mix}</p>
      )}

      {!hasUnits && (
        <p className="text-xs text-muted-foreground">Nog geen componentstrategie. Voeg units toe of importeer ze uit de scenario-componenten.</p>
      )}

      <div className="space-y-3">
        {units.map((u) => (
          <UnitRow key={u.id} unit={u} onUpdate={onUpdate} onDelete={onDelete} />
        ))}
      </div>

      {hasUnits && totals.warnings.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200 space-y-1">
          {totals.warnings.slice(0, 8).map((w, i) => <p key={i}>⚠ {w}</p>)}
        </div>
      )}
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

function UnitRow({ unit, onUpdate, onDelete }: { unit: SellOffUnit; onUpdate: Props['onUpdate']; onDelete: Props['onDelete'] }) {
  const r = f(unit);
  const strategy = (r.strategy as ComponentStrategyKey | null) ?? 'later_beslissen';
  const isSale = SALE_STRATEGIES.includes(strategy);
  const isHold = HOLD_STRATEGIES.includes(strategy);
  const isManual = strategy === 'handmatige_waarde';
  const saleSrc = (r.sale_price_source as string | null) ?? 'totaal';
  const valMethod = (r.hold_valuation_method as string | null) ?? 'BAR';

  return (
    <div className="border rounded-md p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium text-muted-foreground">Component</p>
        <Button size="sm" variant="ghost" onClick={() => onDelete(unit.id)} className="h-8 px-2 text-muted-foreground hover:text-destructive">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

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
            <Field label="Verkoopprijs (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.sale_price_total)} onCommit={(raw) => onUpdate(unit.id, { sale_price_total: parseRawNumber(raw) })} /></Field>
          ) : (
            <Field label="Verkoopprijs per m² (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.sale_price_per_m2)} onCommit={(raw) => onUpdate(unit.id, { sale_price_per_m2: parseRawNumber(raw) })} /></Field>
          )}
          <Field label="Verkoopkosten (%)"><RawNumberInput className="h-9" format="percent" initialValue={numberToRaw(r.sale_costs_pct)} onCommit={(raw) => onUpdate(unit.id, { sale_costs_pct: parseRawNumber(raw) })} /></Field>
          <Field label="Verkoopkosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.sale_costs_amount)} onCommit={(raw) => onUpdate(unit.id, { sale_costs_amount: parseRawNumber(raw) })} /></Field>
          <Field label="Juridische kosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.legal_costs)} onCommit={(raw) => onUpdate(unit.id, { legal_costs: parseRawNumber(raw) })} /></Field>
          {(strategy === 'renoveren_verkopen' || strategy === 'splitsen_verkopen' || strategy === 'transformeren_verkopen') && (
            <Field label="Renovatiekosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.renovation_costs)} onCommit={(raw) => onUpdate(unit.id, { renovation_costs: parseRawNumber(raw) })} /></Field>
          )}
          {strategy === 'splitsen_verkopen' && (
            <Field label="Splitsingskosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.splitting_costs)} onCommit={(raw) => onUpdate(unit.id, { splitting_costs: parseRawNumber(raw) })} /></Field>
          )}
          {strategy === 'transformeren_verkopen' && (
            <Field label="Transformatiekosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.transformation_costs)} onCommit={(raw) => onUpdate(unit.id, { transformation_costs: parseRawNumber(raw) })} /></Field>
          )}
        </div>
      )}

      {isHold && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 border-t pt-3">
          <Field label="Maandhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.hold_monthly_rent)} onCommit={(raw) => {
            const n = parseRawNumber(raw);
            onUpdate(unit.id, { hold_monthly_rent: n, hold_annual_rent: n != null ? Math.round(n * 12) : null });
          }} /></Field>
          <Field label="Jaarhuur (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.hold_annual_rent)} onCommit={(raw) => onUpdate(unit.id, { hold_annual_rent: parseRawNumber(raw) })} /></Field>
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
          {valMethod === 'BAR' && <Field label="BAR (%)"><RawNumberInput className="h-9" format="percent" initialValue={numberToRaw(r.hold_bar)} onCommit={(raw) => onUpdate(unit.id, { hold_bar: parseRawNumber(raw) })} /></Field>}
          {valMethod === 'NAR' && <Field label="NAR (%)"><RawNumberInput className="h-9" format="percent" initialValue={numberToRaw(r.hold_nar)} onCommit={(raw) => onUpdate(unit.id, { hold_nar: parseRawNumber(raw) })} /></Field>}
          {valMethod === 'factor' && <Field label="Factor (×)"><RawNumberInput className="h-9" format="factor" initialValue={numberToRaw(r.hold_factor)} onCommit={(raw) => onUpdate(unit.id, { hold_factor: parseRawNumber(raw) })} /></Field>}
          {valMethod === 'handmatige_waarde' && <Field label="Handmatige waarde (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.hold_value_manual)} onCommit={(raw) => onUpdate(unit.id, { hold_value_manual: parseRawNumber(raw) })} /></Field>}
          {(strategy === 'renoveren_aanhouden') && <Field label="Renovatiekosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.renovation_costs)} onCommit={(raw) => onUpdate(unit.id, { renovation_costs: parseRawNumber(raw) })} /></Field>}
          {(strategy === 'transformeren_aanhouden') && <Field label="Transformatiekosten (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.transformation_costs)} onCommit={(raw) => onUpdate(unit.id, { transformation_costs: parseRawNumber(raw) })} /></Field>}
        </div>
      )}

      {isManual && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t pt-3">
          <Field label="Handmatige waarde (€)"><RawNumberInput className="h-9" format="currency" initialValue={numberToRaw(r.hold_value_manual)} onCommit={(raw) => onUpdate(unit.id, { hold_value_manual: parseRawNumber(raw) })} /></Field>
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
