import type { AcquisitiedossierContract } from '@/lib/offMarket/acquisitie/productiekernContract';
import type { ProductiekernWorkflowPariteit } from '@/lib/offMarket/acquisitie/productiekernDossierProjectiePariteit';
import type { OperationeleWerkbak } from '@/lib/offMarket/acquisitie/operationeleWerkbak';
import ProductiekernWerkbakChips, {
  PRODUCTIEKERN_WERKBAK_VOLGORDE,
  type ProductiekernWerkbakView,
} from './ProductiekernWerkbakChips';

interface ProductiekernDossierProjectieProps {
  dossiers: readonly AcquisitiedossierContract[];
  totaalSelecties: number;
  actieveWerkbak: ProductiekernWerkbakView;
  onWerkbakChange: (werkbak: ProductiekernWerkbakView) => void;
  pariteit?: ProductiekernWorkflowPariteit | null;
  laden?: boolean;
  fout?: boolean;
}

function legeTellingen(): Record<OperationeleWerkbak, number> {
  return Object.fromEntries(
    PRODUCTIEKERN_WERKBAK_VOLGORDE.map((werkbak) => [werkbak, 0]),
  ) as Record<OperationeleWerkbak, number>;
}

/**
 * Formele statusprojectie van het Productiekernmodel.
 *
 * De werkbaknavigatie gebruikt uitsluitend `primaireWerkbak` uit formele
 * acquisitiedossiers. Zij leidt `nieuwe_selectie` dus nooit af uit legacydata,
 * datums of een ontbrekend dossier. Een readmodel-fout wordt expliciet
 * fail-closed weergegeven en produceert geen misleidende werkbaktellingen.
 * Tijdens laden blijft ook de werkbaknavigatie gesloten zodat nooit partiële
 * aantallen uit verschillende asynchrone reads worden getoond.
 */
export default function ProductiekernDossierProjectie({
  dossiers,
  totaalSelecties,
  actieveWerkbak,
  onWerkbakChange,
  pariteit = null,
  laden = false,
  fout = false,
}: ProductiekernDossierProjectieProps) {
  const tellingen = legeTellingen();
  if (!fout && !laden) {
    for (const dossier of dossiers) {
      tellingen[dossier.primaireWerkbak] += 1;
    }
  }

  const zichtbaarAantal = fout || laden
    ? null
    : actieveWerkbak === 'alles'
      ? dossiers.length
      : tellingen[actieveWerkbak];

  return (
    <section
      className="space-y-3 rounded-lg border bg-card px-4 py-3"
      data-testid="productiekern-dossier-projectie"
      aria-label="Productiekern operationele werkbakken"
      aria-busy={laden || undefined}
    >
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium">Acquisitieproductiekern</span>
        <span className="text-muted-foreground">
          {fout
            ? 'Readmodel niet beschikbaar'
            : laden
              ? 'Laden…'
              : `${dossiers.length}/${totaalSelecties} formele dossiers`}
        </span>
        {!fout && !laden && pariteit && (
          <span
            className="rounded-full border bg-background px-2 py-0.5 text-xs text-muted-foreground"
            data-testid="productiekern-workflowpariteit"
          >
            Pariteit: {pariteit.gelijk}/{pariteit.vergelijkbaar}
            {pariteit.afwijkend > 0 ? ` · ${pariteit.afwijkend} afwijkend` : ''}
            {pariteit.productiekernOntbreekt > 0
              ? ` · ${pariteit.productiekernOntbreekt} kern ontbreekt`
              : ''}
          </span>
        )}
      </div>

      {!fout && !laden && (
        <ProductiekernWerkbakChips
          actief={actieveWerkbak}
          counts={tellingen}
          totaal={dossiers.length}
          onChange={onWerkbakChange}
        />
      )}

      {zichtbaarAantal !== null && (
        <p
          className="text-xs text-muted-foreground"
          data-testid="productiekern-actieve-werkbak-telling"
        >
          {zichtbaarAantal} {zichtbaarAantal === 1 ? 'dossier' : 'dossiers'} in deze weergave
        </p>
      )}
    </section>
  );
}
