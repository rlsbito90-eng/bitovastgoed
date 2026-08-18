import {
  OPERATIONELE_WERKBAK_LABEL,
  type OperationeleWerkbak,
} from '@/lib/offMarket/acquisitie/operationeleWerkbak';

export type ProductiekernWerkbakView = OperationeleWerkbak | 'printbatches' | 'alles';

export const PRODUCTIEKERN_WERKBAK_VOLGORDE: readonly OperationeleWerkbak[] = [
  'nieuwe_selectie',
  'eigenaar_achterhalen',
  'brief_opstellen',
  'printklaar',
  'geprint_posten',
  'opvolgen',
  'wachten',
  'afgehandeld',
];

export interface ProductiekernWerkbakChipsProps {
  actief: ProductiekernWerkbakView;
  counts: Readonly<Record<OperationeleWerkbak, number>>;
  printbatchAantal?: number;
  totaal: number;
  onChange: (werkbak: ProductiekernWerkbakView) => void;
}

export default function ProductiekernWerkbakChips({
  actief,
  counts,
  printbatchAantal = 0,
  totaal,
  onChange,
}: ProductiekernWerkbakChipsProps) {
  const opties: Array<{ id: ProductiekernWerkbakView; label: string; aantal: number }> = [];
  for (const id of PRODUCTIEKERN_WERKBAK_VOLGORDE) {
    opties.push({ id, label: OPERATIONELE_WERKBAK_LABEL[id], aantal: counts[id] ?? 0 });
    if (id === 'printklaar') {
      opties.push({ id: 'printbatches', label: 'Printbatches', aantal: printbatchAantal });
    }
  }
  opties.push({ id: 'alles', label: 'Alles', aantal: totaal });

  return (
    <div
      className="flex min-w-0 flex-col gap-2"
      data-testid="productiekern-werkbakken"
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        Werkbak
      </span>
      <div
        role="tablist"
        aria-label="Operationele werkbak"
        className="flex flex-wrap gap-1.5"
      >
        {opties.map(({ id, label, aantal }) => {
          const geselecteerd = actief === id;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={geselecteerd}
              data-testid={`productiekern-werkbak-${id}`}
              onClick={() => onChange(id)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-3 py-1 text-xs font-medium transition-colors ${
                geselecteerd
                  ? 'border-accent bg-accent/10 text-accent shadow-sm'
                  : 'border-border bg-card text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <span>{label}</span>
              <span
                className={`rounded px-1.5 py-0.5 font-mono-data text-[10px] leading-none ${
                  geselecteerd
                    ? 'bg-accent/15 text-accent'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {aantal}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
