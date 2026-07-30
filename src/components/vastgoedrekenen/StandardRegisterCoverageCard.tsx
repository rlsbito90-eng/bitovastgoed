import { AlertTriangle, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useKengetallenregister } from '@/hooks/useKengetallenregister';
import { assessStandardRegisterCoverage } from '@/lib/vastgoedrekenen/standardRegister';

export default function StandardRegisterCoverageCard() {
  const { entries, loading } = useKengetallenregister();
  const coverage = assessStandardRegisterCoverage(entries);
  const attentionCount = coverage.missingCodes.length + coverage.inactive + coverage.expired;

  return (
    <Card className={coverage.complete ? 'border-emerald-500/25' : 'border-amber-500/30'}>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-sm">
              {coverage.complete
                ? <ShieldCheck className="h-4 w-4 text-emerald-600" />
                : <AlertTriangle className="h-4 w-4 text-amber-600" />}
              Standaardpakket quickscan V1
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              Interne werkhypothesen voor 7 assetgroepen × 4 exploitatievelden. Deze set centraliseert bestaand CRM-gedrag en is geen externe marktbenchmark.
            </p>
          </div>
          <Badge variant={coverage.complete ? 'default' : 'secondary'}>
            {loading ? 'Controleren…' : coverage.complete ? 'Compleet' : `${coverage.active} van ${coverage.expected} actief`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
          <CoverageMetric label="Verwacht" value={coverage.expected} />
          <CoverageMetric label="Aanwezig" value={coverage.present} />
          <CoverageMetric label="Actief" value={coverage.active} />
          <CoverageMetric label="Ontbrekend" value={coverage.missingCodes.length} attention={coverage.missingCodes.length > 0} />
          <CoverageMetric label="Inactief/verlopen" value={coverage.inactive + coverage.expired} attention={coverage.inactive + coverage.expired > 0} />
        </div>

        <div className="rounded-md border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs leading-relaxed text-amber-900 dark:text-amber-200">
          <span className="font-medium">Gebruik:</span> geschikt als eerste quickscanwerkhypothese. Controleer en vervang materiële waarden vóór een serieuze bieding door actuele externe of projectspecifieke bronnen.
          {!loading && attentionCount > 0 && (
            <span> Het pakket heeft momenteel {attentionCount} aandachtspunt{attentionCount === 1 ? '' : 'en'}.</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CoverageMetric({
  label,
  value,
  attention = false,
}: {
  label: string;
  value: number;
  attention?: boolean;
}) {
  return (
    <div className={`rounded-md border px-3 py-2 ${attention ? 'border-amber-500/30 bg-amber-500/5' : 'bg-muted/20'}`}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-mono-data text-sm font-semibold">{value}</p>
    </div>
  );
}
