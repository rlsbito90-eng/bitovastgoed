// src/components/dashboard/CommissieWidget.tsx
// Dashboard widget: objectvoorraad + successen + commissie-stats.
//
// Objecten zijn de primaire commerciële laag. Fee-rapportage gebruikt één
// canonieke bron per object: Objectforecast vóór Deal, Deal fee zodra een
// concrete transactie bestaat, gerealiseerde Deal fee na closing.

import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import { useUnifiedFeeReporting } from '@/hooks/useUnifiedFeeReporting';
import { getRelationDisplayName } from '@/lib/relatieNaam';
import {
  berekenCommissieStats,
  getRecenteSuccessen,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
} from '@/data/mock-data';
import {
  Trophy, TrendingUp, Target, Award, ArrowRight, Building2,
  CircleCheck, PauseCircle, KeyRound, Users,
} from 'lucide-react';

export default function CommissieWidget() {
  const store = useDataStore();
  const huidigJaar = new Date().getFullYear();
  const jaarDoel = store.getJaarDoel(huidigJaar);
  const unifiedFees = useUnifiedFeeReporting();

  const actieveObjecten = store.objecten.filter(o => !o.isArchived);
  const beschikbareObjecten = actieveObjecten.filter(o => o.status === 'beschikbaar');
  const onHoldObjecten = actieveObjecten.filter(o => o.status === 'on_hold');
  const onderOptieObjecten = actieveObjecten.filter(o => o.status === 'onder_optie');
  const objectenMetKandidaten = actieveObjecten.filter(o =>
    store.pipelineKandidaten.some(k => k.objectId === o.id),
  );
  const aanbodvolume = actieveObjecten.reduce((som, o) => som + (o.vraagprijs ?? 0), 0);
  const objectenMetVraagprijs = actieveObjecten.filter(o => (o.vraagprijs ?? 0) > 0).length;

  // Legacy helper blijft voorlopig alleen voor gerealiseerde dealwaarde/YTD en
  // recente successen. Fee-bedragen komen uitsluitend uit object_fee_reporting.
  const legacyStats = berekenCommissieStats(
    store.deals,
    (objectId) => store.getObjectById(objectId)?.vraagprijs,
    huidigJaar,
  );

  const gerealiseerdeFee = unifiedFees.error
    ? legacyStats.gerealiseerdBedrag
    : unifiedFees.stats.gerealiseerdBedrag;
  const pipelineFee = unifiedFees.error
    ? legacyStats.pipelineBedragTotaal
    : unifiedFees.stats.pipelineBedrag;
  const gerealiseerdAantal = unifiedFees.error
    ? legacyStats.gerealiseerdAantalDeals
    : unifiedFees.stats.gerealiseerdAantal;

  const commissiePct = jaarDoel?.commissieDoelBedrag
    ? Math.min(100, Math.round((gerealiseerdeFee / jaarDoel.commissieDoelBedrag) * 100))
    : undefined;

  const dealwaardePct = jaarDoel?.dealwaardeDoelBedrag
    ? Math.min(100, Math.round((legacyStats.dealwaardeGerealiseerd / jaarDoel.dealwaardeDoelBedrag) * 100))
    : undefined;

  const recenteSuccessen = getRecenteSuccessen(store.deals, 3);

  const gemiddeldeCommissie = gerealiseerdAantal > 0
    ? gerealiseerdeFee / gerealiseerdAantal
    : 0;

  return (
    <section className="section-card">
      <header className="section-header">
        <h2 className="section-title flex items-center gap-2">
          <Building2 className="h-4 w-4 text-accent" />
          Objecten & resultaten
        </h2>
        <Link to="/objecten" className="section-link inline-flex items-center gap-1">
          Alle objecten <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="p-5 space-y-5">
        {/* Object-KPI's — primaire commerciële voorraad */}
        <div>
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Actieve objectvoorraad
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Objecten zijn de hoofdlaag; Deals ontstaan pas bij een concrete transactiepositie.
              </p>
            </div>
            <Link to="/pipeline" className="text-xs text-accent hover:underline shrink-0">
              Dealflow bekijken
            </Link>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
            <ObjectKpi
              label="Actieve objecten"
              value={String(actieveObjecten.length)}
              hint={`${objectenMetVraagprijs} met vraagprijs`}
              icon={Building2}
            />
            <ObjectKpi
              label="Beschikbaar"
              value={String(beschikbareObjecten.length)}
              hint="Direct in de markt"
              icon={CircleCheck}
            />
            <ObjectKpi
              label="On hold"
              value={String(onHoldObjecten.length)}
              hint="Tijdelijk gepauzeerd"
              icon={PauseCircle}
            />
            <ObjectKpi
              label="Onder optie"
              value={String(onderOptieObjecten.length)}
              hint="Beschikbaarheid beperkt"
              icon={KeyRound}
            />
            <ObjectKpi
              label="Met kandidaten"
              value={String(objectenMetKandidaten.length)}
              hint={`${Math.max(0, actieveObjecten.length - objectenMetKandidaten.length)} zonder actieve kandidaat`}
              icon={Users}
            />
          </div>

          <div className="mt-3 rounded-lg border border-border/60 bg-muted/20 px-3.5 py-3 flex items-center justify-between gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground font-semibold">Actief aanbodvolume</p>
              <p className="text-xs text-muted-foreground mt-0.5">Som van bekende vraagprijzen op niet-gearchiveerde objecten</p>
            </div>
            <p className="text-xl sm:text-2xl font-semibold font-mono-data text-foreground whitespace-nowrap">
              {formatCurrencyCompact(aanbodvolume)}
            </p>
          </div>
        </div>

        <div className="pt-4 border-t border-border/60">
          <div className="flex items-center justify-between gap-3 mb-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-accent" />
              Successen & commissie {huidigJaar}
            </p>
            <Link to="/rapportage" className="text-xs text-accent hover:underline">
              Volledige rapportage
            </Link>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-green-600" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Gerealiseerde commissie
                </span>
              </div>
              <p className="text-3xl font-semibold font-mono-data text-foreground">
                <span className="sm:hidden">{formatCurrencyCompact(gerealiseerdeFee)}</span>
                <span className="hidden sm:inline">{formatCurrency(gerealiseerdeFee)}</span>
              </p>
              <p className="text-xs text-muted-foreground">
                {gerealiseerdAantal} afgeronde deal{gerealiseerdAantal === 1 ? '' : 's'}
                {gerealiseerdAantal > 0 && ` · gem. ${formatCurrencyCompact(gemiddeldeCommissie)}`}
              </p>
              {commissiePct !== undefined && jaarDoel?.commissieDoelBedrag && (
                <div className="pt-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[11px] text-muted-foreground">
                      Doel: {formatCurrencyCompact(jaarDoel.commissieDoelBedrag)}
                    </span>
                    <span className="text-xs font-semibold font-mono-data text-foreground">
                      {commissiePct}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                    <div
                      className={`h-full transition-all ${commissiePct >= 100 ? 'bg-green-500' : 'bg-accent'}`}
                      style={{ width: `${commissiePct}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-accent" />
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Fee pipeline
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-semibold font-mono-data text-foreground whitespace-nowrap">
                {formatCurrency(pipelineFee)}
              </p>
              <p className="text-xs text-muted-foreground">
                {unifiedFees.error
                  ? `${legacyStats.pipelineAantalDeals} legacy Deals`
                  : `${unifiedFees.stats.objectForecastAantal} Objectprognoses · ${unifiedFees.stats.dealForecastAantal} concrete Deals`}
              </p>
              <p className="text-[11px] text-muted-foreground italic">
                Eén economische fee per object: Deal fee vervangt Objectforecast; closing verschuift dezelfde fee naar gerealiseerd.
              </p>
            </div>
          </div>

          {unifiedFees.error && (
            <p className="mt-3 text-[11px] text-warning">
              Nieuwe feeprojectie nog niet beschikbaar; dashboard gebruikt tijdelijk de bestaande Deal-rapportage totdat de migratie actief is.
            </p>
          )}
        </div>

        {jaarDoel?.dealwaardeDoelBedrag && (
          <div className="pt-4 border-t border-border/60">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Dealwaarde YTD
              </span>
              <span className="text-xs font-mono-data text-foreground ml-auto whitespace-nowrap">
                {formatCurrency(legacyStats.dealwaardeGerealiseerd)} / {formatCurrency(jaarDoel.dealwaardeDoelBedrag)}
              </span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className={`h-full transition-all ${(dealwaardePct ?? 0) >= 100 ? 'bg-green-500' : 'bg-accent'}`}
                style={{ width: `${dealwaardePct ?? 0}%` }}
              />
            </div>
          </div>
        )}

        {recenteSuccessen.length > 0 && (
          <div className="pt-4 border-t border-border/60">
            <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Recent afgerond
            </p>
            <div className="space-y-2">
              {recenteSuccessen.map(deal => {
                const obj = store.getObjectById(deal.objectId);
                const rel = store.getRelatieById(deal.relatieId);
                return (
                  <Link
                    key={deal.id}
                    to={`/deals/${deal.id}`}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-md hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground truncate">
                        {obj?.titel ?? 'Onbekend object'}
                      </p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {getRelationDisplayName(rel, store.contactpersonen)}
                        {deal.verwachteClosingdatum && ` · ${formatDate(deal.verwachteClosingdatum)}`}
                      </p>
                    </div>
                    {deal.commissieBedrag != null && (
                      <span className="text-sm font-semibold font-mono-data text-green-600 shrink-0">
                        +{formatCurrencyCompact(deal.commissieBedrag)}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        )}

        {!jaarDoel && (
          <div className="pt-4 border-t border-border/60">
            <p className="text-xs text-muted-foreground">
              Stel een jaardoel in via <Link to="/admin" className="underline hover:text-foreground">Admin</Link> om voortgang te zien ten opzichte van je commissie- en dealwaarde-doelen.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function ObjectKpi({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-card/60 p-3 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[9.5px] font-semibold uppercase tracking-[0.11em] text-muted-foreground truncate">{label}</p>
        <Icon className="h-3.5 w-3.5 text-accent shrink-0" />
      </div>
      <p className="mt-1.5 text-xl font-semibold font-mono-data text-foreground leading-none">{value}</p>
      <p className="mt-1.5 text-[10px] text-muted-foreground truncate" title={hint}>{hint}</p>
    </div>
  );
}
