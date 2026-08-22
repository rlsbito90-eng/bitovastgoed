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
    expect(bron).toContain('provider = budget.provider');
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

  it('audit providerfouten en laat een signaal niet op bezig hangen', () => {
    expect(bron).toContain('providerAttemptStarted = true');
    expect(bron).toContain("ai_status: 'niet_verrijkt'");
    expect(bron).toContain('succes: false');
    expect(bron).toContain('fout: message');
    expect(bron.indexOf("ai_status: 'niet_verrijkt'")).toBeGreaterThan(bron.indexOf('catch (error)'));
  });

  it('beperkt AI-assettype tot geldige CRM-enumwaarden', () => {
    expect(bron).toContain("'appartementencomplex'");
    expect(bron).toContain("'transformatieobject'");
    expect(bron).toContain("enum: [...ASSETTYPES]");
    expect(bron).toContain('normaliseAssettype(output.geclassificeerd_assettype)');
  });

  it('mag een AI-run pas succesvol loggen nadat de signaalupdate is geslaagd', () => {
    expect(bron).toContain('const { error: updateError }');
    expect(bron).toContain('if (updateError) throw new Error(`AI-signaalupdate mislukt: ${updateError.message}`)');
    expect(bron.indexOf('if (updateError) throw new Error')).toBeLessThan(bron.indexOf('provider_request_id: result.requestId'));
  });

  it('redigeert API-sleutels uit opgeslagen foutmeldingen', () => {
    expect(bron).toContain('safeErrorMessage');
    expect(bron).toContain('[REDACTED]');
  });

  it('start geen BAG- of Kadaster-cascade', () => {
    expect(bron).not.toContain("functions.invoke('off-market-bag-verrijk'");
    expect(bron.toLowerCase()).not.toContain('kadaster-objectinformatie');
  });
});
