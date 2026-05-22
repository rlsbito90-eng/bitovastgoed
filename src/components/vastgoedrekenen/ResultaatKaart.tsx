import { Card, CardContent } from '@/components/ui/card';
import type { Scenario, ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtPct, DEAL_BADGE, RISK_BADGE } from './format';

/**
 * Compacte resultaat- en biedingsadvies-kaart bovenaan ieder scenario.
 * Toont het belangrijkste in één oogopslag — variant per scenario-type.
 */
export default function ResultaatKaart({ o, s }: { o: ComputedOutputs; s: Scenario }) {
  const deal = DEAL_BADGE[o.dealScore];
  const risk = RISK_BADGE[o.riskScore];
  const asking = Number(s.asking_price ?? 0);
  const diff = o.differenceWithAskingPrice;
  const pct = asking > 0 ? (diff / asking) * 100 : null;
  const diffPos = diff >= 0;
  const diffSign = diffPos ? '+' : '−';
  const diffCls = diffPos
    ? 'text-emerald-700 dark:text-emerald-300'
    : 'text-amber-700 dark:text-amber-300';
  const exploitatie = o.assessmentType === 'exploitatie';

  return (
    <Card className="border-primary/40">
      <CardContent className="p-4 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full border ${deal.cls}`}>{o.scoreLabel}</span>
          <span className={`text-xs px-2 py-1 rounded-full border ${risk.cls}`}>{risk.label}</span>
          <span className="text-xs px-2 py-1 rounded-full border bg-muted text-muted-foreground">
            Bod o.b.v. {o.bidBasisUsed === 'verkoop' ? 'verkoop / exit' : 'huur / BAR'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 min-w-0">
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 sm:col-span-2 lg:col-span-2 min-w-0">
            <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Maximale bieding</p>
            <p className="text-2xl sm:text-3xl font-semibold font-mono-data mt-0.5 leading-tight text-primary break-words">
              {fmtEur(o.maximumBid)}
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
