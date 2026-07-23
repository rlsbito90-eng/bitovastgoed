from pathlib import Path

path = Path('src/components/vastgoedrekenen/ComponentStrategyTable.tsx')
text = path.read_text(encoding='utf-8')

old_sheet = '        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">'
new_sheet = '        <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">'
if old_sheet not in text:
    raise RuntimeError('Drawer-breedte niet gevonden')
text = text.replace(old_sheet, new_sheet, 1)

old_grid = '''      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-3">
        <Field label="Label" className="lg:col-span-2">
          <RawTextInput className="h-9" initialValue={(r.unit_label as string | null) ?? ''} onCommit={(raw) => onUpdate(unit.id, { unit_label: raw.trim() || 'Unit' })} />
        </Field>
        <Field label="Type">
          <RawTextInput className="h-9" initialValue={(r.unit_type as string | null) ?? ''} onCommit={(raw) => onUpdate(unit.id, { unit_type: raw.trim() || null })} />
        </Field>
        <Field label="GBO — gebruiksoppervlakte (m²)">
          <RawNumberInput className="h-9" format="area" initialValue={numberToRaw(num(r.surface_gbo))} onCommit={(raw) => onUpdate(unit.id, { surface_gbo: parseRawNumber(raw) })} />
        </Field>
        <Field label="VVO — verhuurbare vloeroppervlakte (m²)">
          <RawNumberInput className="h-9" format="area" initialValue={numberToRaw(num(r.surface_vvo))} onCommit={(raw) => onUpdate(unit.id, { surface_vvo: parseRawNumber(raw) })} />
        </Field>
        <Field label="BVO — bruto vloeroppervlakte (m²)">
          <RawNumberInput className="h-9" format="area" initialValue={numberToRaw(num(r.surface_bvo))} onCommit={(raw) => onUpdate(unit.id, { surface_bvo: parseRawNumber(raw) })} />
        </Field>
        <Field label="Strategie" className="lg:col-span-2">
          <Select value={strategy} onValueChange={(v) => onUpdate(unit.id, { strategy: v })}>
            <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
        </Field>
      </div>'''

new_grid = '''      <div className="space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,2fr)] gap-3">
          <Field label="Label">
            <RawTextInput className="h-9" initialValue={(r.unit_label as string | null) ?? ''} onCommit={(raw) => onUpdate(unit.id, { unit_label: raw.trim() || 'Unit' })} />
          </Field>
          <Field label="Type">
            <RawTextInput className="h-9" initialValue={(r.unit_type as string | null) ?? ''} onCommit={(raw) => onUpdate(unit.id, { unit_type: raw.trim() || null })} />
          </Field>
          <Field label="Strategie">
            <Select value={strategy} onValueChange={(v) => onUpdate(unit.id, { strategy: v })}>
              <SelectTrigger className="h-9 w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(STRATEGY_LABELS).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Field label="GBO (m²)">
            <RawNumberInput className="h-9" format="area" initialValue={numberToRaw(num(r.surface_gbo))} onCommit={(raw) => onUpdate(unit.id, { surface_gbo: parseRawNumber(raw) })} />
          </Field>
          <Field label="VVO (m²)">
            <RawNumberInput className="h-9" format="area" initialValue={numberToRaw(num(r.surface_vvo))} onCommit={(raw) => onUpdate(unit.id, { surface_vvo: parseRawNumber(raw) })} />
          </Field>
          <Field label="BVO (m²)">
            <RawNumberInput className="h-9" format="area" initialValue={numberToRaw(num(r.surface_bvo))} onCommit={(raw) => onUpdate(unit.id, { surface_bvo: parseRawNumber(raw) })} />
          </Field>
        </div>
      </div>'''

if old_grid not in text:
    raise RuntimeError('Oude drawer-grid niet gevonden')
text = text.replace(old_grid, new_grid, 1)
path.write_text(text, encoding='utf-8')
