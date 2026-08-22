import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Loader2, Save, ShieldCheck, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

type Provider = 'openai' | 'anthropic' | 'gemini';

interface AiConfig {
  ai_enabled: boolean;
  auto_enrich_enabled: boolean;
  auto_max_age_days: number;
  auto_batch_size: number;
  provider: Provider;
  default_model: string | null;
  max_requests_per_day: number;
  max_cost_per_day_usd: number;
  max_cost_per_month_usd: number;
  updated_at: string;
}

interface Usage {
  dayRequests: number;
  dayCost: number;
  monthCost: number;
}

const PROVIDERS: Array<{ value: Provider; label: string; hint: string }> = [
  { value: 'openai', label: 'OpenAI', hint: 'OPENAI_API_KEY server-side vereist' },
  { value: 'anthropic', label: 'Claude / Anthropic', hint: 'ANTHROPIC_API_KEY server-side vereist' },
  { value: 'gemini', label: 'Google Gemini', hint: 'GEMINI_API_KEY server-side vereist' },
];

function usd(v: number) {
  return new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 4 }).format(v || 0);
}

export default function OffMarketAiInstellingenPanel() {
  const db = supabase as any;
  const [config, setConfig] = useState<AiConfig | null>(null);
  const [form, setForm] = useState<AiConfig | null>(null);
  const [usage, setUsage] = useState<Usage>({ dayRequests: 0, dayCost: 0, monthCost: 0 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const laden = useCallback(async () => {
    setLoading(true);
    try {
      const { data: cfg, error: cfgError } = await db
        .from('off_market_ai_config')
        .select('ai_enabled,auto_enrich_enabled,auto_max_age_days,auto_batch_size,provider,default_model,max_requests_per_day,max_cost_per_day_usd,max_cost_per_month_usd,updated_at')
        .eq('id', true)
        .single();
      if (cfgError) throw cfgError;

      const now = new Date();
      const dayStart = new Date(now); dayStart.setHours(0, 0, 0, 0);
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const { data: runs, error: runsError } = await db
        .from('off_market_ai_runs')
        .select('run_op,kosten,succes,provider')
        .gte('run_op', monthStart.toISOString());
      if (runsError) throw runsError;

      const normalized: AiConfig = {
        ...cfg,
        auto_enrich_enabled: cfg.auto_enrich_enabled === true,
        auto_max_age_days: Number(cfg.auto_max_age_days ?? 30),
        auto_batch_size: Number(cfg.auto_batch_size ?? 10),
        max_requests_per_day: Number(cfg.max_requests_per_day ?? 0),
        max_cost_per_day_usd: Number(cfg.max_cost_per_day_usd ?? 0),
        max_cost_per_month_usd: Number(cfg.max_cost_per_month_usd ?? 0),
      };
      setConfig(normalized);
      setForm(normalized);

      let dayRequests = 0, dayCost = 0, monthCost = 0;
      for (const run of runs ?? []) {
        const cost = Number(run.kosten ?? 0);
        if (run.succes === true && cost > 0) monthCost += cost;
        if (new Date(run.run_op) >= dayStart) {
          if (run.provider) dayRequests += 1;
          if (run.succes === true && cost > 0) dayCost += cost;
        }
      }
      setUsage({ dayRequests, dayCost, monthCost });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI-instellingen laden mislukt');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => { laden(); }, [laden]);

  const gewijzigd = useMemo(() => JSON.stringify(config) !== JSON.stringify(form), [config, form]);
  const providerInfo = PROVIDERS.find(p => p.value === form?.provider);

  const opslaan = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const { data: authData } = await supabase.auth.getUser();
      const patch = {
        ai_enabled: form.ai_enabled,
        auto_enrich_enabled: form.auto_enrich_enabled,
        auto_max_age_days: Math.max(1, Math.min(90, Math.floor(Number(form.auto_max_age_days) || 30))),
        auto_batch_size: Math.max(1, Math.min(25, Math.floor(Number(form.auto_batch_size) || 10))),
        provider: form.provider,
        default_model: form.default_model?.trim() || null,
        max_requests_per_day: Math.max(0, Math.floor(Number(form.max_requests_per_day) || 0)),
        max_cost_per_day_usd: Math.max(0, Number(form.max_cost_per_day_usd) || 0),
        max_cost_per_month_usd: Math.max(0, Number(form.max_cost_per_month_usd) || 0),
        updated_at: new Date().toISOString(),
        updated_by: authData.user?.id ?? null,
      };
      const { error } = await db.from('off_market_ai_config').update(patch).eq('id', true);
      if (error) throw error;
      toast.success(patch.ai_enabled ? 'AI-instellingen opgeslagen — AI staat AAN' : 'AI-instellingen opgeslagen — AI blijft UIT');
      await laden();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'AI-instellingen opslaan mislukt');
    } finally {
      setSaving(false);
    }
  };

  if (loading || !form) {
    return <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      <div className={`rounded-lg border p-4 flex items-start gap-3 ${form.ai_enabled ? 'border-warning/40 bg-warning/5' : 'border-success/30 bg-success/5'}`}>
        {form.ai_enabled ? <AlertTriangle className="h-5 w-5 text-warning shrink-0 mt-0.5" /> : <ShieldCheck className="h-5 w-5 text-success shrink-0 mt-0.5" />}
        <div>
          <p className="text-sm font-medium text-foreground">AI-verrijking staat {form.ai_enabled ? 'AAN' : 'UIT'}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {form.ai_enabled
              ? `Nieuwe AI-aanvragen zijn toegestaan binnen de limieten. Automatische Radar-verrijking staat ${form.auto_enrich_enabled ? 'AAN' : 'UIT'}.`
              : 'Er kan geen betaalde AI-provider-call worden uitgevoerd. Radar en gratis GEO blijven onafhankelijk werken.'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Metric label="Aanvragen vandaag" value={`${usage.dayRequests} / ${form.max_requests_per_day}`} />
        <Metric label="Kosten vandaag" value={`${usd(usage.dayCost)} / ${usd(form.max_cost_per_day_usd)}`} />
        <Metric label="Kosten deze maand" value={`${usd(usage.monthCost)} / ${usd(form.max_cost_per_month_usd)}`} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border border-border p-4">
        <div className="sm:col-span-2 flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-3">
          <div>
            <p className="text-sm font-medium">AI actief</p>
            <p className="text-xs text-muted-foreground">Master switch. Uit = harde stop vóór iedere provider-call.</p>
          </div>
          <Switch checked={form.ai_enabled} onCheckedChange={(v) => setForm(p => p ? { ...p, ai_enabled: v } : p)} />
        </div>

        <div className="sm:col-span-2 flex items-center justify-between gap-4 rounded-md border border-border/60 px-3 py-3">
          <div>
            <p className="text-sm font-medium">Radar automatisch verrijken</p>
            <p className="text-xs text-muted-foreground">Alleen recente sterke herpositioneringssignalen. Werkt uitsluitend als de master switch ook aan staat.</p>
          </div>
          <Switch
            checked={form.auto_enrich_enabled}
            onCheckedChange={(v) => setForm(p => p ? { ...p, auto_enrich_enabled: v } : p)}
            data-testid="ai-auto-enrich-switch"
          />
        </div>

        <Field label="Auto-selectie: maximaal aantal dagen oud">
          <Input type="number" min={1} max={90} value={form.auto_max_age_days} onChange={(e) => setForm(p => p ? { ...p, auto_max_age_days: Number(e.target.value) } : p)} />
        </Field>
        <Field label="Auto-selectie: batch per worker-run">
          <Input type="number" min={1} max={25} value={form.auto_batch_size} onChange={(e) => setForm(p => p ? { ...p, auto_batch_size: Number(e.target.value) } : p)} />
        </Field>

        <Field label="Provider">
          <Select value={form.provider} onValueChange={(v) => setForm(p => p ? { ...p, provider: v as Provider, default_model: null } : p)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{PROVIDERS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">{providerInfo?.hint}</p>
        </Field>

        <Field label="Model (optioneel)">
          <Input value={form.default_model ?? ''} placeholder="Leeg = veilige standaard van provider" onChange={(e) => setForm(p => p ? { ...p, default_model: e.target.value } : p)} />
        </Field>

        <Field label="Max. aanvragen per dag">
          <Input type="number" min={0} value={form.max_requests_per_day} onChange={(e) => setForm(p => p ? { ...p, max_requests_per_day: Number(e.target.value) } : p)} />
        </Field>
        <Field label="Max. kosten per dag (USD)">
          <Input type="number" min={0} step="0.10" value={form.max_cost_per_day_usd} onChange={(e) => setForm(p => p ? { ...p, max_cost_per_day_usd: Number(e.target.value) } : p)} />
        </Field>
        <Field label="Max. kosten per maand (USD)">
          <Input type="number" min={0} step="0.50" value={form.max_cost_per_month_usd} onChange={(e) => setForm(p => p ? { ...p, max_cost_per_month_usd: Number(e.target.value) } : p)} />
        </Field>
      </div>

      <div className="text-xs text-muted-foreground flex items-start gap-2 rounded-md bg-muted/40 border border-border/60 px-3 py-2">
        <Sparkles className="h-4 w-4 shrink-0 mt-0.5" />
        <span>Automatische selectie gebruikt eerst gratis/deterministische Radar-regels. API-keys blijven server-side. BAG en Kadaster worden door deze AI-laag nooit automatisch aangeroepen.</span>
      </div>

      <div className="flex justify-end">
        <Button onClick={opslaan} disabled={!gewijzigd || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Instellingen opslaan
        </Button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-border bg-card p-3"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p><p className="text-sm font-semibold mt-1 font-mono-data">{value}</p></div>;
}
