from pathlib import Path

path = Path('src/components/vastgoedrekenen/cockpit/ComponentenTable.tsx')
source = path.read_text()

source = source.replace(
    "import { Trash2, Pencil, X } from 'lucide-react';",
    "import { Trash2, Pencil, X, CircleDollarSign, CheckCircle2, AlertTriangle, ArrowRight } from 'lucide-react';",
    1,
)

source = source.replace(
    "  const warnings = perComp ? ovbPerComponent.filter((d) => d.missingValueBasis || d.missingStrategyBasis || d.missingManualAmount).length : 0;",
    "  const incompleteOvb = perComp ? ovbPerComponent.filter((d) => d.missingValueBasis || d.missingStrategyBasis || d.missingManualAmount) : [];\n  const warnings = incompleteOvb.length;",
    1,
)

marker = '''      {selected.size > 0 && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 px-3 py-2 text-xs">'''

block = '''      {perComp && (
        <section className={`mb-3 rounded-lg border p-3 space-y-3 ${warnings > 0 ? 'border-amber-500/40 bg-amber-500/5' : 'border-emerald-500/30 bg-emerald-500/5'}`}>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <CircleDollarSign className="h-4 w-4 text-primary" />
                <h4 className="text-sm font-semibold">OVB per component</h4>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                Controleer per component de waardegrondslag, classificatie en toerekeningsmethode. Klik een component om de OVB-invoer direct te openen.
              </p>
            </div>
            <div className={`shrink-0 rounded-full border px-2.5 py-1 text-[10px] font-medium ${warnings > 0 ? 'border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200'}`}>
              {warnings > 0 ? `${warnings} onvolledig` : 'Alle componenten compleet'}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 text-[11px]">
            <WorkflowStep number="1" label="Waardegrondslag" text="Toegerekende waarde, m²-verdeling, componentstrategie of handmatig bedrag." />
            <WorkflowStep number="2" label="Classificatie" text="Woning, hoofdverblijf of niet-woning per component." />
            <WorkflowStep number="3" label="Tarief" text="Automatisch tarief of alleen bij uitzondering een onderbouwde override." />
            <WorkflowStep number="4" label="Controle" text="Grondslag × tarief moet aansluiten op het berekende OVB-bedrag." />
          </div>

          <div className="rounded-md border bg-background/80 divide-y divide-border/60">
            {components.map((component, index) => {
              const diag = ovbPerComponent.find((item) => item.id === component.id) ?? null;
              const missing = !!diag && (diag.missingValueBasis || diag.missingStrategyBasis || diag.missingManualAmount);
              const identitySurface = Number(component.surface_gbo ?? 0) || Number(component.surface_vvo ?? 0) || Number(component.surface_bvo ?? 0) || null;
              const identity = formatUnitIdentity({ label: component.component_name, type: component.component_type, surface: identitySurface }, index);
              const reason = !diag
                ? 'Nog geen OVB-berekening beschikbaar.'
                : diag.missingValueBasis
                  ? 'Waardegrondslag ontbreekt.'
                  : diag.missingStrategyBasis
                    ? 'Waarde uit componentstrategie ontbreekt.'
                    : diag.missingManualAmount
                      ? 'Handmatig OVB-bedrag ontbreekt.'
                      : `${diag.basisMethod} · ${fmtEur(diag.basisValue)} × ${diag.pct.toFixed(diag.pct % 1 === 0 ? 0 : 1)}% = ${fmtEur(diag.amount)}`;
              return (
                <button
                  key={`ovb-workflow-${component.id}`}
                  type="button"
                  onClick={() => { setOpenId(component.id); setEditMode(true); }}
                  className="w-full grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 text-left hover:bg-muted/40"
                >
                  {missing || !diag
                    ? <AlertTriangle className="h-4 w-4 text-amber-600" />
                    : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                  <span className="min-w-0">
                    <span className="block text-xs font-medium truncate">{identity.indexStr} — {identity.primary}</span>
                    <span className={`block text-[10px] truncate ${missing || !diag ? 'text-amber-800 dark:text-amber-200' : 'text-muted-foreground'}`}>{reason}</span>
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-primary">
                    Open invoer <ArrowRight className="h-3 w-3" />
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-[10px] text-muted-foreground">
            Een component is compleet wanneer de gekozen methode een bruikbare grondslag oplevert en het OVB-bedrag berekenbaar is. De uiteindelijke fiscale kwalificatie blijft te controleren met notaris of fiscalist.
          </p>
        </section>
      )}

'''

if marker not in source:
    raise SystemExit('selected block marker not found')
source = source.replace(marker, block + marker, 1)

helper_marker = '''function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {'''
helper = '''function WorkflowStep({ number, label, text }: { number: string; label: string; text: string }) {
  return (
    <div className="rounded-md border bg-background/70 p-2">
      <div className="flex items-center gap-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-full border text-[10px] font-semibold">{number}</span>
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <p className="mt-1 leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

'''
if helper_marker not in source:
    raise SystemExit('tile helper marker not found')
source = source.replace(helper_marker, helper + helper_marker, 1)

path.write_text(source)
