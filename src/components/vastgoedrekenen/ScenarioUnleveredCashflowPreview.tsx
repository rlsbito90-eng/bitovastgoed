import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ScenarioUnleveredCashflowResult } from '@/lib/vastgoedrekenen/scenarioUnleveredCashflow';
import { fmtEur } from './format';

type Props = {
  result: ScenarioUnleveredCashflowResult;
  loading?: boolean;
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono-data text-sm font-semibold">{value}</p>
    </div>
  );
}

export default function ScenarioUnleveredCashflowPreview({ result, loading = false }: Props) {
  let cumulative = 0;
  return (
    <section className="space-y-3 rounded-md border bg-card p-3" aria-label="Ongefinancierde scenariokasstroom">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">Ongefinancierde scenariokasstroom</h4>
            <Badge variant={result.readyForPeriodicCashflow ? 'default' : 'outline'}>
              {loading ? 'Gegevens laden…' : result.readyForPeriodicCashflow ? 'Projecttijdlijn gereed' : 'Geblokkeerd'}
            </Badge>
            {result.readyForPeriodicCashflow && (
              <Badge variant={result.readyForDiscounting ? 'default' : 'outline'}>
                {result.readyForDiscounting ? 'Compleet voor DCF-fase' : 'Terminale tijdlijn incompleet'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Combineert de opgeslagen aankoop, OVB, aankoopkosten, algemene projectkosten en de
            componentkasstroom. Financieringsopnames, rente en aflossing zijn bewust uitgesloten.
          </p>
        </div>
        <div className="text-xs text-muted-foreground sm:text-right">
          {result.horizonMonths ? `${result.horizonMonths} maanden` : 'Geen geldige horizon'}
        </div>
      </div>

      {result.readyForPeriodicCashflow && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Tile
              label="Aankoop + OVB + kosten"
              value={fmtEur(result.totals.purchasePrice + result.totals.transferTax + result.totals.acquisitionCosts)}
            />
            <Tile label="Algemene projectkosten" value={fmtEur(result.totals.sharedScenarioCosts)} />
            <Tile label="Componentontwikkeling" value={fmtEur(result.totals.componentDevelopmentCosts)} />
            <Tile label="Huurinkomsten" value={fmtEur(result.totals.rentalIncome)} />
            <Tile
              label="Verkoop + terminale waarde"
              value={fmtEur(result.totals.grossSaleProceeds + result.totals.terminalValue)}
            />
            <Tile label="Nominaal projectresultaat" value={fmtEur(result.totals.netCashflow)} />
          </div>

          {result.reconciliation && (
            <div className={`rounded-md border px-3 py-2 text-xs ${
              result.reconciliation.reconciled === true
                ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200'
                : 'border-amber-500/30 bg-amber-500/5 text-amber-900 dark:text-amber-200'
            }`}>
              <p className="font-medium">
                Aansluiting investering: {result.reconciliation.reconciled === true
                  ? 'sluit aan'
                  : result.reconciliation.reconciled === false
                    ? 'verschil gevonden'
                    : 'nog niet controleerbaar'}
              </p>
              <p className="mt-1">
                Tijdlijn: {fmtEur(result.reconciliation.expectedUnleveredInvestment)}
                {' · '}bestaande totale investering excl. financieringskosten:{' '}
                {result.reconciliation.reportedUnleveredInvestment == null
                  ? '—'
                  : fmtEur(result.reconciliation.reportedUnleveredInvestment)}
                {result.reconciliation.difference != null
                  ? ` · verschil ${fmtEur(result.reconciliation.difference)}`
                  : ''}
              </p>
            </div>
          )}

          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[1100px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Aankoop/OVB/acq.</TableHead>
                  <TableHead className="text-right">Huur</TableHead>
                  <TableHead className="text-right">Verkoop/terminal</TableHead>
                  <TableHead className="text-right">Componentontwikkeling</TableHead>
                  <TableHead className="text-right">Algemene kosten</TableHead>
                  <TableHead className="text-right">Verkoopkosten</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                  <TableHead className="text-right">Cumulatief</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.periods.map((period) => {
                  cumulative += period.netCashflow;
                  return (
                    <TableRow key={period.periodIndex}>
                      <TableCell className="font-medium">{period.label}</TableCell>
                      <TableCell className="text-right font-mono-data">
                        {fmtEur(period.purchasePrice + period.transferTax + period.acquisitionCosts)}
                      </TableCell>
                      <TableCell className="text-right font-mono-data">{fmtEur(period.rentalIncome)}</TableCell>
                      <TableCell className="text-right font-mono-data">
                        {fmtEur(period.grossSaleProceeds + period.terminalValue)}
                      </TableCell>
                      <TableCell className="text-right font-mono-data">{fmtEur(period.componentDevelopmentCosts)}</TableCell>
                      <TableCell className="text-right font-mono-data">{fmtEur(period.sharedScenarioCosts)}</TableCell>
                      <TableCell className="text-right font-mono-data">{fmtEur(period.dispositionCosts)}</TableCell>
                      <TableCell className="text-right font-mono-data font-semibold">{fmtEur(period.netCashflow)}</TableCell>
                      <TableCell className="text-right font-mono-data font-semibold">{fmtEur(cumulative)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!loading && result.blockers.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-medium">Scenariokasstroom nog geblokkeerd</p>
          <div className="mt-1 space-y-1">
            {result.blockers.slice(0, 14).map((blocker, index) => <p key={index}>• {blocker}</p>)}
          </div>
        </div>
      )}

      {result.readyForPeriodicCashflow && result.discountingBlockers.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-medium">Nog niet volledig voor DCF/NCW</p>
          <div className="mt-1 space-y-1">
            {result.discountingBlockers.slice(0, 10).map((blocker, index) => <p key={index}>• {blocker}</p>)}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <details className="rounded-md border p-3 text-xs">
          <summary className="cursor-pointer font-medium">Aandachtspunten ({result.warnings.length})</summary>
          <div className="mt-2 space-y-1 text-muted-foreground">
            {result.warnings.slice(0, 14).map((warning, index) => <p key={index}>• {warning}</p>)}
          </div>
        </details>
      )}

      <p className="text-[11px] text-muted-foreground">
        Het nominale projectresultaat is nog niet verdisconteerd. Dit is geen NCW, IRR of rendement op eigen vermogen.
      </p>
    </section>
  );
}
