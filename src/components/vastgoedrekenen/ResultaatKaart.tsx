import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import type { Scenario, ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtPct, fmtEurPerM2, DEAL_BADGE, RISK_BADGE } from './format';

/**
 * Compacte resultaat- en biedingsadvies-kaart bovenaan ieder scenario.
 * Toont het belangrijkste in één oogopslag — variant per scenario-type.
 */
function ResultaatKaart({ o, s, compact = false }: { o: ComputedOutputs; s: Scenario; compact?: boolean }) {
  const deal = DEAL_BADGE[o.dealScore];
  const risk = RISK_BADGE[o.riskScore];
  const asking = Number(s.asking_price ?? 0);
  const strategyLeading = o.leadingMaxBasis === 'strategie';
  const verkoopLeading = o.leadingMaxBasis === 'verkoop';
  // Headline volgt ALTIJD de leidende waarde — geen stille fallback naar maximumBid.
  const headlineValue = o.leadingMaxValue;
  const headlineLabel = strategyLeading
    ? 'Maximale aankoopprijs (componentstrategie)'
    : verkoopLeading
      ? 'Maximale bieding (verkoop / exit)'
      : 'Maximale bieding (huur / BAR)';
  const diff = o.leadingDifferenceWithAskingPrice;
  const pct = asking > 0 ? (diff / asking) * 100 : null;
  const diffPos = diff >= 0;
  const diffSign = diffPos ? '+' : '−';
  const diffCls = diffPos
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-amber-700 dark:text-amber-300';
  const exploitatie = o.assessmentType === 'exploitatie';
  const rounds = o.leadingRoundsAtAsking;
  // Tegenstrijdig signaal: leidende waarde geeft ander signaal (ja/nee) dan algemene max bieding.
  const generalDiff = o.differenceWithAskingPrice;
  const showConflict =
    !verkoopLeading &&
    asking > 0 &&
    Math.round(o.leadingMaxValue) !== Math.round(o.maximumBid) &&
    (diff < 0) !== (generalDiff < 0);


  return (
    <Card className="border-primary/40">
      <CardContent className="p-4 space-y-4">
        {/* Prominente leidende uitkomst-balk — verborgen in compact-modus (cockpit toont dit al) */}
        {!compact && asking > 0 && (
          <div
            className={`rounded-md border-2 p-3 ${
              rounds
                ? 'border-emerald-500/60 bg-emerald-500/10'
                : 'border-amber-500/60 bg-amber-500/10'
            }`}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                Rond te rekenen
              </span>
              <span
                className={`text-xl font-bold ${
                  rounds
                    ? 'text-emerald-700 dark:text-emerald-300'
                    : 'text-amber-700 dark:text-amber-300'
                }`}
              >
                {rounds ? 'Ja' : 'Nee'}
              </span>
              <span className="text-[11px] text-muted-foreground">
                · Gebaseerd op: <span className="text-foreground font-medium">{o.leadingMaxBasisLabel}</span>
              </span>
            </div>
            <p className="text-xs mt-1.5 leading-snug text-foreground/90">
              {rounds
                ? <>Ruimte boven vraagprijs: <span className="font-mono-data font-medium">{fmtEur(Math.abs(diff))}</span>{pct != null ? ` (${Math.abs(pct).toFixed(1)}%)` : ''}. De maximale {strategyLeading ? 'aankoopprijs' : 'bieding'} op basis van {o.leadingMaxBasisLabel} ligt boven de vraagprijs.</>
                : <>Tekort t.o.v. vraagprijs: <span className="font-mono-data font-medium">{fmtEur(Math.abs(diff))}</span>{pct != null ? ` (${Math.abs(pct).toFixed(1)}%)` : ''}. De maximale {strategyLeading ? 'aankoopprijs' : 'bieding'} op basis van {o.leadingMaxBasisLabel} ligt onder de vraagprijs.</>
              }
            </p>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full border ${deal.cls}`}>{o.scoreLabel}</span>
          <span className={`text-xs px-2 py-1 rounded-full border ${risk.cls}`}>{risk.label}</span>
          <span className={`text-xs px-2 py-1 rounded-full border ${
            o.inputReliability === 'hoog'
              ? 'bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-200'
              : o.inputReliability === 'middel'
                ? 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200'
                : 'bg-orange-100 text-orange-900 border-orange-300 dark:bg-orange-900/30 dark:text-orange-200'
          }`}>
            Input {o.inputReliability}
          </span>
          <span className="text-xs px-2 py-1 rounded-full border bg-primary/10 text-primary border-primary/30">
            Leidend: {o.leadingMaxBasisLabel}
          </span>
          {!strategyLeading && (
            <span className="text-xs px-2 py-1 rounded-full border bg-muted text-muted-foreground">
              Bod o.b.v. {o.bidBasisUsed === 'verkoop' ? 'verkoop / exit' : 'huur / BAR'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 min-w-0">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 sm:col-span-2 lg:col-span-2 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{headlineLabel}</p>
            <p className="text-2xl sm:text-3xl font-semibold font-mono-data mt-0.5 leading-tight text-primary break-words">
              {fmtEur(headlineValue)}
            </p>
            {asking > 0 && (
              <p className="text-xs text-muted-foreground mt-2 leading-relaxed break-words">
                Vraagprijs <span className="font-mono-data text-foreground">{fmtEur(asking)}</span> ·{' '}
                Verschil{' '}
                <span className={`font-mono-data ${diffCls}`}>
                  {diffSign} {fmtEur(Math.abs(diff))}
                  {pct != null ? ` (${diffSign}${Math.abs(pct).toFixed(1)}%)` : ''}
                </span>
              </p>
            )}
            {!verkoopLeading && Math.round(o.maximumBid) !== Math.round(headlineValue) && (
              <p className="text-[11px] text-muted-foreground mt-1 leading-snug break-words">
                Informatief — algemene max bieding ({o.bidBasisUsed === 'verkoop' ? 'verkoop/exit' : 'huur/BAR'}):{' '}
                <span className="font-mono-data text-foreground">{fmtEur(o.maximumBid)}</span>
                {asking > 0 && (
                  <>
                    {' '}· Verschil{' '}
                    <span className="font-mono-data">
                      {generalDiff >= 0 ? '+' : '−'} {fmtEur(Math.abs(generalDiff))}
                    </span>
                  </>
                )}
              </p>
            )}
          </div>

          <div className="rounded-md border p-3 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Totale investering</p>
            <p className="text-base font-semibold font-mono-data mt-0.5 break-words">{fmtEur(o.totalInvestment)}</p>
          </div>
          {exploitatie ? (
            <>
              <div className="rounded-md border p-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">NOI</p>
                <p className="text-base font-semibold font-mono-data mt-0.5 break-words">{fmtEur(o.noi)}</p>
              </div>
              <div className="rounded-md border p-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">BAR TI · Factor</p>
                <p className="text-base font-semibold font-mono-data mt-0.5 break-words">
                  {fmtPct(o.barTotalInvestment)}
                  {o.factorTotalInvestment != null ? ` · ${o.factorTotalInvestment.toFixed(2)}×` : ''}
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="rounded-md border p-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Netto verkoopopbrengst</p>
                <p className="text-base font-semibold font-mono-data mt-0.5 break-words">
                  {o.netSaleProceeds != null ? fmtEur(o.netSaleProceeds) : '—'}
                </p>
              </div>
              <div className="rounded-md border p-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Nettomarge</p>
                <p
                  className={`text-base font-semibold font-mono-data mt-0.5 break-words ${
                    o.netMargin != null && o.netMargin < 0 ? 'text-destructive' : ''
                  }`}
                >
                  {o.netMargin != null ? fmtEur(o.netMargin) : '—'}
                </p>
              </div>
              <div className="rounded-md border p-3 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">ROI</p>
                <p
                  className={`text-base font-semibold font-mono-data mt-0.5 ${
                    o.roi != null && o.roi < 0 ? 'text-destructive' : ''
                  }`}
                >
                  {o.roi != null ? `${o.roi.toFixed(1)}%` : '—'}
                </p>
              </div>
            </>
          )}
        </div>

        {/* €/m² subregel — alleen tonen wanneer er minstens één KPI beschikbaar is */}
        {(() => {
          const items: Array<{ label: string; value: string }> = [];
          if (o.purchasePricePerM2 != null) items.push({ label: 'Aankoop /m²', value: fmtEurPerM2(o.purchasePricePerM2) });
          if (o.totalInvestmentPerM2 != null) items.push({ label: 'Investering /m²', value: fmtEurPerM2(o.totalInvestmentPerM2) });
          if (o.maximumBidPerM2 != null) items.push({ label: 'Max bod /m²', value: fmtEurPerM2(o.maximumBidPerM2) });
          if (!exploitatie) {
            if (o.salePricePerM2 != null) items.push({ label: 'Verkoop /m²', value: fmtEurPerM2(o.salePricePerM2) });
            if (o.netSaleProceedsPerM2 != null) items.push({ label: 'Netto verkoop /m²', value: fmtEurPerM2(o.netSaleProceedsPerM2) });
            if (o.netMarginPerM2 != null) items.push({ label: 'Marge /m²', value: fmtEurPerM2(o.netMarginPerM2) });
            if (o.totalCostsPerM2 != null) items.push({ label: 'Bouwkosten /m²', value: fmtEurPerM2(o.totalCostsPerM2) });
          } else {
            if (o.annualRentPerM2 != null) items.push({ label: 'Jaarhuur /m²', value: fmtEurPerM2(o.annualRentPerM2) });
            if (o.noiPerM2 != null) items.push({ label: 'NOI /m²', value: fmtEurPerM2(o.noiPerM2) });
          }
          if (items.length === 0) return null;
          return (
            <div className="rounded-md border border-dashed bg-muted/20 p-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              {items.map((it) => (
                <span key={it.label} className="whitespace-nowrap">
                  <span className="text-muted-foreground">{it.label}: </span>
                  <span className="font-mono-data font-medium">{it.value}</span>
                </span>
              ))}
            </div>
          );
        })()}

        {showConflict && (
          <div className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
            <p className="font-medium mb-1">Let op: signalen zijn tegenstrijdig</p>
            <p>
              Het leidende spoor ({o.leadingMaxBasisLabel}) geeft{' '}
              <span className="font-mono-data">{fmtEur(headlineValue)}</span> en{' '}
              {diff >= 0 ? 'rekent rond' : 'rekent niet rond'} bij de vraagprijs, terwijl de
              algemene max bieding (
              <span className="font-mono-data">{fmtEur(o.maximumBid)}</span>) het
              tegenovergestelde signaal geeft. Voor "rond te rekenen" telt het leidende spoor.
            </p>
          </div>
        )}


        <div className="text-sm text-foreground bg-muted/40 rounded-md p-3 leading-relaxed">
          <p className="font-medium mb-1">Conclusie</p>
          <p>{o.conclusion}</p>
          {(o.dealScore === 'A' || o.dealScore === 'B') && o.riskScore === 'hoog' && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
              Let op: kansrijk op basis van marge en ROI, maar risicovol omdat bouwkosten en/of verkoopwaarde nog indicatief zijn.
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Vervolgstap: <span className="text-foreground">{o.recommendedNextStep}</span>
          </p>
        </div>

        {o.scoreAttentionPoints.length > 0 && (
          <div className="rounded-md border border-amber-500/40 bg-amber-500/5 p-3 text-xs">
            <p className="font-medium text-amber-900 dark:text-amber-200 mb-1">Belangrijkste aandachtspunten</p>
            <ul className="space-y-1 text-amber-900/90 dark:text-amber-200/90">
              {o.scoreAttentionPoints.slice(0, 4).map((p, i) => (
                <li key={i}>• {p}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


export default memo(ResultaatKaart);
