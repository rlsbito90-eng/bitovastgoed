import fs from 'node:fs';
import { describe, expect, it } from 'vitest';

const responsHook = fs.readFileSync('src/hooks/useRegistreerRespons.tsx', 'utf8');
const dashboardHook = fs.readFileSync('src/hooks/useAcquisitieConversieDashboard.ts', 'utf8');

describe('responsattributie guard', () => {
  it('schrijft respons alleen op de exacte verzonden brief binnen hetzelfde signaal', () => {
    expect(responsHook).toContain(".eq('id', input.brief_id)");
    expect(responsHook).toContain(".eq('signaal_id', input.signaal_id)");
    expect(responsHook).toContain(".eq('status', 'verstuurd')");
  });

  it('ververst de centrale meetlaag na respons en bij terugkeer naar het dashboard', () => {
    expect(responsHook).toContain("queryKey: ['acquisitie-conversie-dashboard']");
    expect(dashboardHook).toContain('staleTime: 0');
    expect(dashboardHook).toContain("refetchOnWindowFocus: 'always'");
  });
});
