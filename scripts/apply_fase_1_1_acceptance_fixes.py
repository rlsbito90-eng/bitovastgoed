from pathlib import Path


def replace_one(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text(encoding="utf-8")
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}: {old[:120]!r}")
    file.write_text(text.replace(old, new), encoding="utf-8")


# 1. Het volledige centrale register hoort niet in iedere objectquickscan.
replace_one(
    "src/components/vastgoedrekenen/VastgoedrekenenTab.tsx",
    "import KengetallenRegisterPanel from './KengetallenRegisterPanel';\n",
    "",
)
replace_one(
    "src/components/vastgoedrekenen/VastgoedrekenenTab.tsx",
    "\n      <KengetallenRegisterPanel />\n",
    "",
)

# 2. Plaats centraal register op het algemene Vastgoedrekenen-overzicht.
replace_one(
    "src/pages/VastgoedrekenenPage.tsx",
    "import { Calculator } from 'lucide-react';\n",
    "import { Calculator } from 'lucide-react';\nimport KengetallenRegisterPanel from '@/components/vastgoedrekenen/KengetallenRegisterPanel';\n",
)
replace_one(
    "src/pages/VastgoedrekenenPage.tsx",
    '        subtitle="Alle quickscans en scenarioanalyses per object."\n      />\n',
    '        subtitle="Alle quickscans, scenarioanalyses en centraal beheer van traceerbare kengetallen."\n      />\n      <KengetallenRegisterPanel />\n',
)

# 3. Geef Vastgoedrekenen de volledige desktopbreedte en verberg de algemene Deal Cockpit op deze tab.
replace_one(
    "src/pages/ObjectDetailPage.tsx",
    '      <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px] gap-4 lg:gap-6 xl:gap-8 min-w-0 items-start">',
    "      <div className={`grid ${activeTab === 'vastgoedrekenen' ? 'grid-cols-1' : 'lg:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_380px]'} gap-4 lg:gap-6 xl:gap-8 min-w-0 items-start`}>",
)
replace_one(
    "src/pages/ObjectDetailPage.tsx",
    "        <aside className={`${activeTab === 'cockpit' ? '' : 'hidden lg:block'} lg:sticky lg:top-[88px] space-y-3 min-w-0`}>",
    "        <aside className={`${activeTab === 'vastgoedrekenen' ? 'hidden' : activeTab === 'cockpit' ? '' : 'hidden lg:block'} lg:sticky lg:top-[88px] space-y-3 min-w-0`}>",
)

# 4. Componentstrategie: GBO/VVO/BVO afzonderlijk en decimal-proof registreren en tonen.
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    """  const totalM2 = units.reduce((s, u) => {
    const r = u as unknown as Record<string, unknown>;
    return s + (num(r.surface_gbo) ?? num(r.surface_vvo) ?? 0);
  }, 0);
""",
    """  const surfaceTotals = units.reduce(
    (acc, u) => {
      const r = u as unknown as Record<string, unknown>;
      acc.gbo += num(r.surface_gbo) ?? 0;
      acc.vvo += num(r.surface_vvo) ?? 0;
      acc.bvo += num(r.surface_bvo) ?? 0;
      return acc;
    },
    { gbo: 0, vvo: 0, bvo: 0 },
  );
""",
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    "  const avgEurPerM2 = totals.scenarioValue > 0 && totalM2 > 0 ? Math.round(totals.scenarioValue / totalM2) : 0;\n",
    """  const pricingSurface = surfaceTotals.gbo > 0
    ? { label: 'GBO', value: surfaceTotals.gbo }
    : surfaceTotals.vvo > 0
      ? { label: 'VVO', value: surfaceTotals.vvo }
      : null;
  const avgEurPerM2 = totals.scenarioValue > 0 && pricingSurface
    ? Math.round(totals.scenarioValue / pricingSurface.value)
    : 0;
""",
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    '        <p className="text-xs text-muted-foreground break-words">Mix: {totals.mix} · Gem. prijs/m²: <span className="font-mono-data">{avgEurPerM2 > 0 ? fmtEurPerM2(avgEurPerM2) : \'—\'}</span></p>',
    '        <p className="text-xs text-muted-foreground break-words">Mix: {totals.mix} · Gem. prijs/m²{pricingSurface ? ` ${pricingSurface.label}` : \'\'}: <span className="font-mono-data">{avgEurPerM2 > 0 ? fmtEurPerM2(avgEurPerM2) : \'—\'}</span></p>',
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    '                <TableHead className="text-right">m²</TableHead>',
    '                <TableHead className="text-right">Oppervlaktes</TableHead>',
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    """                const m2 = num(r.surface_gbo) ?? num(r.surface_vvo) ?? 0;
                const isSale = SALE_STRATEGIES.includes(strategy);
""",
    """                const gbo = num(r.surface_gbo) ?? 0;
                const vvo = num(r.surface_vvo) ?? 0;
                const bvo = num(r.surface_bvo) ?? 0;
                const pricingM2 = gbo > 0 ? gbo : vvo;
                const isSale = SALE_STRATEGIES.includes(strategy);
""",
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    "                const epm2 = contribution > 0 && m2 > 0 ? Math.round(contribution / m2) : 0;\n",
    "                const epm2 = contribution > 0 && pricingM2 > 0 ? Math.round(contribution / pricingM2) : 0;\n",
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    '                    <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{m2 > 0 ? fmtM2(m2, 0) : \'—\'}</TableCell>',
    '                    <TableCell className="text-right font-mono-data tabular-nums"><SurfaceCell gbo={gbo} vvo={vvo} bvo={bvo} /></TableCell>',
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    '                <TableCell className="text-right font-mono-data tabular-nums whitespace-nowrap">{fmtM2(totalM2, 0)}</TableCell>',
    '                <TableCell className="text-right font-mono-data tabular-nums"><SurfaceCell gbo={surfaceTotals.gbo} vvo={surfaceTotals.vvo} bvo={surfaceTotals.bvo} /></TableCell>',
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    "              surface: num(r.surface_gbo) ?? num(r.surface_vvo),\n",
    "              surface: num(r.surface_gbo) ?? num(r.surface_vvo) ?? num(r.surface_bvo),\n",
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    "    surface: num(r.surface_gbo) ?? num(r.surface_vvo),\n",
    "    surface: num(r.surface_gbo) ?? num(r.surface_vvo) ?? num(r.surface_bvo),\n",
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    """      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
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
""",
    """      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-8 gap-3">
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
""",
)
replace_one(
    "src/components/vastgoedrekenen/ComponentStrategyTable.tsx",
    """  );
}

function UnitRow({ unit, index, onUpdate, onDelete, hideHeader }: { unit: SellOffUnit; index: number; onUpdate: Props['onUpdate']; onDelete: Props['onDelete']; hideHeader?: boolean }) {
""",
    """  );
}

function SurfaceCell({ gbo, vvo, bvo }: { gbo: number; vvo: number; bvo: number }) {
  const rows = [
    { label: 'GBO', value: gbo },
    { label: 'VVO', value: vvo },
    { label: 'BVO', value: bvo },
  ].filter((row) => row.value > 0);

  if (rows.length === 0) return <span>—</span>;

  return (
    <div className="flex flex-col items-end gap-0.5 whitespace-nowrap leading-tight">
      {rows.map((row) => (
        <span key={row.label}><span className="text-muted-foreground">{row.label}</span> {fmtM2(row.value)}</span>
      ))}
    </div>
  );
}

function UnitRow({ unit, index, onUpdate, onDelete, hideHeader }: { unit: SellOffUnit; index: number; onUpdate: Props['onUpdate']; onDelete: Props['onDelete']; hideHeader?: boolean }) {
""",
)

# 5. Gerichte broncode-regressietest voor de acceptatiebevindingen.
Path("src/test/ui/vastgoedrekenenAcceptanceLayout.test.ts").write_text(
    """import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

describe('Vastgoedrekenen Fase 1.1 acceptatie-UX', () => {
  it('registreert GBO, VVO en BVO afzonderlijk in de componentstrategie', () => {
    const code = source('src/components/vastgoedrekenen/ComponentStrategyTable.tsx');
    expect(code).toContain('GBO — gebruiksoppervlakte (m²)');
    expect(code).toContain('VVO — verhuurbare vloeroppervlakte (m²)');
    expect(code).toContain('BVO — bruto vloeroppervlakte (m²)');
    expect(code).toContain('SurfaceCell gbo={gbo} vvo={vvo} bvo={bvo}');
    expect(code).not.toContain('fmtM2(m2, 0)');
  });

  it('verbergt de algemene Deal Cockpit en gebruikt één kolom op Vastgoedrekenen', () => {
    const code = source('src/pages/ObjectDetailPage.tsx');
    expect(code).toContain("activeTab === 'vastgoedrekenen' ? 'grid-cols-1'");
    expect(code).toContain("activeTab === 'vastgoedrekenen' ? 'hidden'");
  });

  it('beheert het centrale register buiten de objectquickscan', () => {
    const detail = source('src/components/vastgoedrekenen/VastgoedrekenenTab.tsx');
    const overview = source('src/pages/VastgoedrekenenPage.tsx');
    expect(detail).not.toContain('KengetallenRegisterPanel');
    expect(detail).toContain('ScenarioKengetallenPanel');
    expect(overview).toContain('KengetallenRegisterPanel');
  });
});
""",
    encoding="utf-8",
)
