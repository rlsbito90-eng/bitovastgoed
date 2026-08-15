import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowDown, CircleCheck, Gauge, Info, Target } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { useAcquisitieTrackingPrestaties } from '@/hooks/useAcquisitieTrackingPrestaties';
import {
  bouwCockpitSamenvatting,
  type CockpitDoel,
  type CockpitSeverity,
} from '@/lib/acquisitie/cockpit';

const pct = (value: number) => `${new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 1 }).format(value)}%`;
const euro = (value: number) => new Intl.NumberFormat('nl-NL', {
  style: 'currency', currency: 'EUR', maximumFractionDigits: 0,
}).format(value);

function springNaar(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function AcquisitieCockpit() {
  const jaar = new Date().getFullYear();
  const { jaarActuals, isLoading, error } = useAcquisitieTrackingPrestaties(jaar);
  const doelQuery = useQuery({
    queryKey: ['acquisitie-jaardoel', jaar],
    queryFn: async (): Promise<CockpitDoel | null> => {
      const { data, error: queryError } = await (supabase as any)
        .from('jaar_doelen')
        .select('*')
        .eq('jaar', jaar)
        .maybeSingle();
      if (queryError) throw new Error(queryError.message);
      return (data ?? null) as CockpitDoel | null;
    },
    staleTime: 60_000,
  });

  const samenvatting = useMemo(
    () => bouwCockpitSamenvatting(jaarActuals, doelQuery.data ?? null),
    [jaarActuals, doelQuery.data],
  );

  const laadFout = error ?? doelQuery.error;

  if (isLoading || doelQuery.isLoading) {
    return (
      <section className="rounded-lg border border-border bg-card p-5 text-sm text-muted-foreground">
        Acquisitiecockpit laden…
      </section>
    );
  }

  if (laadFout) {
    return (
      <section className="rounded-lg border border-border bg-card p-5">
        <h1 className="text-xl font-semibold text-foreground">Acquisitiecockpit</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          De cockpit kon niet volledig worden geladen. De bestaande acquisitiefunnel blijft beschikbaar.
        </p>
      </section>
    );
  }

  const statusLabel = samenvatting.status === 'kritiek'
    ? 'Direct ingrijpen'
    : samenvatting.status === 'aandacht'
      ? 'Aandacht nodig'
      : 'Op schema';

  return (
    <section className="rounded-lg border border-border bg-card p-5 space-y-5" data-testid="acquisitie-cockpit">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Gauge className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-xl font-semibold tracking-tight text-foreground">Acquisitiecockpit</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Eén stuurlaag voor tempo, respons, kosten en opvolging. Actuals komen automatisch uit de acquisitie-meetlaag.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusPill status={samenvatting.status} label={statusLabel} />
          <Button type="button" size="sm" variant="outline" onClick={() => springNaar('acquisitie-prestaties-detail')}>
            Details <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => springNaar('acquisitie-funnel-detail')}>
            Funnel <ArrowDown className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <CockpitMetric
          label="Jaar verstreken"
          value={pct(samenvatting.jaarVoortgang * 100)}
          detail={`${jaar} · tempo-referentie`}
        />
        <CockpitMetric
          label="Verzonden"
          value={String(jaarActuals.verzondenCommunicaties)}
          detail={`${jaarActuals.reacties} reacties · ${pct(jaarActuals.responspercentage)} respons`}
        />
        <CockpitMetric
          label="Positieve reacties"
          value={String(jaarActuals.positieveReacties)}
          detail={`${pct(jaarActuals.positieveResponspercentage)} van verzonden`}
        />
        <CockpitMetric
          label="Kadasterkosten"
          value={euro(jaarActuals.kadasterKostenBesteBeschikbaar)}
          detail={`${jaarActuals.kadasterAanvragen} aanvragen · beste beschikbare kostenbron`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1.45fr_0.55fr]">
        <div className="rounded-md border border-border overflow-hidden">
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Wat vraagt aandacht?</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Deterministisch uit doeltempo, respons, budget en kwaliteit van de geregistreerde meetevents.
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{samenvatting.signalen.length} signaal{samenvatting.signalen.length === 1 ? '' : 'en'}</span>
          </div>
          <div className="divide-y divide-border">
            {samenvatting.signalen.map(signaal => (
              <div key={signaal.id} className="flex gap-3 px-4 py-3">
                <SignaalIcoon severity={signaal.severity} />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground">{signaal.titel}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{signaal.toelichting}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-md border border-border p-4 space-y-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Target className="h-3.5 w-3.5" /> Besturingsdekking
            </div>
            <div className="mt-1 text-2xl font-semibold font-mono-data text-foreground">{samenvatting.doelDekking}/5</div>
            <p className="mt-1 text-xs text-muted-foreground">
              acquisitie-KPI's hebben een expliciet jaardoel. Lege doelen blijven bewust buiten de beoordeling.
            </p>
          </div>
          <div className="border-t border-border pt-4">
            <div className="text-xs font-medium text-muted-foreground">Opvolging in meetlaag</div>
            <div className="mt-1 text-lg font-semibold font-mono-data text-foreground">
              {samenvatting.opvolgingAangemaakt} aangemaakt · {samenvatting.opvolgingAfgerond} afgerond
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Dit is eventregistratie, niet automatisch hetzelfde als de actuele operationele takenvoorraad.
            </p>
          </div>
          <div className="border-t border-border pt-4 text-xs text-muted-foreground flex gap-2">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <p>De cockpit voert zelf geen Kadasteraanvragen, briefverzendingen of statuswijzigingen uit.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

function CockpitMetric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold font-mono-data text-foreground">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}

function StatusPill({ status, label }: { status: 'kritiek' | 'aandacht' | 'op_schema'; label: string }) {
  const cls = status === 'kritiek'
    ? 'border-destructive/30 bg-destructive/10 text-destructive'
    : status === 'aandacht'
      ? 'border-warning/30 bg-warning/10 text-warning'
      : 'border-success/30 bg-success/10 text-success';
  return <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${cls}`}>{label}</span>;
}

function SignaalIcoon({ severity }: { severity: CockpitSeverity }) {
  if (severity === 'kritiek') return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  if (severity === 'aandacht') return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />;
  if (severity === 'op_schema') return <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />;
  return <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />;
}
