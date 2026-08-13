import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const badge = readFileSync('src/components/bag/BagCrmMatchBadge.tsx', 'utf8');
const hook = readFileSync('src/hooks/useVastgoedkansen.tsx', 'utf8');
const compactHook = hook.replace(/\s+/g, '');

describe('Pandenverkenner heropenen', () => {
  it('toont archiefdatum, reden en een expliciete heropenactie', () => {
    expect(badge).toContain("toonArchiefActie = true");
    expect(badge).toContain('Gearchiveerd op');
    expect(badge).toContain('vastgoedkans.archivedReason');
    expect(badge).toContain("'Heropenen'");
  });

  it('heropent uitsluitend het bestaande Vastgoedkans-id', () => {
    expect(badge).toContain('await restoreKansen([vastgoedkans.id])');
    expect(badge).not.toContain('addKans(');
    expect(badge).not.toContain('useVoegVastgoedkansToeAanAcquisitieSelectie');
  });

  it('bestaande restore-lifecycle wist alleen archiefmetadata', () => {
    expect(compactHook).toContain('update({archived_at:null,archived_by:null,archived_reason:null})');
    expect(compactHook).toContain(".not('archived_at','is',null)");
  });
});
