import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bron = readFileSync(
  resolve(process.cwd(), 'supabase/functions/off-market-enrich-signaal-v2/index.ts'),
  'utf8',
);

describe('Off-Market AI enrich V2 contract', () => {
  it('blokkeert via centrale budgetguard vóór provider-call', () => {
    const budgetPos = bron.indexOf('requireAiBudget');
    const invokePos = bron.indexOf('invokeAiProvider({');
    expect(budgetPos).toBeGreaterThan(-1);
    expect(invokePos).toBeGreaterThan(budgetPos);
  });

  it('kiest provider vanuit centrale configuratie en niet hardcoded', () => {
    expect(bron).toContain('const provider = budget.provider');
    expect(bron).toContain('budget.default_model ?? resolveDefaultModel(provider)');
    expect(bron).not.toContain('GEMINI_API_KEY');
    expect(bron).not.toContain('OPENAI_API_KEY');
    expect(bron).not.toContain('ANTHROPIC_API_KEY');
  });

  it('registreert provider, tokens, kosten en provider request id', () => {
    expect(bron).toContain('provider_request_id: result.requestId');
    expect(bron).toContain('input_tokens: result.usage.inputTokens');
    expect(bron).toContain('output_tokens: result.usage.outputTokens');
    expect(bron).toContain('kosten: cost');
  });

  it('start geen BAG- of Kadaster-cascade', () => {
    expect(bron).not.toContain("functions.invoke('off-market-bag-verrijk'");
    expect(bron.toLowerCase()).not.toContain('kadaster-objectinformatie');
  });
});
