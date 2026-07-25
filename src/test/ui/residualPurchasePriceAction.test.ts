import { readFileSync } from 'node:fs';
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
