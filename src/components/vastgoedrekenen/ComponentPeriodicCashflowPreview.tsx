import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { ComponentPeriodicCashflowResult } from '@/lib/vastgoedrekenen/componentPeriodicCashflow';
import { fmtEur } from './format';

type Props = {
  result: ComponentPeriodicCashflowResult;
  horizonLoading?: boolean;
};

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-2">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-mono-data text-sm font-semibold">{value}</p>
    </div>
  );
}

export default function ComponentPeriodicCashflowPreview({ result, horizonLoading = false }: Props) {
  return (
    <section className="space-y-3 rounded-md border bg-card p-3" aria-label="Periodieke componentkasstroom">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-semibold">Periodieke componentkasstroom</h4>
            <Badge variant={result.readyForPeriodicCashflow ? 'default' : 'outline'}>
              {horizonLoading
                ? 'Horizon laden…'
                : result.readyForPeriodicCashflow
                  ? 'Kasstroom gereed'
                  : 'Geblokkeerd'}
            </Badge>
            {result.readyForPeriodicCashflow && (
              <Badge variant={result.readyForDiscounting ? 'default' : 'outline'}>
                {result.readyForDiscounting
                  ? 'Tijdlijn compleet voor discontering'
                  : 'Terminale waarde nog incompleet'}
              </Badge>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            Maandelijkse componentstroom binnen de Quickscan-horizon. Ontwikkelkosten worden in deze
            funderingsfase lineair pro rata over de vastgelegde ontwikkelperiode verdeeld. Aankoop,
            OVB, algemene projectkosten en financiering zijn nog niet opgenomen.
          </p>
        </div>
        <div className="text-xs text-muted-foreground sm:text-right">
          {result.horizonMonths ? `${result.horizonMonths} maanden` : 'Geen geldige horizon'}
        </div>
      </div>

      {result.readyForPeriodicCashflow && (
        <>
          <div className="grid grid-cols-2 gap-2 lg:grid-cols-6">
            <Tile label="Huurinkomsten" value={fmtEur(result.totals.rentalIncome)} />
            <Tile label="Bruto verkoop" value={fmtEur(result.totals.grossSaleProceeds)} />
            <Tile label="Terminale waarde" value={fmtEur(result.totals.terminalValue)} />
            <Tile label="Ontwikkelkosten" value={fmtEur(result.totals.developmentCosts)} />
            <Tile label="Verkoopkosten" value={fmtEur(result.totals.dispositionCosts)} />
            <Tile label="Netto componentstroom" value={fmtEur(result.totals.netCashflow)} />
          </div>

          <div className="overflow-x-auto rounded-md border">
            <Table className="min-w-[760px] text-xs">
              <TableHeader>
                <TableRow>
                  <TableHead>Periode</TableHead>
                  <TableHead className="text-right">Huur</TableHead>
                  <TableHead className="text-right">Verkoop</TableHead>
                  <TableHead className="text-right">Terminale waarde</TableHead>
                  <TableHead className="text-right">Ontwikkelkosten</TableHead>
                  <TableHead className="text-right">Verkoopkosten</TableHead>
                  <TableHead className="text-right">Netto</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {result.periods.map((period) => (
                  <TableRow key={period.periodIndex}>
                    <TableCell className="font-medium">{period.label}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.rentalIncome)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.grossSaleProceeds)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.terminalValue)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.developmentCosts)}</TableCell>
                    <TableCell className="text-right font-mono-data">{fmtEur(period.dispositionCosts)}</TableCell>
                    <TableCell className="text-right font-mono-data font-semibold">{fmtEur(period.netCashflow)}</TableCell>
                  </TableRow>
                ))}
                {result.periods.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      Binnen de horizon zijn nog geen kasstromen ingepland.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {!horizonLoading && result.blockers.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-medium">Kasstroompreview nog geblokkeerd</p>
          <div className="mt-1 space-y-1">
            {result.blockers.slice(0, 12).map((blocker, index) => (
              <p key={index}>• {blocker}</p>
            ))}
          </div>
        </div>
      )}

      {result.readyForPeriodicCashflow && result.discountingBlockers.length > 0 && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-900 dark:text-amber-200">
          <p className="font-medium">Nog niet volledig voor latere discontering</p>
          <div className="mt-1 space-y-1">
            {result.discountingBlockers.slice(0, 8).map((blocker, index) => (
              <p key={index}>• {blocker}</p>
            ))}
          </div>
        </div>
      )}

      {result.warnings.length > 0 && (
        <details className="rounded-md border p-3 text-xs">
          <summary className="cursor-pointer font-medium">
            Kasstroomaandachtspunten ({result.warnings.length})
          </summary>
          <div className="mt-2 space-y-1 text-muted-foreground">
            {result.warnings.slice(0, 12).map((warning, index) => (
              <p key={index}>• {warning}</p>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
