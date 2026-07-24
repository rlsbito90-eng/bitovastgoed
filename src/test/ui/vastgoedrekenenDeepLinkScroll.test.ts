import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Vastgoedrekenen deep-linkscroll', () => {
  it('blijft uitlijnen totdat hero en tabinhoud stabiel zijn', () => {
    const code = readFileSync(resolve(process.cwd(), 'src/pages/ObjectDetailPage.tsx'), 'utf8');
    expect(code).toContain("performScroll(hash, 'auto')");
    expect(code).toContain('attempts < 18 || stablePasses < 5');
    expect(code).toContain('[activeTab, location.hash, requestedCalculationId]');
  });
});
