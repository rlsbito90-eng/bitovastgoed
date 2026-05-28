// Generieke bulk-fill dialog voor WWS- en Componentstrategie-units.
//
// Verantwoordelijkheden:
//   - laat de gebruiker één veld + één waarde kiezen;
//   - bepaalt de doelgroep (alle / geselecteerde / lege / per type);
//   - vraagt expliciete bevestiging vóór overschrijven van bestaande waarden;
//   - past de wijziging unit-per-unit toe via de aangeleverde apply()-callback.
//
// Géén rekenlogica — alleen UI + iteratie. De parent blijft eigenaar van de
// daadwerkelijke schrijflogica en typisering per veld.

import { useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { parseDutchNumber } from '@/lib/format/nl';

export type BulkUnit = {
  id: string;
  label: string;
  /** Optioneel type voor "doelgroep: woonunits / commerciële units / per type". */
  type?: string | null;
};

export type BulkField =
  | { key: string; label: string; kind: 'text' }
  | { key: string; label: string; kind: 'number'; suffix?: string }
  | { key: string; label: string; kind: 'select'; options: { value: string; label: string }[] };

export type BulkScopeKey =
  | 'all'
  | 'selected'
  | 'empty'
  | 'residential'
  | 'commercial';

const SCOPE_LABEL: Record<BulkScopeKey, string> = {
  all: 'Alle units',
  selected: 'Geselecteerde units',
  empty: 'Alleen units zonder waarde',
  residential: 'Alle woonunits',
  commercial: 'Alle commerciële units',
};

const RESIDENTIAL_TYPES = ['woning', 'appartement'];
const COMMERCIAL_TYPES = ['winkel', 'winkelruimte', 'kantoor', 'kantoorruimte', 'bedrijfsruimte', 'bedrijfsunit', 'horeca'];

type Props = {
  open: boolean;
  onOpenChange: (next: boolean) => void;
  title: string;
  fields: BulkField[];
  units: BulkUnit[];
  selectedIds: Set<string>;
  /** Beschikbare scopes voor deze dialog. */
  scopes?: BulkScopeKey[];
  /** Huidige waarde van een unit voor een veld (voor overschrijfdetectie). */
  getValue: (unitId: string, fieldKey: string) => unknown;
  /** Pas de waarde toe op één unit. */
  apply: (unitId: string, fieldKey: string, value: unknown) => Promise<void>;
};

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true;
  if (typeof v === 'string') return v.trim() === '';
  if (typeof v === 'number') return !Number.isFinite(v) || v === 0;
  return false;
}

export default function BulkFillDialog({
  open, onOpenChange, title, fields, units, selectedIds,
  scopes = ['all', 'selected', 'empty', 'residential', 'commercial'],
  getValue, apply,
}: Props) {
  const [fieldKey, setFieldKey] = useState<string>(fields[0]?.key ?? '');
  const [rawValue, setRawValue] = useState<string>('');
  const [scope, setScope] = useState<BulkScopeKey>('all');
  const [overwrite, setOverwrite] = useState(false);
  const [busy, setBusy] = useState(false);

  const field = useMemo(() => fields.find((f) => f.key === fieldKey) ?? fields[0], [fields, fieldKey]);

  // Bepaal doelunits op basis van scope.
  const targetUnits = useMemo(() => {
    switch (scope) {
      case 'selected':
        return units.filter((u) => selectedIds.has(u.id));
      case 'empty':
        return units.filter((u) => isEmpty(getValue(u.id, fieldKey)));
      case 'residential':
        return units.filter((u) => RESIDENTIAL_TYPES.includes(String(u.type ?? '').toLowerCase()));
      case 'commercial':
        return units.filter((u) => COMMERCIAL_TYPES.includes(String(u.type ?? '').toLowerCase()));
      case 'all':
      default:
        return units;
    }
  }, [scope, units, selectedIds, getValue, fieldKey]);

  const existingCount = useMemo(
    () => targetUnits.filter((u) => !isEmpty(getValue(u.id, fieldKey))).length,
    [targetUnits, getValue, fieldKey],
  );

  function parsedValue(): unknown {
    if (!field) return null;
    if (field.kind === 'number') {
      const n = parseDutchNumber(rawValue);
      return n;
    }
    if (field.kind === 'select') {
      return rawValue || null;
    }
    return rawValue.trim() === '' ? null : rawValue.trim();
  }

  async function handleApply() {
    if (!field || targetUnits.length === 0) {
      toast.error('Geen doelunits geselecteerd.');
      return;
    }
    if (existingCount > 0 && !overwrite) {
      toast.warning(`${existingCount} bestaande waarde(n) — vink "Overschrijf bestaande waarden" aan om door te gaan.`);
      return;
    }
    const value = parsedValue();
    setBusy(true);
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    for (const u of targetUnits) {
      const current = getValue(u.id, fieldKey);
      const hasExisting = !isEmpty(current);
      if (hasExisting && !overwrite) { skipped += 1; continue; }
      try {
        await apply(u.id, fieldKey, value);
        updated += 1;
      } catch {
        errors += 1;
      }
    }
    setBusy(false);
    const parts = [
      `${updated} bijgewerkt`,
      skipped > 0 ? `${skipped} overgeslagen` : null,
      errors > 0 ? `${errors} fout(en)` : null,
    ].filter(Boolean).join(' · ');
    if (updated > 0) toast.success(`${field.label}: ${parts}`);
    else toast.info(`${field.label}: ${parts}`);
    onOpenChange(false);
    // Reset state
    setRawValue('');
    setOverwrite(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Pas één veld in één keer toe op meerdere units. Bestaande waarden worden alleen overschreven als je dat hieronder bevestigt.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs">Veld</Label>
            <Select value={fieldKey} onValueChange={setFieldKey}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {fields.map((f) => <SelectItem key={f.key} value={f.key}>{f.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Waarde</Label>
            {field?.kind === 'select' ? (
              <Select value={rawValue} onValueChange={setRawValue}>
                <SelectTrigger className="h-9"><SelectValue placeholder="Kies waarde" /></SelectTrigger>
                <SelectContent>
                  {field.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            ) : (
              <Input
                className="h-9"
                value={rawValue}
                onChange={(e) => setRawValue(e.target.value)}
                placeholder={field?.kind === 'number' ? (field.suffix ?? 'bv. 100') : 'tekst'}
              />
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Doelgroep</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as BulkScopeKey)}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {scopes.map((s) => <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}{s === 'selected' ? ` (${selectedIds.size})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="text-[11px] text-muted-foreground">
              {targetUnits.length} unit(s) in doelgroep · {existingCount} hebben al een waarde.
            </p>
          </div>

          {existingCount > 0 && (
            <label className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2 text-xs">
              <Checkbox checked={overwrite} onCheckedChange={(v) => setOverwrite(!!v)} className="mt-0.5" />
              <span>
                <span className="font-medium text-amber-900 dark:text-amber-200">Overschrijf bestaande waarden</span>
                <span className="block text-muted-foreground">Je staat op het punt {existingCount} bestaande waarde(n) te vervangen.</span>
              </span>
            </label>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Annuleren</Button>
          <Button onClick={handleApply} disabled={busy || !field || targetUnits.length === 0}>
            Toepassen op {targetUnits.length} unit(s)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
