import type { AcquisitiedossierContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import type { ProductiekernWorkflowPariteit } from '@/lib/offMarket/acquisitie/productiekernDossierProjectiePariteit';
import {
  OPERATIONELE_WERKBAK_LABEL,
  type OperationeleWerkbak,
} from '@/lib/offMarket/acquisitie/operationeleWerkbak';

interface ProductiekernDossierProjectieProps {
  dossiers: readonly AcquisitiedossierContract[];
  totaalSelecties: number;
  pariteit?: ProductiekernWorkflowPariteit | null;
  laden?: boolean;
  fout?: boolean;
}

const VOLGORDE: readonly OperationeleWerkbak[] = [
  'nieuwe_selectie',
  'eigenaar_achterhalen',
  'brief_opstellen',
  'printklaar',
  'geprint_posten',
  'opvolgen',
  'wachten',
  'afgehandeld',
];

/**
 * Uitsluitend observerende statusprojectie van het formele productiekernmodel.
 *
 * Deze component bevat bewust geen acties en beïnvloedt geen legacywerkbakken,
 * filters of sortering. Daardoor kan de formele status eerst naast de bestaande
 * acquisitieworkflow worden beoordeeld voordat enige operationele overname
 * wordt toegestaan.
 *
 * Een readmodel-fout wordt expliciet fail-closed weergegeven. Een mislukte
 * bulkread mag nooit als "0 formele dossiers" of als pariteitsafwijking worden
 * geïnterpreteerd.
 */
export default function ProductiekernDossierProjectie({
  dossiers,
  totaalSelecties,
  pariteit = null,
  laden = false,
  fout = false,
}: ProductiekernDossierProjectieProps) {
  const tellingen = new Map<OperationeleWerkbak, number>();
  if (!fout) {
    for (const dossier of dossiers) {
      tellingen.set(
        dossier.primaireWerkbak,
        (tellingen.get(dossier.primaireWerkbak) ?? 0) + 1,
      );
    }
  }

  return (
    <section
      className="rounded-lg border border-dashed bg-muted/20 px-4 py-3"
      data-testid="productiekern-dossier-projectie"
      aria-label="Productiekern read-only status"
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Productiekern — read-only</span>
        <span className="text-muted-foreground">
          {fout
            ? 'Readmodel niet beschikbaar'
            : laden
              ? 'Laden…'
              : `${dossiers.length}/${totaalSelecties} formele dossiers`}
        </span>
        {!fout && !laden && pariteit && (
          <span
            className="rounded-full border bg-background px-2 py-0.5 text-xs"
            data-testid="productiekern-workflowpariteit"
          >
            Workflowpariteit: {pariteit.gelijk}/{pariteit.vergelijkbaar} gelijk
            {pariteit.afwijkend > 0 ? ` · ${pariteit.afwijkend} afwijkend` : ''}
            {pariteit.productiekernOntbreekt > 0
              ? ` · ${pariteit.productiekernOntbreekt} kern ontbreekt`
              : ''}
            {pariteit.legacyOntbreekt > 0
              ? ` · ${pariteit.legacyOntbreekt} legacy ontbreekt`
              : ''}
          </span>
        )}
        {!fout && !laden && VOLGORDE.map((werkbak) => {
          const aantal = tellingen.get(werkbak) ?? 0;
          if (aantal === 0) return null;
          return (
            <span
              key={werkbak}
              className="rounded-full border bg-background px-2 py-0.5 text-xs"
              data-werkbak={werkbak}
            >
              {OPERATIONELE_WERKBAK_LABEL[werkbak]}: {aantal}
            </span>
          );
        })}
      </div>
    </section>
  );
}
