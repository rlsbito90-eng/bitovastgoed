import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const bron = readFileSync(
  new URL('../../../supabase/functions/off-market-enrich-signaal/index.ts', import.meta.url),
  'utf8',
);

describe('Off-Market AI providercontract', () => {
  it('gebruikt direct Google Gemini en geen Lovable AI-gateway', () => {
    expect(bron).toContain("Deno.env.get('GEMINI_API_KEY')");
    expect(bron).toContain('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect(bron).not.toContain('LOVABLE_API_KEY');
    expect(bron).not.toContain('ai.gateway.lovable.dev');
  });

  it('houdt modelkeuze configureerbaar en normaliseert de oude google/ prefix', () => {
    expect(bron).toContain("Deno.env.get('AI_DEFAULT_MODEL')");
    expect(bron).toContain("model.startsWith('google/')");
    expect(bron).toContain("'gemini-3.6-flash'");
  });

  it('behoudt auth, audit en BAG-cascade als aparte veiligheidslagen', () => {
    expect(bron).toContain("admin.rpc('is_intern_gebruiker'");
    expect(bron).toContain(".from('off_market_ai_runs')");
    expect(bron).toContain("admin.functions.invoke('off-market-bag-verrijk'");
  });
});
