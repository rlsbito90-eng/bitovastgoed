// V2.2 — kamerverhuur-profiel dekt leegstaand, deels verhuurd en exploitatie.
import { describe, it, expect } from 'vitest';
import { buildEmailTemplate } from '@/lib/offMarket/email/emailProfielen';

describe('kamerverhuur_verhuur_exploitatieoptimalisatie — tekstdekking', () => {
  it('tekst noemt leegstaande, deels verhuurde en exploitatie', () => {
    const t = buildEmailTemplate({
      profiel: 'kamerverhuur_verhuur_exploitatieoptimalisatie',
      adres: 'Demostraat 12', plaats: 'Voorbeeldwijk',
    });
    expect(t.brieftekst.toLowerCase()).toContain('leegstaande');
    expect(t.brieftekst.toLowerCase()).toContain('deels verhuurde');
    expect(t.brieftekst.toLowerCase()).toContain('exploitatie');
    expect(t.brieftekst.toLowerCase()).toMatch(/verhuurpotentie|verkamering/);
  });
});
