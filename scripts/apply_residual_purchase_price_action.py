from pathlib import Path

editor_path = Path('src/components/vastgoedrekenen/ScenarioEditor.tsx')
editor = editor_path.read_text()

old_vars = """  const showHelp = viewMode === 'begeleid';
  const ovbMode = s.ovb_mode;
  const rentSource = (s.rent_source ?? 'handmatig') as keyof typeof RENT_SOURCE_LABELS;
  const rentFromComponents = rentSource === 'componenten';
"""
new_vars = """  const showHelp = viewMode === 'begeleid';
  const ovbMode = s.ovb_mode;
  const rentSource = (s.rent_source ?? 'handmatig') as keyof typeof RENT_SOURCE_LABELS;
  const rentFromComponents = rentSource === 'componenten';
  const residualMaxPurchasePrice = Math.max(0, Number(outputs.residual?.maxPurchasePrice ?? 0));
  const currentPurchasePrice = Math.max(0, Number(s.purchase_price ?? 0));
  const purchaseDeltaToResidual = residualMaxPurchasePrice > 0 && currentPurchasePrice > 0
    ? residualMaxPurchasePrice - currentPurchasePrice
    : null;
"""
if old_vars not in editor:
    raise SystemExit('scenario variables insertion point not found')
editor = editor.replace(old_vars, new_vars, 1)

old_field = """                <MobileFieldGroup label=\"Beoogde aankoopprijs (€)\"><NumInput onRawChange={markDirtyFromRaw} value={s.purchase_price} onChange={(v) => patch({ purchase_price: v })} placeholder=\"bijv. 1500000\" suffix=\"€\" /></MobileFieldGroup>"""
new_field = """                <MobileFieldGroup
                  label=\"Beoogde aankoopprijs (€)\"
                  helper={residualMaxPurchasePrice > 0 ? (
                    <div className=\"space-y-1 text-[10px]\">
                      <div className=\"flex flex-wrap items-center gap-x-2 gap-y-1\">
                        <span className=\"text-muted-foreground\">
                          {outputs.residual?.status === 'voor_bieding' ? 'Residuele maximale aankoopprijs' : 'Indicatieve residuele maximale aankoopprijs'}: <span className=\"font-medium font-mono-data text-foreground\">{fmtEur(residualMaxPurchasePrice)}</span>
                        </span>
                        <button
                          type=\"button\"
                          onClick={() => patch({ purchase_price: residualMaxPurchasePrice })}
                          className=\"font-medium text-primary underline underline-offset-2 hover:text-primary/80\"
                        >
                          Neem residuele waarde over
                        </button>
                      </div>
                      {purchaseDeltaToResidual != null && (
                        <p className={purchaseDeltaToResidual < 0 ? 'text-amber-700 dark:text-amber-300' : 'text-muted-foreground'}>
                          {purchaseDeltaToResidual > 0
                            ? `${fmtEur(purchaseDeltaToResidual)} onder de residuele bovengrens`
                            : purchaseDeltaToResidual < 0
                              ? `${fmtEur(Math.abs(purchaseDeltaToResidual))} boven de residuele bovengrens`
                              : 'Gelijk aan de residuele bovengrens'}
                        </p>
                      )}
                    </div>
                  ) : undefined}
                >
                  <NumInput onRawChange={markDirtyFromRaw} value={s.purchase_price} onChange={(v) => patch({ purchase_price: v })} placeholder=\"bijv. 1500000\" suffix=\"€\" />
                </MobileFieldGroup>"""
if old_field not in editor:
    raise SystemExit('purchase price field not found')
editor = editor.replace(old_field, new_field, 1)
editor_path.write_text(editor)

test_path = Path('src/test/ui/residualPurchasePriceAction.test.ts')
test_path.write_text("""import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const editor = readFileSync(resolve(process.cwd(), 'src/components/vastgoedrekenen/ScenarioEditor.tsx'), 'utf8');

describe('beoogde aankoopprijs en residuele waarde', () => {
  it('houdt de beoogde aankoopprijs vrij bewerkbaar', () => {
    expect(editor).toContain('value={s.purchase_price}');
    expect(editor).toContain("onChange={(v) => patch({ purchase_price: v })}");
  });

  it('biedt een expliciete eenmalige overname van de residuele waarde', () => {
    expect(editor).toContain('Neem residuele waarde over');
    expect(editor).toContain("onClick={() => patch({ purchase_price: residualMaxPurchasePrice })}");
  });

  it('toont het verschil met de residuele bovengrens', () => {
    expect(editor).toContain('onder de residuele bovengrens');
    expect(editor).toContain('boven de residuele bovengrens');
    expect(editor).toContain('Gelijk aan de residuele bovengrens');
  });

  it('markeert een nog indicatieve residuele uitkomst als indicatief', () => {
    expect(editor).toContain('Indicatieve residuele maximale aankoopprijs');
    expect(editor).toContain("outputs.residual?.status === 'voor_bieding'");
  });
});
""")
