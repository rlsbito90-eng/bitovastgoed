// V2.7 — Statische borging van auth-hardening + server-side BAG-cascade.
// Pure grep-tests; introduceren geen runtime-afhankelijkheden.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(__dirname, '../../../..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

describe('off-market-bag-verrijk — auth hardenen', () => {
  const src = read('supabase/functions/off-market-bag-verrijk/index.ts');

  it('accepteert x-cron-secret-bypass via OFF_MARKET_CRON_SECRET', () => {
    expect(src).toMatch(/OFF_MARKET_CRON_SECRET/);
    expect(src).toMatch(/x-cron-secret/i);
    expect(src).toMatch(/Access-Control-Allow-Headers[^\n]*x-cron-secret/i);
  });

  it('verifieert JWT en interne rol bij gewone gebruikersroute', () => {
    expect(src).toMatch(/getClaims/);
    expect(src).toMatch(/is_intern_gebruiker/);
  });

  it('wijst lege of willekeurige bearer-tokens af voordat business-code draait', () => {
    expect(src).toMatch(/Niet geautoriseerd/);
    // Lege token na "Bearer " wordt expliciet geweigerd.
    expect(src).toMatch(/slice\(7\)/);
  });

  it('persisteert Kadasteradvies server-side, alleen bij bag_status=verrijkt', () => {
    expect(src).toMatch(/persistKadasteradvies/);
    expect(src).toMatch(/bag_status !== 'verrijkt'/);
    expect(src).toMatch(/kadasteradvies_berekend_op/);
  });

  it('roept geen Kadaster-API of betaalde check aan', () => {
    expect(src).not.toMatch(/kadaster-objectinformatie/);
    expect(src).not.toMatch(/off-market-kadaster-check/);
    expect(src).not.toMatch(/api\.kadaster\.nl/i);
  });
});

describe('off-market-enrich-signaal — server-side BAG-cascade', () => {
  const src = read('supabase/functions/off-market-enrich-signaal/index.ts');

  it('leest cascade_bag uit body met default true', () => {
    expect(src).toMatch(/body\.cascade_bag\s*!==\s*false/);
  });

  it('definieert planBagCascade met cron-secret, re-fetch en guard', () => {
    expect(src).toMatch(/function planBagCascade/);
    expect(src).toMatch(/magBagAutoVerrijken/);
    expect(src).toMatch(/off-market-bag-verrijk/);
    expect(src).toMatch(/x-cron-secret/);
    expect(src).toMatch(/EdgeRuntime/);
  });

  it('inspecteert zowel invoke-error als data.error in achtergrond-task', () => {
    expect(src).toMatch(/BAG-cascade invoke-fout/);
    expect(src).toMatch(/BAG-cascade response-fout/);
    expect(src).toMatch(/BAG-cascade geweigerd/);
  });

  it('roept planBagCascade na cached-pad én fresh-pad', () => {
    const matches = src.match(/planBagCascade\(signaalId\)/g) ?? [];
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('cascade_bag:false stopt vóór elke BAG-invoke', () => {
    // De guard `if (!cascadeBag) return;` zit bovenaan planBagCascade.
    expect(src).toMatch(/if\s*\(!cascadeBag\)\s*return;/);
  });

  it('roept geen Kadaster-API aan', () => {
    expect(src).not.toMatch(/kadaster-objectinformatie/);
    expect(src).not.toMatch(/off-market-kadaster-check/);
  });
});

describe('client-hooks — geen automatische BAG-cascade of advieswrite meer', () => {
  it('useEnrichSignaal triggert geen client-side BAG-cascade', () => {
    const src = read('src/hooks/useEnrichSignaal.tsx');
    expect(src).not.toMatch(/triggerBagAutoNaAi/);
    expect(src).not.toMatch(/off-market-bag-verrijk/);
  });

  it('useBagVerrijken schrijft geen client-side Kadasteradvies meer', () => {
    const src = read('src/hooks/useBagVerrijken.tsx');
    expect(src).not.toMatch(/persistKadasteradvies/);
  });

  it('AI-backlog blijft cascade_bag:false sturen', () => {
    const src = read('src/hooks/useAiBacklog.tsx');
    expect(src).toMatch(/cascade_bag:\s*false/);
  });
});
