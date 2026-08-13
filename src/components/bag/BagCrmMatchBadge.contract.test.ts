import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const badge = readFileSync(
  resolve(process.cwd(), 'src/components/bag/BagCrmMatchBadge.tsx'),
  'utf8',
);
const lijst = readFileSync(
  resolve(process.cwd(), 'src/components/bag/BagServicePandenlijst.tsx'),
  'utf8',
);

describe('private BAG CRM-broncontext', () => {
  it('verwijst naar de bestaande routes voor alle CRM-bronnen', () => {
    expect(badge).toContain('/vastgoedkansen/${kans.id}');
    expect(badge).toContain('/objecten/${object.id}');
    expect(badge).toContain('/off-market/${signaal.id}');
    expect(badge).toContain('matchtype');
  });

  it('toont voor Vastgoedkansen de actuele CRM-lifecycle in plaats van alleen een generieke match', () => {
    expect(badge).toContain('useActieveVastgoedkansSelectieIds');
    expect(badge).toContain("label = 'Al Vastgoedkans'");
    expect(badge).toContain("label = 'In Acquisitieselectie'");
    expect(badge).toContain("label = 'Gearchiveerd'");
    expect(badge).toContain('kans?.archivedAt');
  });

  it('vervangt de generieke blokkadebadge door broncontext', () => {
    expect(lijst).toContain('<BagCrmMatchBadge pand={pand}');
    expect(lijst).toContain('fallbackLabel={REDEN_LABEL[blokkade]}');
  });
});
