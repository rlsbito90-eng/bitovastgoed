import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronRight, Info } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import {
  ACQUISITIE_BRON_LABEL,
  berekenBronAggregaat,
  berekenFunnelAggregaat,
  filterSignalen,
  FUNNEL_STAGES,
  FUNNEL_STAGE_KORT,
  fmtPct,
  signalenDieStageBereikten,
  signalenOpStage,
  stageRank,
  type AcquisitieBron,
  type FunnelFilters,
  type FunnelStage,
} from '@/lib/acquisitie/funnel';
import { STATUS_LABEL, STATUS_VOLGORDE, type OffMarketStatus } from '@/lib/offMarket/types';

const selectCls = 'h-9 rounded-md border border-input bg-background px-2 text-sm';

const BRONNEN: AcquisitieBron[] = [
  'off_market_radar', 'facebook_ads', 'website', 'netwerk', 'bestaande_relatie',
  'inkomend_telefoon', 'linkedin', 'handmatige_acquisitie', 'referral', 'makelaar_collega', 'anders',
];

type DrillSelectie =
  | { soort: 'bereikt'; stage: FunnelStage }
  | { soort: 'op'; stage: FunnelStage | 'afgevallen' };

export default function AcquisitieFunnelPage() {
  const { data: signalenRaw = [], isLoading } = useOffMarketSignalen();

  // Filters
  const [periodeVan, setPeriodeVan] = useState<string>('');
  const [periodeTot, setPeriodeTot] = useState<string>('');
  const [bron, setBron] = useState<AcquisitieBron | ''>('');
  const [gemeente, setGemeente] = useState<string>('');
  const [status, setStatus] = useState<OffMarketStatus | ''>('');
  const [drill, setDrill] = useState<DrillSelectie | null>(null);

  const filters: FunnelFilters = useMemo(() => ({
    periodeVan: periodeVan || null,
    periodeTot: periodeTot || null,
    bron: bron || null,
    gemeente: gemeente || null,
    status: status || null,
  }), [periodeVan, periodeTot, bron, gemeente, status]);

  const signalen = useMemo(() => filterSignalen(signalenRaw, filters), [signalenRaw, filters]);
  const aggregaat = useMemo(() => berekenFunnelAggregaat(signalen), [signalen]);
  const bronAgg = useMemo(() => berekenBronAggregaat(signalen), [signalen]);

  const drillRecords = useMemo(() => {
    if (!drill) return [];
    if (drill.soort === 'op') return signalenOpStage(signalen, drill.stage);
    return signalenDieStageBereikten(signalen, drill.stage);
  }, [drill, signalen]);

  const resetFilters = () => {
    setPeriodeVan(''); setPeriodeTot(''); setBron(''); setGemeente(''); setStatus(''); setDrill(null);
  };

  const maxAantal = Math.max(1, ...aggregaat.stappen.map(s => s.aantal));

  return (
    <div className="page-shell-full space-y-6">
      <PageHeader
        title="Acquisitie-funnel"
        subtitle="Hoe acquisitie van signaal naar transactie loopt. V1: Off-Market Radar als enige aangesloten bron."
      />

      {/* Filterbalk */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Van
            <Input type="date" value={periodeVan} onChange={e => setPeriodeVan(e.target.value)} className="h-9" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Tot
            <Input type="date" value={periodeTot} onChange={e => setPeriodeTot(e.target.value)} className="h-9" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Bron
            <select className={selectCls} value={bron} onChange={e => setBron(e.target.value as AcquisitieBron | '')}>
              <option value="">Alle bronnen</option>
              {BRONNEN.map(b => (
                <option key={b} value={b}>{ACQUISITIE_BRON_LABEL[b]}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Gemeente
            <Input value={gemeente} onChange={e => setGemeente(e.target.value)} placeholder="bijv. Amsterdam" className="h-9" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            Status
            <select className={selectCls} value={status} onChange={e => setStatus(e.target.value as OffMarketStatus | '')}>
              <option value="">Alle statussen</option>
              {STATUS_VOLGORDE.map(s => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </label>
          <div className="flex items-end">
            <Button variant="outline" size="sm" onClick={resetFilters} className="w-full h-9">
              Filters wissen
            </Button>
          </div>
        </div>
      </div>

      {/* KPI-totalen */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Totaal signalen" waarde={signalen.length} />
        <KpiCard label="Actief in funnel" waarde={aggregaat.totaalActief} />
        <KpiCard label="Afgevallen / archief" waarde={aggregaat.totaalAfgevallen} muted />
        <KpiCard
          label="Conversie signaal → benaderd"
          waarde={
            aggregaat.stappen.find(s => s.stage === 'benaderd')?.conversieInstroom ?? null
          }
          isPercent
        />
      </div>

      {/* Funnel */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Funnel</h2>
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Info className="h-3.5 w-3.5" />
            Hoogst bereikte stap per signaal. Klik op een stap om eronder de records te zien.
          </p>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Laden…</p>
        ) : (
          <div className="space-y-1.5">
            {aggregaat.stappen.map((stap, idx) => {
              const breedte = (stap.aantal / maxAantal) * 100;
              const actief = drill?.soort === 'bereikt' && drill.stage === stap.stage;
              return (
                <button
                  key={stap.stage}
                  type="button"
                  onClick={() => setDrill(actief ? null : { soort: 'bereikt', stage: stap.stage })}
                  className={`w-full text-left rounded-md border transition-colors ${
                    actief ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'
                  }`}
                >
                  <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                    <div className="col-span-3 text-xs text-muted-foreground flex items-center gap-1">
                      <span className="font-mono-data text-[10px] w-4 text-right">{idx + 1}.</span>
                      <span className="text-foreground font-medium">{stap.label}</span>
                    </div>
                    <div className="col-span-6">
                      <div className="h-6 bg-muted/40 rounded overflow-hidden">
                        <div
                          className={`h-full ${actief ? 'bg-primary/70' : 'bg-primary/40'} transition-all`}
                          style={{ width: `${Math.max(2, breedte)}%` }}
                        />
                      </div>
                    </div>
                    <div className="col-span-1 text-right font-mono-data text-sm">{stap.aantal}</div>
                    <div className="col-span-1 text-right text-xs text-muted-foreground" title="t.o.v. vorige stap">
                      {fmtPct(stap.conversiePrev)}
                    </div>
                    <div className="col-span-1 text-right text-xs text-muted-foreground" title="t.o.v. instroom">
                      {fmtPct(stap.conversieInstroom)}
                    </div>
                  </div>
                </button>
              );
            })}

            <button
              type="button"
              onClick={() =>
                setDrill(
                  drill?.soort === 'op' && drill.stage === 'afgevallen'
                    ? null
                    : { soort: 'op', stage: 'afgevallen' },
                )
              }
              className={`w-full text-left rounded-md border transition-colors ${
                drill?.soort === 'op' && drill.stage === 'afgevallen'
                  ? 'border-destructive/60 bg-destructive/5'
                  : 'border-border hover:bg-muted/40'
              }`}
            >
              <div className="grid grid-cols-12 items-center gap-2 px-3 py-2">
                <div className="col-span-3 text-xs text-muted-foreground">
                  <span className="text-foreground font-medium">Afgevallen / archief</span>
                </div>
                <div className="col-span-6" />
                <div className="col-span-1 text-right font-mono-data text-sm">{aggregaat.totaalAfgevallen}</div>
                <div className="col-span-2 text-right text-xs text-muted-foreground">
                  {signalen.length > 0
                    ? fmtPct(aggregaat.totaalAfgevallen / signalen.length)
                    : '—'}
                </div>
              </div>
            </button>

            <div className="grid grid-cols-12 gap-2 px-3 pt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
              <div className="col-span-3">Stap</div>
              <div className="col-span-6" />
              <div className="col-span-1 text-right">Aantal</div>
              <div className="col-span-1 text-right">vs vorige</div>
              <div className="col-span-1 text-right">vs instroom</div>
            </div>
          </div>
        )}
      </section>

      {/* Bronvergelijking */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">Per bron</h2>
          <p className="text-xs text-muted-foreground">V1: alleen Off-Market Radar is volledig aangesloten.</p>
        </div>
        {bronAgg.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen actieve signalen binnen de filters.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wider text-muted-foreground border-b">
                  <th className="text-left py-2 pr-4">Bron</th>
                  <th className="text-right py-2 pr-3">Totaal</th>
                  {FUNNEL_STAGES.slice(1).map(s => (
                    <th key={s} className="text-right py-2 pr-3 whitespace-nowrap">{FUNNEL_STAGE_KORT[s]}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bronAgg.map(row => (
                  <tr key={row.bron} className="border-b last:border-0">
                    <td className="py-2 pr-4 font-medium">{row.label}</td>
                    <td className="py-2 pr-3 text-right font-mono-data">{row.totaal}</td>
                    {FUNNEL_STAGES.slice(1).map(s => (
                      <td key={s} className="py-2 pr-3 text-right font-mono-data text-muted-foreground">
                        {row.perStage[s] || '—'}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Drill-down lijst */}
      {drill && (
        <section className="rounded-lg border border-border bg-card p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground flex items-center gap-2">
              {drill.soort === 'bereikt' ? (
                <>Signalen die <span className="text-foreground normal-case">{FUNNEL_STAGE_KORT[drill.stage]}</span> bereikt hebben</>
              ) : (
                <>Afgevallen / gearchiveerd</>
              )}
              <span className="text-muted-foreground font-mono-data">({drillRecords.length})</span>
            </h2>
            <Button variant="ghost" size="sm" onClick={() => setDrill(null)}>Sluiten</Button>
          </div>
          {drillRecords.length === 0 ? (
            <p className="text-sm text-muted-foreground">Geen signalen.</p>
          ) : (
            <ul className="divide-y divide-border">
              {drillRecords.slice(0, 100).map(s => (
                <li key={s.id}>
                  <Link
                    to={`/off-market/${s.id}`}
                    className="flex items-center justify-between gap-3 py-2 hover:bg-muted/40 px-2 rounded-md"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{s.titel}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {[s.plaats, s.provincie].filter(Boolean).join(' · ') || '—'}
                        {' · '}{STATUS_LABEL[s.status]}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </Link>
                </li>
              ))}
              {drillRecords.length > 100 && (
                <li className="py-2 text-xs text-muted-foreground text-center">
                  Toont eerste 100 van {drillRecords.length}.
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      <p className="text-xs text-muted-foreground flex items-center gap-1">
        <ArrowRight className="h-3 w-3" />
        Reactie wordt afgeleid uit "in gesprek". Aanbod en transactie worden in V3 gevuld vanuit biedingen en deals.
      </p>
    </div>
  );
}

function KpiCard({
  label, waarde, isPercent, muted,
}: { label: string; waarde: number | null; isPercent?: boolean; muted?: boolean }) {
  const tekst = waarde === null ? '—' : isPercent ? fmtPct(waarde) : waarde.toLocaleString('nl-NL');
  return (
    <div className={`rounded-lg border p-3 ${muted ? 'border-border bg-muted/30' : 'border-border bg-card'}`}>
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 font-mono-data text-2xl">{tekst}</div>
    </div>
  );
}
