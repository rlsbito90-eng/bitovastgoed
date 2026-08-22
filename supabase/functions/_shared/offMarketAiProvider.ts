// Provider-onafhankelijke AI-adapter voor Off-Market Radar.
// Ondersteunt OpenAI, Anthropic Claude en Google Gemini zonder businesslogica te kennen.
// API-keys blijven uitsluitend runtime-secrets; nooit loggen of persisteren.

export type AiProvider = 'openai' | 'anthropic' | 'gemini';

export interface AiToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface AiProviderRequest {
  provider: AiProvider;
  model: string;
  systemPrompt: string;
  userMessage: string;
  tool: AiToolDefinition;
  maxOutputTokens?: number;
}

export interface AiUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface AiProviderResult {
  provider: AiProvider;
  model: string;
  output: Record<string, unknown>;
  usage: AiUsage;
  requestId: string | null;
}

export class AiProviderError extends Error {
  readonly provider: AiProvider;
  readonly status: number;
  readonly retryable: boolean;

  constructor(provider: AiProvider, status: number, message: string) {
    super(message);
    this.name = 'AiProviderError';
    this.provider = provider;
    this.status = status;
    this.retryable = status === 408 || status === 409 || status === 429 || status >= 500;
  }
}

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const GEMINI_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
const ANTHROPIC_ENDPOINT = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

function requiredSecret(name: string): string {
  const value = Deno.env.get(name)?.trim();
  if (!value) throw new Error(`${name} ontbreekt`);
  return value;
}

export function resolveProvider(raw = Deno.env.get('AI_PROVIDER')): AiProvider {
  const value = (raw ?? 'gemini').toLowerCase().trim();
  if (value === 'openai' || value === 'anthropic' || value === 'gemini') return value;
  throw new Error(`Onbekende AI_PROVIDER: ${value}`);
}

export function resolveDefaultModel(provider: AiProvider): string {
  const generic = Deno.env.get('AI_DEFAULT_MODEL')?.trim();
  if (generic) return normaliseModel(provider, generic);

  if (provider === 'openai') return Deno.env.get('OPENAI_DEFAULT_MODEL')?.trim() || 'gpt-5.6-luna';
  if (provider === 'anthropic') return Deno.env.get('ANTHROPIC_DEFAULT_MODEL')?.trim() || 'claude-sonnet-4-6';
  return Deno.env.get('GEMINI_DEFAULT_MODEL')?.trim() || 'gemini-3.6-flash';
}

export function normaliseModel(provider: AiProvider, model: string): string {
  let value = model.trim();
  if (provider === 'gemini' && value.startsWith('google/')) value = value.slice('google/'.length);
  if (provider === 'openai' && value.startsWith('openai/')) value = value.slice('openai/'.length);
  if (provider === 'anthropic' && value.startsWith('anthropic/')) value = value.slice('anthropic/'.length);
  return value;
}

function safeProviderError(provider: AiProvider, status: number, body: string): AiProviderError {
  const compact = body.replace(/\s+/g, ' ').slice(0, 500);
  return new AiProviderError(provider, status, `HTTP ${status}${compact ? `: ${compact}` : ''}`);
}

function openAiTool(tool: AiToolDefinition) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
      strict: true,
    },
  };
}

async function invokeOpenAiCompatible(
  request: AiProviderRequest,
  endpoint: string,
  apiKey: string,
): Promise<AiProviderResult> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userMessage },
      ],
      tools: [openAiTool(request.tool)],
      tool_choice: { type: 'function', function: { name: request.tool.name } },
      parallel_tool_calls: false,
    }),
  });

  const requestId = response.headers.get('x-request-id');
  if (!response.ok) throw safeProviderError(request.provider, response.status, await response.text().catch(() => ''));

  const json = await response.json();
  const call = json?.choices?.[0]?.message?.tool_calls?.find(
    (item: any) => item?.type === 'function' && item?.function?.name === request.tool.name,
  );
  const args = call?.function?.arguments;
  if (typeof args !== 'string' || !args.trim()) {
    throw new AiProviderError(request.provider, 502, `Geen ${request.tool.name}-toolcall in AI-response`);
  }

  let output: Record<string, unknown>;
  try {
    output = JSON.parse(args);
  } catch {
    throw new AiProviderError(request.provider, 502, 'AI-toolcall bevat ongeldige JSON');
  }

  return {
    provider: request.provider,
    model: request.model,
    output,
    usage: {
      inputTokens: Number.isFinite(json?.usage?.prompt_tokens) ? Number(json.usage.prompt_tokens) : null,
      outputTokens: Number.isFinite(json?.usage?.completion_tokens) ? Number(json.usage.completion_tokens) : null,
    },
    requestId,
  };
}

async function invokeAnthropic(request: AiProviderRequest, apiKey: string): Promise<AiProviderResult> {
  const response = await fetch(ANTHROPIC_ENDPOINT, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: request.model,
      max_tokens: Math.max(256, Math.min(request.maxOutputTokens ?? 1200, 4096)),
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userMessage }],
      tools: [{
        name: request.tool.name,
        description: request.tool.description,
        input_schema: request.tool.parameters,
        strict: true,
      }],
      tool_choice: { type: 'tool', name: request.tool.name, disable_parallel_tool_use: true },
    }),
  });

  const requestId = response.headers.get('request-id') ?? response.headers.get('x-request-id');
  if (!response.ok) throw safeProviderError(request.provider, response.status, await response.text().catch(() => ''));

  const json = await response.json();
  const block = Array.isArray(json?.content)
    ? json.content.find((item: any) => item?.type === 'tool_use' && item?.name === request.tool.name)
    : null;
  if (!block?.input || typeof block.input !== 'object' || Array.isArray(block.input)) {
    throw new AiProviderError(request.provider, 502, `Geen ${request.tool.name}-toolcall in Claude-response`);
  }

  return {
    provider: request.provider,
    model: request.model,
    output: block.input as Record<string, unknown>,
    usage: {
      inputTokens: Number.isFinite(json?.usage?.input_tokens) ? Number(json.usage.input_tokens) : null,
      outputTokens: Number.isFinite(json?.usage?.output_tokens) ? Number(json.usage.output_tokens) : null,
    },
    requestId,
  };
}

export async function invokeAiProvider(request: AiProviderRequest): Promise<AiProviderResult> {
  const normalized: AiProviderRequest = {
    ...request,
    model: normaliseModel(request.provider, request.model),
  };

  if (normalized.provider === 'openai') {
    return invokeOpenAiCompatible(normalized, OPENAI_ENDPOINT, requiredSecret('OPENAI_API_KEY'));
  }
  if (normalized.provider === 'anthropic') {
    return invokeAnthropic(normalized, requiredSecret('ANTHROPIC_API_KEY'));
  }
  return invokeOpenAiCompatible(normalized, GEMINI_ENDPOINT, requiredSecret('GEMINI_API_KEY'));
}

export function estimateCostUsd(
  usage: AiUsage,
  inputUsdPerMillion = Number(Deno.env.get('AI_INPUT_USD_PER_MILLION') ?? '0'),
  outputUsdPerMillion = Number(Deno.env.get('AI_OUTPUT_USD_PER_MILLION') ?? '0'),
): number | null {
  if (usage.inputTokens == null || usage.outputTokens == null) return null;
  if (!Number.isFinite(inputUsdPerMillion) || !Number.isFinite(outputUsdPerMillion)) return null;
  const cost = (usage.inputTokens / 1_000_000) * inputUsdPerMillion
    + (usage.outputTokens / 1_000_000) * outputUsdPerMillion;
  return Math.round(cost * 1_000_000) / 1_000_000;
}
