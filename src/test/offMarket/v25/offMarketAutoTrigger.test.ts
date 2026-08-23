// Server-side eligibility helper blijft bruikbaar voor selectie, maar de normalizer
// start AI niet meer rechtstreeks. Dedicated off-market-ai-auto-worker is de enige
// automatische providerroute.
import { describe, it, expect } from 'vitest';
import {
  AI_TRIGGER_CAP_PER_RUN,
  magAiAutoVerrijken,
} from '../../../../supabase/functions/_shared/offMarketAutoTrigger';

const basis = {
  id: 'sig-1',
  titel: 'Splitsingsvergunning Voorbeeldstraat 12',
  adres: 'Voorbeeldstraat 12',
  postcode: '1000 AA',
  plaats: 'Teststad',
  ai_status: 'niet_verrijkt' as const,
};

describe('magAiAutoVerrijken — server-side eligibility', () => {
  it('herkent een volledig nieuw signaal als inhoudelijk geschikt', () => {
    expect(magAiAutoVerrijken(basis).toegestaan).toBe(true);
  });

  it('blokkeert bij gearchiveerd signaal', () => {
    expect(magAiAutoVerrijken({ ...basis, gearchiveerd_op: '2026-01-01' }).toegestaan).toBe(false);
  });

  it('blokkeert bij status archief/afgevallen/niet_interessant', () => {
    for (const status of ['archief', 'afgevallen', 'niet_interessant']) {
      expect(magAiAutoVerrijken({ ...basis, status }).toegestaan).toBe(false);
    }
  });

  it('blokkeert bij ai_status bezig/klaar/geskipt/fout', () => {
    for (const ai_status of ['bezig', 'klaar', 'geskipt', 'fout']) {
      expect(magAiAutoVerrijken({ ...basis, ai_status }).toegestaan).toBe(false);
    }
  });

  it('blokkeert bij ai_skip_reden gezet', () => {
    expect(magAiAutoVerrijken({ ...basis, ai_skip_reden: 'te weinig info' }).toegestaan).toBe(false);
  });

  it('blokkeert bij ontbrekende titel of locatie', () => {
    expect(magAiAutoVerrijken({ ...basis, titel: '' }).toegestaan).toBe(false);
    expect(magAiAutoVerrijken({ ...basis, adres: null, plaats: null, bron_url: null }).toegestaan).toBe(false);
  });

  it('directe normalizer AI-cap staat op nul', () => {
    expect(AI_TRIGGER_CAP_PER_RUN).toBe(0);
  });
});

describe('normalize-ruw AI-cascade — dedicated worker contract', () => {
  function simuleerNieuwePromoties(aantal: number) {
    let directGetriggerd = 0;
    for (let i = 0; i < aantal; i++) {
      const beslissing = magAiAutoVerrijken({ ...basis, id: `sig-${i}` });
      if (beslissing.toegestaan && directGetriggerd < AI_TRIGGER_CAP_PER_RUN) {
        directGetriggerd++;
      }
    }
    return directGetriggerd;
  }

  it('start ook bij veel nieuwe promoties geen AI rechtstreeks vanuit normalisatie', () => {
    expect(simuleerNieuwePromoties(80)).toBe(0);
  });

  it('normalizer bevat geen BAG/Kadaster edge-call', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.resolve(__dirname, '../../../..');
    const content = await fs.readFile(
      path.join(root, 'supabase/functions/off-market-normalize-ruw/index.ts'),
      'utf8',
    );
    expect(content).not.toMatch(/off-market-bag-verrijk/);
    expect(content).not.toMatch(/kadaster-objectinformatie/);
  });
});
