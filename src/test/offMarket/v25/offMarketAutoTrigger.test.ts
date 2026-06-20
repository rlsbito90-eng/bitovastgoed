// V2.5 — Server-side helper voor automatische AI-trigger na normalisatie.
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

describe('magAiAutoVerrijken — server-side', () => {
  it('staat toe bij volledig nieuw signaal met adres/plaats', () => {
    expect(magAiAutoVerrijken(basis).toegestaan).toBe(true);
  });

  it('blokkeert bij gearchiveerd signaal', () => {
    expect(
      magAiAutoVerrijken({ ...basis, gearchiveerd_op: '2026-01-01' }).toegestaan,
    ).toBe(false);
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
    expect(
      magAiAutoVerrijken({ ...basis, ai_skip_reden: 'te weinig info' }).toegestaan,
    ).toBe(false);
  });

  it('blokkeert bij ontbrekende titel', () => {
    expect(magAiAutoVerrijken({ ...basis, titel: '' }).toegestaan).toBe(false);
  });

  it('blokkeert bij ontbrekende locatie (geen adres/plaats/bron_url)', () => {
    expect(
      magAiAutoVerrijken({ ...basis, adres: null, plaats: null, bron_url: null })
        .toegestaan,
    ).toBe(false);
  });

  it('staat toe als alleen bron_url aanwezig is (titel + locatie-fallback)', () => {
    expect(
      magAiAutoVerrijken({
        ...basis,
        adres: null,
        plaats: null,
        bron_url: 'https://bron.example/x',
      }).toegestaan,
    ).toBe(true);
  });

  it('cap is 50', () => {
    expect(AI_TRIGGER_CAP_PER_RUN).toBe(50);
  });
});

// Simulatie van de normalize-loop: nieuwe inserts triggeren AI, merges nooit,
// en maximaal AI_TRIGGER_CAP_PER_RUN aanroepen per run.
describe('normalize-ruw cascade — simulatie', () => {
  type Row = {
    soort: 'nieuw' | 'merge' | 'ongeschikt' | 'gearchiveerd' | 'al_verrijkt';
  };

  function simuleer(rows: Row[]) {
    const aangeroepen: string[] = [];
    let aiGetriggerd = 0;
    let gepromoveerd = 0;
    let merged = 0;

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.soort === 'merge') {
        merged++;
        continue; // expliciet GEEN AI-trigger bij merge
      }
      // Nieuw signaal: insert lukte, "row" gesimuleerd
      const signaalId = `sig-${i}`;
      gepromoveerd++;
      const row =
        r.soort === 'gearchiveerd'
          ? { ...basis, id: signaalId, gearchiveerd_op: '2026-01-01' }
          : r.soort === 'al_verrijkt'
            ? { ...basis, id: signaalId, ai_status: 'klaar' }
            : r.soort === 'ongeschikt'
              ? { ...basis, id: signaalId, adres: null, plaats: null, bron_url: null }
              : { ...basis, id: signaalId };
      const beslissing = magAiAutoVerrijken(row);
      if (beslissing.toegestaan && aiGetriggerd < AI_TRIGGER_CAP_PER_RUN) {
        aiGetriggerd++;
        aangeroepen.push(signaalId);
      }
    }
    return { aangeroepen, aiGetriggerd, gepromoveerd, merged };
  }

  it('triggert precies 1× per nieuw geschikt signaal', () => {
    const r = simuleer([{ soort: 'nieuw' }]);
    expect(r.aiGetriggerd).toBe(1);
    expect(r.aangeroepen).toEqual(['sig-0']);
  });

  it('triggert geen AI bij merge van bestaand signaal', () => {
    const r = simuleer([{ soort: 'merge' }, { soort: 'merge' }, { soort: 'merge' }]);
    expect(r.aiGetriggerd).toBe(0);
    expect(r.merged).toBe(3);
  });

  it('respecteert hard cap van 50 bij 80 nieuwe promoties', () => {
    const r = simuleer(Array.from({ length: 80 }, () => ({ soort: 'nieuw' as const })));
    expect(r.gepromoveerd).toBe(80);
    expect(r.aiGetriggerd).toBe(50);
    expect(r.aangeroepen).toHaveLength(50);
  });

  it('triggert geen AI voor ongeschikt signaal zonder adresgegevens', () => {
    const r = simuleer([{ soort: 'ongeschikt' }]);
    expect(r.aiGetriggerd).toBe(0);
  });

  it('triggert geen AI voor gearchiveerd of reeds verrijkt signaal', () => {
    const r = simuleer([{ soort: 'gearchiveerd' }, { soort: 'al_verrijkt' }]);
    expect(r.aiGetriggerd).toBe(0);
  });
});

// Borging: dit pad mag NOOIT Kadaster of BAG aanroepen.
describe('normalize-ruw cascade — Kadaster/BAG-borging', () => {
  it('helper en module bevatten geen verwijzing naar Kadaster of BAG-edge-functions', async () => {
    const fs = await import('node:fs/promises');
    const path = await import('node:path');
    const root = path.resolve(__dirname, '../../../..');
    const bestanden = [
      'supabase/functions/_shared/offMarketAutoTrigger.ts',
      'supabase/functions/off-market-normalize-ruw/index.ts',
    ];
    for (const rel of bestanden) {
      const content = await fs.readFile(path.join(root, rel), 'utf8');
      expect(content).not.toMatch(/off-market-bag-verrijk/);
      expect(content).not.toMatch(/off-market-kadaster-check/);
      expect(content).not.toMatch(/kadaster-objectinformatie/);
    }
  });
});
