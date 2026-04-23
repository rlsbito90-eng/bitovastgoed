// src/pages/RapportagePage.tsx
// Complete overhaul: focus op commissie-tracking, conversie en bronnen.
//
// Secties:
//  1. KPI rij (gerealiseerd, pipeline, deals, gem. dealgrootte)
//  2. Commissie per maand (lijngrafiek, dit jaar vs vorig jaar)
//  3. Conversie funnel (deals per fase, met drop-off %)
//  4. Top bronnen (welke relaties leveren meeste afgeronde deals)
//  5. Gemiddelde doorlooptijd per fase
//  6. Top 10 grootste afgeronde deals
//  7. Asset class verdeling

import { useState, useMemo } from 'react';
import { useDataStore } from '@/hooks/useDataStore';
import {
  berekenCommissieStats,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  ASSET_CLASS_LABELS,
  DEAL_FASE_LABELS,
  FASE_KANS,
} from '@/data/mock-data';
import type { Deal, DealFase } from '@/data/mock-data';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';
import {
  TrendingUp, Award, Target, Activity, Users, Building2, Trophy, ArrowDown,
} from 'lucide-react';
import { Link } from 'react-router-dom';

const FASE_VOLGORDE: DealFase[] = [
  'lead', 'introductie', 'interesse', 'bezichtiging', 'bieding',
  'onderhandeling', 'closing', 'afgerond',
];

export default function RapportagePage() {
  const store = useDataStore();
  const huidigJaar = new Date().getFullYear();
  const [jaar, setJaar] = useState(huidigJaar);

  const jaarDoel = store.getJaarDoel(jaar);
  const vorigJaarDoel = store.getJaarDoel(jaar - 1);

  const stats = useMemo(() => berekenCommissieStats(
    store.deals,
    (objId) => store.getObjectById(objId)?.vraagprijs,
    jaar,
  ), [store.deals, store.objecten, jaar]);

  const statsVorigJaar = useMemo(() => berekenCommissieStats(
    store.deals,
    (objId) => store.getObjectById(objId)?.vraagprijs,
    jaar - 1,
  ), [store.deals, store.objecten, jaar]);

  // Maandelijkse commissie
  const maandData = useMemo(() => {
    const maanden = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec'];
    return maanden.map((m, idx) => {
      const dit = sommeerCommissieMaand(store.deals, jaar, idx);
      const vorig = sommeerCommissieMaand(store.deals, jaar - 1, idx);
      return {
        maand: m,
        [`${jaar}`]: dit,
        [`${jaar - 1}`]: vorig,
      };
    });
  }, [store.deals, jaar]);

  // Cumulatieve maandcommissie tegen doel
  const cumulatiefData = useMemo(() => {
    let som = 0;
    return maandData.map((row) => {
      som += (row as any)[`${jaar}`] as number;
      return {
        maand: row.maand,
        Cumulatief: som,
        Doel: jaarDoel?.commissieDoelBedrag != null
          ? Math.round((jaarDoel.commissieDoelBedrag / 12) * (maandData.indexOf(row) + 1))
          : null,
      };
    });
  }, [maandData, jaarDoel]);

  // Conversie funnel - deals ooit in elke fase (cumulatief richting hoger)
  const funnel = useMemo(() => {
    // Deals die deze fase OF een latere fase hebben bereikt
    const dealsThisYear = store.deals.filter(d => {
      const dealJaar = d.verwachteClosingdatum
        ? new Date(d.verwachteClosingdatum).getFullYear()
        : new Date(d.datumEersteContact).getFullYear();
      return dealJaar === jaar;
    });

    return FASE_VOLGORDE.map((fase, idx) => {
      const indexHuidig = FASE_VOLGORDE.indexOf(fase);
      const aantal = dealsThisYear.filter(d => {
        if (d.fase === 'afgevallen') return idx === 0; // afgevallen tellen alleen in 'lead'
        const dealIdx = FASE_VOLGORDE.indexOf(d.fase);
        return dealIdx >= indexHuidig;
      }).length;
      return { fase: DEAL_FASE_LABELS[fase], aantal };
    });
  }, [store.deals, jaar]);

  const conversiePct = funnel[0].aantal > 0
    ? Math.round((funnel[funnel.length - 1].aantal / funnel[0].aantal) * 100)
    : 0;

  // Top bronnen — relaties met meeste afgeronde deals
  const topBronnen = useMemo(() => {
    const teller = new Map<string, { naam: string; aantal: number; commissie: number }>();
    for (const deal of store.deals) {
      if (deal.fase !== 'afgerond') continue;
      const dealJaar = new Date(deal.verwachteClosingdatum ?? deal.datumEersteContact).getFullYear();
      if (dealJaar !== jaar) continue;
      const rel = store.getRelatieById(deal.relatieId);
      if (!rel) continue;
      // Bron is bij voorkeur 'bron_relatie' veld; valt terug op de relatie zelf
      const bronId = rel.bronRelatie ?? rel.id;
      const bronNaam = rel.bronRelatie ?? rel.bedrijfsnaam;
      const huidig = teller.get(bronId) ?? { naam: bronNaam, aantal: 0, commissie: 0 };
      huidig.aantal += 1;
      huidig.commissie += deal.commissieBedrag ?? 0;
      teller.set(bronId, huidig);
    }
    return Array.from(teller.values())
      .sort((a, b) => b.commissie - a.commissie)
      .slice(0, 5);
  }, [store.deals, store.relaties, jaar]);

  // Top 10 grootste afgeronde deals
  const topDeals = useMemo(() => {
    return store.deals
      .filter(d => d.fase === 'afgerond')
      .filter(d => {
        const dealJaar = new Date(d.verwachteClosingdatum ?? d.datumEersteContact).getFullYear();
        return dealJaar === jaar;
      })
      .sort((a, b) => (b.commissieBedrag ?? 0) - (a.commissieBedrag ?? 0))
      .slice(0, 10);
  }, [store.deals, jaar]);

  // Asset class verdeling van afgeronde deals
  const assetVerdeling = useMemo(() => {
    const teller = new Map<string, number>();
    for (const deal of store.deals) {
      if (deal.fase !== 'afgerond') continue;
      const dealJaar = new Date(deal.verwachteClosingdatum ?? deal.datumEersteContact).getFullYear();
      if (dealJaar !== jaar) continue;
      const obj = store.getObjectById(deal.objectId);
      if (!obj) continue;
      teller.set(obj.type, (teller.get(obj.type) ?? 0) + (deal.commissieBedrag ?? 0));
    }
    return Array.from(teller.entries())
      .map(([type, bedrag]) => ({
        type: ASSET_CLASS_LABELS[type as keyof typeof ASSET_CLASS_LABELS] ?? type,
        bedrag,
      }))
      .sort((a, b) => b.bedrag - a.bedrag);
  }, [store.deals, store.objecten, jaar]);

  // Beschikbare jaren voor selector
  const beschikbareJaren = useMemo(() => {
    const jaren = new Set<number>();
    jaren.add(huidigJaar);
    for (const deal of store.deals) {
      const j = new Date(deal.verwachteClosingdatum ?? deal.datumEersteContact).getFullYear();
      if (j >= 2020 && j <= huidigJaar + 2) jaren.add(j);
    }
    return Array.from(jaren).sort((a, b) => b - a);
  }, [store.deals, huidigJaar]);

  // Groei vs vorig jaar
  const commissieGroeiPct = statsVorigJaar.gerealiseerdBedrag > 0
    ? Math.round(((stats.gerealiseerdBedrag - statsVorigJaar.gerealiseerdBedrag) / statsVorigJaar.gerealiseerdBedrag) * 100)
    : null;

  return (
    <div className="p-6 lg:p-8 max-w-7xl mx-auto space-y-6 fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Rapportage</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Commissie, conversie en momentum.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted-foreground">Jaar</label>
          <select
            value={jaar}
            onChange={e => setJaar(parseInt(e.target.value))}
            className="h-9 px-3 text-sm rounded-md border border-input bg-background"
          >
            {beschikbareJaren.map(j => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI rij */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Award}
          label="Gerealiseerde commissie"
          value={formatCurrencyCompact(stats.gerealiseerdBedrag)}
          subtext={
            commissieGroeiPct != null
              ? `${commissieGroeiPct >= 0 ? '+' : ''}${commissieGroeiPct}% vs ${jaar - 1}`
              : `${stats.gerealiseerdAantalDeals} deal${stats.gerealiseerdAantalDeals === 1 ? '' : 's'} gesloten`
          }
          accent={stats.gerealiseerdBedrag > 0}
        />
        <KPICard
          icon={TrendingUp}
          label="Pipeline (gewogen)"
          value={formatCurrencyCompact(stats.pipelineBedragGewogen)}
          subtext={`${stats.pipelineAantalDeals} actief · totaal ${formatCurrencyCompact(stats.pipelineBedragTotaal)}`}
        />
        <KPICard
          icon={Activity}
          label="Conversie funnel"
          value={`${conversiePct}%`}
          subtext={`${funnel[0].aantal} leads → ${funnel[funnel.length - 1].aantal} closes`}
        />
        <KPICard
          icon={Building2}
          label="Dealwaarde gesloten"
          value={formatCurrencyCompact(stats.dealwaardeGerealiseerd)}
          subtext={
            stats.gerealiseerdAantalDeals > 0
              ? `gem. ${formatCurrencyCompact(stats.dealwaardeGerealiseerd / stats.gerealiseerdAantalDeals)} per deal`
              : '—'
          }
        />
      </div>

      {/* Doelen voortgang */}
      {jaarDoel && (jaarDoel.commissieDoelBedrag || jaarDoel.dealwaardeDoelBedrag) && (
        <div className="section-card p-5 sm:p-6 space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" /> Voortgang jaardoelen {jaar}
          </h2>
          {jaarDoel.commissieDoelBedrag && (
            <Voortgangsbalk
              label="Commissie"
              gerealiseerd={stats.gerealiseerdBedrag}
              doel={jaarDoel.commissieDoelBedrag}
            />
          )}
          {jaarDoel.dealwaardeDoelBedrag && (
            <Voortgangsbalk
              label="Dealwaarde"
              gerealiseerd={stats.dealwaardeGerealiseerd}
              doel={jaarDoel.dealwaardeDoelBedrag}
            />
          )}
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Maandgrafiek */}
        <div className="section-card p-5 sm:p-6 space-y-4">
          <h2 className="section-title">Commissie per maand · {jaar} vs {jaar - 1}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={maandData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="maand" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => formatCurrencyCompact(v)}
              />
              <Tooltip
                formatter={(v: number) => formatCurrency(v)}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Bar dataKey={`${jaar - 1}`} fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[3, 3, 0, 0]} />
              <Bar dataKey={`${jaar}`} fill="hsl(var(--accent))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Cumulatief vs doel */}
        <div className="section-card p-5 sm:p-6 space-y-4">
          <h2 className="section-title">Cumulatieve commissie vs doel · {jaar}</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={cumulatiefData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="maand" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis
                tick={{ fontSize: 11 }}
                stroke="hsl(var(--muted-foreground))"
                tickFormatter={(v) => formatCurrencyCompact(v)}
              />
              <Tooltip
                formatter={(v: number | null) => v != null ? formatCurrency(v) : '—'}
                contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '6px' }}
              />
              <Legend wrapperStyle={{ fontSize: '12px' }} />
              <Line type="monotone" dataKey="Cumulatief" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
              {jaarDoel?.commissieDoelBedrag && (
                <Line type="monotone" dataKey="Doel" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" strokeWidth={1.5} dot={false} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Conversiefunnel */}
      <div className="section-card p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="section-title">Conversie funnel · {jaar}</h2>
          <span className="text-xs text-muted-foreground">
            {funnel[0].aantal} leads → {funnel[funnel.length - 1].aantal} closes ({conversiePct}%)
          </span>
        </div>
        <div className="space-y-1.5">
          {funnel.map((rij, idx) => {
            const max = funnel[0].aantal || 1;
            const pct = (rij.aantal / max) * 100;
            const dropoff = idx > 0 && funnel[idx - 1].aantal > 0
              ? Math.round(((funnel[idx - 1].aantal - rij.aantal) / funnel[idx - 1].aantal) * 100)
              : null;
            return (
              <div key={rij.fase}>
                {idx > 0 && dropoff != null && dropoff > 0 && (
                  <div className="flex items-center gap-1 pl-4 text-[10px] text-muted-foreground -mt-0.5 mb-0.5">
                    <ArrowDown className="h-2.5 w-2.5" /> -{dropoff}%
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-28 sm:w-32 text-xs text-muted-foreground shrink-0">{rij.fase}</div>
                  <div className="flex-1 h-7 bg-muted/40 rounded-md overflow-hidden">
                    <div
                      className={`h-full flex items-center px-2 text-xs font-medium font-mono-data transition-all ${
                        idx === funnel.length - 1
                          ? 'bg-green-500/80 text-white'
                          : 'bg-accent/70 text-accent-foreground'
                      }`}
                      style={{ width: `${Math.max(pct, 4)}%` }}
                    >
                      {rij.aantal}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Top bronnen */}
        <div className="section-card p-5 sm:p-6 space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" /> Top bronnen · {jaar}
          </h2>
          {topBronnen.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nog geen afgeronde deals dit jaar — bronstatistieken verschijnen zodra deals gesloten worden.
            </p>
          ) : (
            <div className="space-y-2">
              {topBronnen.map((b, i) => (
                <div key={i} className="flex items-center justify-between gap-3 p-2.5 bg-muted/30 rounded-md">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{b.naam}</p>
                    <p className="text-xs text-muted-foreground">{b.aantal} deal{b.aantal === 1 ? '' : 's'}</p>
                  </div>
                  <span className="text-sm font-semibold font-mono-data text-foreground">
                    {formatCurrencyCompact(b.commissie)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Asset class verdeling */}
        <div className="section-card p-5 sm:p-6 space-y-4">
          <h2 className="section-title flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" /> Commissie per asset class · {jaar}
          </h2>
          {assetVerdeling.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">
              Nog geen afgeronde deals dit jaar.
            </p>
          ) : (
            <div className="space-y-2">
              {assetVerdeling.map((a, i) => {
                const max = assetVerdeling[0].bedrag || 1;
                const pct = (a.bedrag / max) * 100;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between text-xs mb-0.5">
                      <span className="text-foreground">{a.type}</span>
                      <span className="font-mono-data text-muted-foreground">{formatCurrencyCompact(a.bedrag)}</span>
                    </div>
                    <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
                      <div className="h-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Top 10 deals */}
      <div className="section-card p-5 sm:p-6 space-y-4">
        <h2 className="section-title flex items-center gap-2">
          <Trophy className="h-4 w-4 text-accent" /> Top deals · {jaar}
        </h2>
        {topDeals.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">
            Nog geen afgeronde deals dit jaar — zodra je een deal sluit verschijnt hij hier.
          </p>
        ) : (
          <div className="overflow-x-auto -mx-2">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="text-left font-medium px-2 py-2">#</th>
                  <th className="text-left font-medium px-2 py-2">Object</th>
                  <th className="text-left font-medium px-2 py-2 hidden sm:table-cell">Relatie</th>
                  <th className="text-left font-medium px-2 py-2 hidden md:table-cell">Closing</th>
                  <th className="text-right font-medium px-2 py-2">Commissie</th>
                </tr>
              </thead>
              <tbody>
                {topDeals.map((d, i) => {
                  const obj = store.getObjectById(d.objectId);
                  const rel = store.getRelatieById(d.relatieId);
                  return (
                    <tr key={d.id} className="border-b border-border/40 hover:bg-muted/30">
                      <td className="px-2 py-2.5 text-muted-foreground tabular-nums">{i + 1}</td>
                      <td className="px-2 py-2.5">
                        <Link to={`/deals/${d.id}`} className="text-foreground hover:text-accent">
                          {obj?.titel ?? '—'}
                        </Link>
                      </td>
                      <td className="px-2 py-2.5 text-muted-foreground hidden sm:table-cell">{rel?.bedrijfsnaam ?? '—'}</td>
                      <td className="px-2 py-2.5 text-muted-foreground hidden md:table-cell tabular-nums">
                        {d.verwachteClosingdatum ? formatDate(d.verwachteClosingdatum) : '—'}
                      </td>
                      <td className="px-2 py-2.5 text-right font-semibold font-mono-data">
                        {d.commissieBedrag != null ? formatCurrency(d.commissieBedrag) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}


// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function sommeerCommissieMaand(deals: Deal[], jaar: number, maandIdx: number): number {
  let som = 0;
  for (const deal of deals) {
    if (deal.fase !== 'afgerond') continue;
    const dt = deal.verwachteClosingdatum ?? deal.datumEersteContact;
    if (!dt) continue;
    const d = new Date(dt);
    if (d.getFullYear() !== jaar || d.getMonth() !== maandIdx) continue;
    som += deal.commissieBedrag ?? 0;
  }
  return som;
}

function KPICard({
  icon: Icon, label, value, subtext, accent,
}: {
  icon: any;
  label: string;
  value: string;
  subtext: string;
  accent?: boolean;
}) {
  return (
    <div className={`bg-card border ${accent ? 'border-accent/30' : 'border-border'} rounded-lg p-4`}>
      <div className="flex items-center gap-1.5">
        <Icon className={`h-3.5 w-3.5 ${accent ? 'text-accent' : 'text-muted-foreground'}`} />
        <p className="text-xs text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-semibold font-mono-data text-foreground mt-1.5">{value}</p>
      <p className="text-[11px] text-muted-foreground mt-1 truncate">{subtext}</p>
    </div>
  );
}

function Voortgangsbalk({
  label, gerealiseerd, doel,
}: { label: string; gerealiseerd: number; doel: number }) {
  const pct = Math.min(100, Math.round((gerealiseerd / doel) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1.5">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-xs font-mono-data text-foreground">
          {formatCurrencyCompact(gerealiseerd)} / {formatCurrencyCompact(doel)}
          <span className="text-muted-foreground ml-2">({pct}%)</span>
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${pct >= 100 ? 'bg-green-500' : 'bg-accent'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
