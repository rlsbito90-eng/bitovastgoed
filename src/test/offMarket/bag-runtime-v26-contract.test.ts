import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const source = fs.readFileSync(
  path.join(process.cwd(), 'supabase/functions/off-market-bag-runtime-v26/index.ts'),
  'utf8',
);

describe('Off-Market BAG runtime V2.6', () => {
  it('heeft veilige cron-auth met server-side fallback en interne JWT', () => {
    expect(source).toContain("Deno.env.get('OFF_MARKET_CRON_SECRET')");
    expect(source).toContain("off_market_runtime_secrets");
    expect(source).toContain(".eq('key', 'cron_secret')");
    expect(source).toContain("auth.getClaims");
    expect(source).toContain("is_intern_gebruiker");
  });

  it('valideert postcode, huisnummer en toevoeging voordat een doelobject exact wordt', () => {
    expect(source).toContain('suffixMatches');
    expect(source).toContain('exactDoc');
    expect(source).toContain("bag_match_kwaliteit:'exact'");
    expect(source).toContain("bag_status:'meerdere_matches'");
    expect(source).toContain('Gekozen BAG-match afgewezen');
  });

  it('haalt gratis BAG pandcontext op en bewaart VBO-, pand-, oppervlakte- en bouwjaarvelden', () => {
    expect(source).toContain('api.pdok.nl/bzk/locatieserver');
    expect(source).toContain('service.pdok.nl/lv/bag/wfs');
    expect(source).toContain('wfsByVbo');
    expect(source).toContain('wfsByPand');
    expect(source).toContain('bag_vbos');
    expect(source).toContain('bag_pand_ids');
    expect(source).toContain('bag_vbo_ids');
    expect(source).toContain('bag_totaal_oppervlakte_m2');
    expect(source).toContain('bag_bouwjaar');
  });

  it('bevat geen automatische of betaalde Kadaster- of AI-call', () => {
    expect(source).not.toMatch(/kadaster-objectinformatie|kadaster-product|kadaster-ophalen|api\.kadaster\.nl/i);
    expect(source).not.toMatch(/openai|anthropic|gemini|off-market-enrich-signaal/i);
    expect(source).toContain('berekenKadasteradvies');
  });
});
