from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    file = Path(path)
    text = file.read_text()
    if old not in text:
        raise SystemExit(f'Pattern not found in {path}: {old[:120]!r}')
    if text.count(old) != 1:
        raise SystemExit(f'Pattern occurs {text.count(old)} times in {path}: {old[:120]!r}')
    file.write_text(text.replace(old, new, 1))


# Fase 1.2 — acquisition rows are the fiscal parts; mixed-use requires separate rows.
replace_once(
    'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx',
    'Leg hier uitsluitend vast wat juridisch en feitelijk wordt verkregen. Eén huidig verkrijgingsdeel kan aan meerdere toekomstige strategie-units worden gekoppeld. OVB wordt niet meer afgeleid uit de toekomstige verkoopstructuur zodra deze tabel is ingevuld.',
    'Leg hier de huidige fiscale verkrijgingsdelen vast. Eén perceel of levering mag meerdere regels hebben, bijvoorbeeld een woondeel en een winkelgedeelte. Toekomstige strategie-units bepalen de OVB niet.',
)
replace_once(
    'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx',
    "                    || diag.mixedAllocationMethods\n                    || !component.transfer_tax_classification;\n                  const status = incomplete ? 'Incompleet' : exemptionNeedsSource ? 'Onderbouwen' : 'Compleet';",
    "                    || diag.mixedAllocationMethods\n                    || diag.requiresSplit\n                    || !component.transfer_tax_classification;\n                  const status = diag?.requiresSplit ? 'Splitsen' : incomplete ? 'Incompleet' : exemptionNeedsSource ? 'Onderbouwen' : 'Compleet';",
)
replace_once(
    'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx',
    '                  </div>\n\n                  <div className="rounded-md border bg-muted/25 p-3 text-xs space-y-1">',
    '''                  </div>\n\n                  {openComponent.transfer_tax_classification === 'mixed_use' && (\n                    <div className="flex gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-900 dark:text-amber-100">\n                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />\n                      <div className="space-y-1">\n                        <p className="font-semibold">Splits dit gemengde deel in afzonderlijke fiscale regels</p>\n                        <p>Maak bijvoorbeeld één regel voor het bestaande woongedeelte en één regel voor de winkelruimte. Beide regels mogen bij hetzelfde perceel en dezelfde levering horen.</p>\n                      </div>\n                    </div>\n                  )}\n\n                  <div className="rounded-md border bg-muted/25 p-3 text-xs space-y-1">''',
)
replace_once(
    'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx',
    '<Field label="Huidige waarde bij verkrijging (€)"><RawNumberInput',
    '<Field label="Verdeelwaarde / aandeel aankoopprijs (€)"><RawNumberInput',
)
replace_once(
    'src/components/vastgoedrekenen/cockpit/AcquisitionComponentsTable.tsx',
    '<Field label="Bron / onderbouwing huidige waarde of vrijstelling">',
    '<Field label="Toelichting / onderbouwing — optioneel">',
)

# Fase 1.2 — residual/readiness validation may not accept mixed-use as a final tax row.
replace_once(
    'src/lib/vastgoedrekenen/compute.ts',
    "      if (!component.transfer_tax_classification) {\n        residualCriticalIssues.push(`${component.component_name ?? 'Component'}: expliciete OVB-classificatie bij verkrijging ontbreekt.`);\n      }",
    "      if (component.transfer_tax_classification === 'mixed_use') {\n        residualCriticalIssues.push(`${component.component_name ?? 'Component'}: mixed-use is geen eindtarief; splits dit in afzonderlijke fiscale verkrijgingsregels.`);\n      } else if (!component.transfer_tax_classification) {\n        residualCriticalIssues.push(`${component.component_name ?? 'Component'}: expliciete OVB-classificatie bij verkrijging ontbreekt.`);\n      }",
)

# Fase 1.3 — integrate read-only sensitivity panel into ScenarioEditor.
replace_once(
    'src/components/vastgoedrekenen/ScenarioEditor.tsx',
    "import AccordionToolbar from './cockpit/AccordionToolbar';",
    "import AccordionToolbar from './cockpit/AccordionToolbar';\nimport SensitivityAnalysis from './SensitivityAnalysis';",
)
replace_once(
    'src/components/vastgoedrekenen/ScenarioEditor.tsx',
    '      {/* Rekenbasis */}\n      <RekenbasisBar scenario={s} outputs={outputs} />',
    '''      {/* Rekenbasis */}\n      <RekenbasisBar scenario={s} outputs={outputs} />\n\n      <SensitivityAnalysis\n        scenario={s}\n        components={components}\n        acquisitionComponents={acquisitionComponents}\n        costs={draftCosts}\n        wwsUnits={wwsUnits}\n        strategyUnits={sellOffUnits}\n        taxSettings={taxSettings}\n        objectType={objectType}\n        objectArea={objectArea}\n        objectWoz={props.objectWoz}\n        objectEnergyLabel={props.objectEnergyLabel}\n        objectBouwjaar={props.objectBouwjaar}\n        propertyType={propertyType}\n      />''',
)
replace_once(
    'src/components/vastgoedrekenen/ScenarioEditor.tsx',
    '          || p.mixedAllocationMethods\n          || p.usesFutureStrategyAllocation',
    '          || p.mixedAllocationMethods\n          || p.requiresSplit\n          || p.usesFutureStrategyAllocation',
)

# Self-delete after successful application so the branch contains only product code.
Path(__file__).unlink()
