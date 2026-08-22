import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('Post/E-mail semantiek', () => {
  it('maakt de e-mailmodus expliciet en houdt Kadaster-posthulp buiten het e-mailadresveld', () => {
    const bron = readFileSync('src/components/offmarket/BriefVoorbereidenDialog.tsx', 'utf8');
    expect(bron).toContain("kanaal === 'email' ? 'E-mailadres' : 'Verzendadres'");
    expect(bron).toContain('Kadaster-postadresgegevens worden in e-mailmodus niet gebruikt.');
    expect(bron).toContain('handleKanaalWissel');
    expect(bron).toContain("const nieuwAdres = kanaal === 'email' ? ''");
    expect(bron).toContain("toast.error('Vul eerst een geldig e-mailadres in.')");
  });

  it('persisteert het definitieve kanaal bij markeren als verzonden', () => {
    const bron = readFileSync('src/hooks/useOffMarketBrieven.tsx', 'utf8');
    expect(bron).toContain("status: 'verstuurd',\n        kanaal,");
    expect(bron).toContain("event_type: isEmail ? 'sent' : 'posted'");
    expect(bron).toContain('if (!input.kanaal_wijzigen) delete payload.kanaal;');
  });
});
