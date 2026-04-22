// src/components/dashboard/CommissieWidget.tsx
// Dashboard widget: successen + commissie-stats.
//
// Toont:
// - Gerealiseerde commissie YTD (big number + bar tegen jaardoel)
// - Gewogen pipeline (verwachte commissie uit actieve deals)
// - Aantal afgeronde deals + gemiddelde commissie
// - Recente successen: laatste 3 afgeronde deals
// - Dealwaarde YTD vs doel

import { Link } from 'react-router-dom';
import { useDataStore } from '@/hooks/useDataStore';
import {
  berekenCommissieStats,
  getRecenteSuccessen,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  DEAL_FASE_LABELS,
} from '@/data/mock-data';
import { Trophy, TrendingUp, Target, Award, ArrowRight } from 'lucide-react';

export default function CommissieWidget() {
  const store = useDataStore();
  const huidigJaar = new Date().getFullYear();
  const jaarDoel = store.getJaarDoel(huidigJaar);

  const stats = berekenCommissieStats(
    store.deals,
    (objectId) => store.getObjectById(objectId)?.vraagprijs,
    huidigJaar,
  );

  const commissiePct = jaarDoel?.commissieDoelBedrag
    ? Math.min(100, Math.round((stats.gerealiseerdBedrag / jaarDoel.commissieDoelBedrag) * 100))
    : undefined;

  const dealwaardePct = jaarDoel?.dealwaardeDoelBedrag
    ? Math.min(100, Math.round((stats.dealwaardeGerealiseerd / jaarDoel.dealwaardeDoelBedrag) * 100))
    : undefined;

  const recenteSuccessen = getRecenteSuccessen(store.deals, 3);

  const gemiddeldeCommissie = stats.gerealiseerdAantalDeals > 0
    ? stats.gerealiseerdBedrag / stats.gerealiseerdAantalDeals
    : 0;

  return (
    <section className="section-card">
      <header className="section-header">
        <h2 className="section-title flex items-center gap-2">
          <Trophy className="h-4 w-4 text-accent" />
          Successen & commissie {huidigJaar}
        </h2>
        <Link to="/rapportage" className="section-link inline-flex items-center gap-1">
          Volledige rapportage <ArrowRight className="h-3 w-3" />
        </Link>
      </header>

      <div className="p-5 space-y-5">
        {/* Top: gerealiseerd + pipeline */}
        <div className="grid sm:grid-cols-2 gap-4">
          {/* Gerealiseerd */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Award className="h-4 w-4 text-green-600" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Gerealiseerde commissie
              </span>
            </div>
            <p className="text-3xl font-semibold font-mono-data text-foreground">
              <span className="sm:hidden">{formatCurrencyCompact(stats.gerealiseerdBedrag)}</span>
              <span className="hidden sm:inline">{formatCurrency(stats.gerealiseerdBedrag)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.gerealiseerdAantalDeals} afgeronde deal{stats.gerealiseerdAantalDeals === 1 ? '' : 's'}
              {stats.gerealiseerdAantalDeals > 0 && ` · gem. ${formatCurrencyCompact(gemiddeldeCommissie)}`}
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

          {/* Pipeline */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-accent" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Pipeline (gewogen)
              </span>
            </div>
            <p className="text-3xl font-semibold font-mono-data text-foreground">
              <span className="sm:hidden">{formatCurrencyCompact(stats.pipelineBedragGewogen)}</span>
              <span className="hidden sm:inline">{formatCurrency(stats.pipelineBedragGewogen)}</span>
            </p>
            <p className="text-xs text-muted-foreground">
              {stats.pipelineAantalDeals} actieve deal{stats.pipelineAantalDeals === 1 ? '' : 's'} ·
              potentieel {formatCurrencyCompact(stats.pipelineBedragTotaal)}
            </p>
            <p className="text-[11px] text-muted-foreground italic">
              Gewogen naar kans per fase
            </p>
          </div>
        </div>

        {/* Dealwaarde doel */}
        {jaarDoel?.dealwaardeDoelBedrag && (
          <div className="pt-4 border-t border-border/60">
            <div className="flex items-center gap-2 mb-1.5">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                Dealwaarde YTD
              </span>
              <span className="text-xs font-mono-data text-foreground ml-auto">
                {formatCurrencyCompact(stats.dealwaardeGerealiseerd)} / {formatCurrencyCompact(jaarDoel.dealwaardeDoelBedrag)}
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

        {/* Recente successen */}
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
                        {rel?.bedrijfsnaam ?? 'Onbekende relatie'}
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

        {/* Geen doel geconfigureerd */}
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
