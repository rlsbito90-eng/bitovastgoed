import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import type { ComputedOutputs, Scenario } from '@/lib/vastgoedrekenen/types';
import { fmtEur } from './format';

function Row({ label, pct, eur, bold }: { label: string; pct?: number; eur: number; bold?: boolean }) {
  return (
    <tr className={bold ? 'font-semibold border-t' : ''}>
      <td className="py-1.5">{label}</td>
      <td className="py-1.5 text-right text-muted-foreground text-xs">{pct != null ? `${pct.toFixed(1)}%` : ''}</td>
      <td className="py-1.5 text-right font-mono-data">{fmtEur(eur)}</td>
    </tr>
  );
}

export default function NoiOpbouw({ scenario, o }: { scenario: Scenario; o: ComputedOutputs }) {
  // Bereken effectieve percentages t.o.v. correctedAnnualRent
  const base = o.correctedAnnualRent || 1;
  const vacPct = (o.vacancyCorrectionEur / base) * 100;
  const opPct = (o.operatingCostsEur / base) * 100;
  const mPct = (o.maintenanceCostsEur / base) * 100;
  const mgmtPct = (o.managementCostsEur / base) * 100;
  const othPct = (o.otherCostsEur / base) * 100;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Bruto huur → NOI</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <Row label="Gecorrigeerde bruto jaarhuur" eur={o.correctedAnnualRent} />
            <Row label="− Leegstandscorrectie" pct={vacPct} eur={-o.vacancyCorrectionEur} />
            <Row label="− Exploitatiekosten" pct={opPct} eur={-o.operatingCostsEur} />
            <Row label="− Onderhoudsreserve" pct={mPct} eur={-o.maintenanceCostsEur} />
            <Row label="− Beheerkosten" pct={mgmtPct} eur={-o.managementCostsEur} />
            <Row label="− Overige jaarlijkse kosten" pct={othPct} eur={-o.otherCostsEur} />
            <Row label="= NOI" pct={o.noiMargin ?? undefined} eur={o.noi} bold />
          </tbody>
        </table>
        <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
          <div className="rounded border p-2"><p className="text-muted-foreground">Totale correctie</p><p className="font-mono-data">{o.totalCorrectionPct.toFixed(1)}%</p></div>
          <div className="rounded border p-2"><p className="text-muted-foreground">NOI-marge</p><p className="font-mono-data">{o.noiMargin != null ? `${o.noiMargin.toFixed(1)}%` : '—'}</p></div>
          <div className="rounded border p-2"><p className="text-muted-foreground">BAR op TI</p><p className="font-mono-data">{o.barTotalInvestment != null ? `${o.barTotalInvestment.toFixed(2)}%` : '—'}</p></div>
          <div className="rounded border p-2"><p className="text-muted-foreground">NAR op TI</p><p className="font-mono-data">{o.narTotalInvestment != null ? `${o.narTotalInvestment.toFixed(2)}%` : '—'}</p></div>
        </div>
        {scenario.assumption_profile && scenario.assumption_profile !== 'handmatig' && (
          <p className="mt-3 text-xs text-muted-foreground">
            Percentages komen uit het gekozen aannameprofiel. Wijzig het profiel om alle correcties in één keer aan te passen.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
