export interface AiBudgetStatus {
  allowed: boolean;
  ai_enabled: boolean;
  provider: 'openai' | 'anthropic' | 'gemini';
  default_model: string | null;
  day_requests: number;
  day_cost_usd: number;
  month_cost_usd: number;
  max_requests_per_day: number;
  max_cost_per_day_usd: number;
  max_cost_per_month_usd: number;
  reason: 'disabled' | 'daily_request_limit' | 'daily_cost_limit' | 'monthly_cost_limit' | 'config_missing' | null;
}

type RpcClient = {
  rpc: (name: string) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

export class AiBudgetError extends Error {
  readonly reason: AiBudgetStatus['reason'];

  constructor(reason: AiBudgetStatus['reason'], message: string) {
    super(message);
    this.name = 'AiBudgetError';
    this.reason = reason;
  }
}

function numberValue(value: unknown): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

export async function getAiBudgetStatus(admin: RpcClient): Promise<AiBudgetStatus> {
  const { data, error } = await admin.rpc('off_market_ai_budget_status');
  if (error) throw new AiBudgetError('config_missing', `AI-budgetstatus niet beschikbaar: ${error.message ?? 'onbekende fout'}`);

  const raw = (data ?? {}) as Record<string, unknown>;
  const provider = raw.provider;
  if (provider !== 'openai' && provider !== 'anthropic' && provider !== 'gemini') {
    throw new AiBudgetError('config_missing', 'AI-providerconfiguratie ontbreekt of is ongeldig');
  }

  return {
    allowed: raw.allowed === true,
    ai_enabled: raw.ai_enabled === true,
    provider,
    default_model: typeof raw.default_model === 'string' && raw.default_model.trim() ? raw.default_model.trim() : null,
    day_requests: numberValue(raw.day_requests),
    day_cost_usd: numberValue(raw.day_cost_usd),
    month_cost_usd: numberValue(raw.month_cost_usd),
    max_requests_per_day: numberValue(raw.max_requests_per_day),
    max_cost_per_day_usd: numberValue(raw.max_cost_per_day_usd),
    max_cost_per_month_usd: numberValue(raw.max_cost_per_month_usd),
    reason: (raw.reason ?? null) as AiBudgetStatus['reason'],
  };
}

export async function requireAiBudget(admin: RpcClient): Promise<AiBudgetStatus> {
  const status = await getAiBudgetStatus(admin);
  if (status.allowed) return status;

  const labels: Record<string, string> = {
    disabled: 'AI-verrijking staat uit',
    daily_request_limit: 'Daglimiet voor AI-aanvragen is bereikt',
    daily_cost_limit: 'Dagbudget voor AI is bereikt',
    monthly_cost_limit: 'Maandbudget voor AI is bereikt',
    config_missing: 'AI-budgetconfiguratie ontbreekt',
  };
  throw new AiBudgetError(status.reason, labels[status.reason ?? 'config_missing'] ?? 'AI-aanvraag geblokkeerd');
}
