import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const bron = readFileSync(
  resolve(process.cwd(), 'src/components/offmarket/acquisitie/FocusWerkInhoud.tsx'),
  'utf8',
);

const BR_MOUNT = '<ProductiekernBriefActies signaalId={signaal.id} />';

describe('Productiekern BR-routing in Focus', () => {
  it('houdt de BR-bridge bereikbaar in zowel briefcontext als onderzoekscontext', () => {
    const voorkomens = bron.split(BR_MOUNT).length - 1;
    expect(voorkomens).toBe(2);

    const onderzoekStart = bron.indexOf('data-testid="focus-onderzoeken-inhoud"');
    const onderzoekMount = bron.indexOf(BR_MOUNT, bron.indexOf(BR_MOUNT) + BR_MOUNT.length);
    const kadasterSectie = bron.indexOf('id="focus-kadaster"');

    expect(onderzoekStart).toBeGreaterThan(-1);
    expect(onderzoekMount).toBeGreaterThan(onderzoekStart);
    expect(kadasterSectie).toBeGreaterThan(onderzoekMount);
  });

  it('laat de formele BR-actie zelf de overgang naar brief_opstellen uitvoeren', () => {
    const bridgeMigratie = readFileSync(
      resolve(process.cwd(), 'supabase/migrations/20260816214000_acquisitie_productiekern_bestaand_concept_bridge.sql'),
      'utf8',
    );

    expect(bridgeMigratie).toMatch(
      /update public\.off_market_acquisitie_dossiers[\s\S]*primaire_werkbak = 'brief_opstellen'/i,
    );
  });
});
