import { Card, CardContent } from '@/components/ui/card';
import type { ComputedOutputs } from '@/lib/vastgoedrekenen/types';
import { fmtEur, fmtPct, DEAL_BADGE, RISK_BADGE } from './format';

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className={`rounded-md border bg-card p-3 ${accent ? 'border-primary/40' : ''}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`text-base font-semibold mt-1 font-mono-data ${accent ? 'text-primary' : 'text-foreground'}`}>{value}</p>
    </div>
  );
}

export default function DealSnapshot({ o }: { o: ComputedOutputs }) {
  const deal = DEAL_BADGE[o.dealScore];
  const risk = RISK_BADGE[o.riskScore];
  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full border ${deal.cls}`}>{deal.label}</span>
          <span className={`text-xs px-2 py-1 rounded-full border ${risk.cls}`}>{risk.label}</span>
          <span className="text-xs px-2 py-1 rounded-full border bg-muted text-muted-foreground">
            Betrouwbaarheid: {o.inputReliability}
          </span>
          <span className="text-xs px-2 py-1 rounded-full border bg-muted text-muted-foreground">
            Complexiteit: {o.complexityScore.replace('_', ' ')}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          <Stat label="Aankoopprijs" value={fmtEur(o.totalInvestment - o.totalTransferTax - o.totalAcquisitionCosts - o.totalCosts)} />
          <Stat label="Overdrachtsbelasting" value={fmtEur(o.totalTransferTax)} />
          <Stat label="Aankoopkosten" value={fmtEur(o.totalAcquisitionCosts)} />
          <Stat label="Kosten" value={fmtEur(o.totalCosts)} />
          <Stat label="Totale investering" value={fmtEur(o.totalInvestment)} accent />
          <Stat label="Gecorrigeerde jaarhuur" value={fmtEur(o.correctedAnnualRent)} />
          <Stat label="NOI" value={fmtEur(o.noi)} />
          <Stat label="BAR op aankoopprijs" value={fmtPct(o.barPurchasePrice)} />
          <Stat label="BAR op totale investering" value={fmtPct(o.barTotalInvestment)} accent />
          <Stat label="Factor totale investering" value={o.factorTotalInvestment != null ? `${o.factorTotalInvestment.toFixed(2)}×` : '—'} />
          <Stat label="Prijs per m² (GBO)" value={o.pricePerM2Gbo != null ? fmtEur(o.pricePerM2Gbo) : '—'} />
          <Stat label="Max bieding" value={fmtEur(o.maximumBid)} accent />
          <Stat label="Conservatief" value={fmtEur(o.conservativeBid)} />
          <Stat label="Realistisch" value={fmtEur(o.realisticBid)} />
          <Stat label="Agressief" value={fmtEur(o.aggressiveBid)} />
          <Stat label="Verschil met vraagprijs" value={fmtEur(o.differenceWithAskingPrice)} />
        </div>

        <div className="text-sm text-foreground bg-muted/40 rounded-md p-3 leading-relaxed">
          <p className="font-medium mb-1">Conclusie</p>
          <p>{o.conclusion}</p>
          <p className="mt-2 text-muted-foreground">Aanbevolen vervolgstap: <span className="text-foreground">{o.recommendedNextStep}</span></p>
        </div>

        {o.warnings.length > 0 && (
          <div className="text-xs text-amber-700 dark:text-amber-300 space-y-1">
            {o.warnings.map((w, i) => <p key={i}>⚠ {w}</p>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
