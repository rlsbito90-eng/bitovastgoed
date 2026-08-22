import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const bron = readFileSync(
  resolve(process.cwd(), 'supabase/functions/_shared/offMarketAiProvider.ts'),
  'utf8',
);

describe('Off-Market AI providerlaag', () => {
  it('ondersteunt OpenAI, Anthropic en Gemini expliciet', () => {
    expect(bron).toContain("export type AiProvider = 'openai' | 'anthropic' | 'gemini'");
    expect(bron).toContain('https://api.openai.com/v1/chat/completions');
    expect(bron).toContain('https://api.anthropic.com/v1/messages');
    expect(bron).toContain('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
  });

  it('houdt secrets provider-specifiek en buiten de databasecode', () => {
    expect(bron).toContain("requiredSecret('OPENAI_API_KEY')");
    expect(bron).toContain("requiredSecret('ANTHROPIC_API_KEY')");
    expect(bron).toContain("requiredSecret('GEMINI_API_KEY')");
    expect(bron).not.toContain('LOVABLE_API_KEY');
  });

  it('dwingt bij OpenAI en Claude hetzelfde toolcontract af', () => {
    expect(bron).toContain('strict: true');
    expect(bron).toContain('parallel_tool_calls: false');
    expect(bron).toContain("tool_choice: { type: 'tool', name: request.tool.name, disable_parallel_tool_use: true }");
  });

  it('registreert usage provider-onafhankelijk voor latere kostenbewaking', () => {
    expect(bron).toContain('inputTokens');
    expect(bron).toContain('outputTokens');
    expect(bron).toContain('estimateCostUsd');
    expect(bron).toContain("Deno.env.get('AI_INPUT_USD_PER_MILLION')");
    expect(bron).toContain("Deno.env.get('AI_OUTPUT_USD_PER_MILLION')");
  });

  it('heeft kostenefficiënte maar configureerbare standaardmodellen', () => {
    expect(bron).toContain("'gpt-5.6-luna'");
    expect(bron).toContain("'claude-sonnet-4-6'");
    expect(bron).toContain("'gemini-3.6-flash'");
    expect(bron).toContain("Deno.env.get('AI_DEFAULT_MODEL')");
  });
});
