interface GeadresseerdeVoorLijst {
  key: string;
  naam?: string | null;
  bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  volledigPostadres: boolean;
}

interface GeadresseerdenLijstProps {
  geadresseerden: GeadresseerdeVoorLijst[];
}

/** Altijd zichtbare geadresseerdenweergave voor één acquisitiedossier. */
export default function GeadresseerdenLijst({
  geadresseerden,
}: GeadresseerdenLijstProps) {
  if (geadresseerden.length === 0) return null;

  return (
    <section
      className="mt-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2"
      data-testid="acquisitie-rij-geadresseerden"
      aria-label={`${geadresseerden.length} geadresseerde${geadresseerden.length === 1 ? '' : 'n'}`}
    >
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Geadresseerde{geadresseerden.length === 1 ? '' : 'n'} ({geadresseerden.length})
      </p>
      <ul className="space-y-1 text-[11px] text-muted-foreground">
        {geadresseerden.map((geadresseerde) => (
          <li
            key={geadresseerde.key}
            data-testid="acquisitie-rij-geadresseerde"
            className="break-words"
          >
            <span className="text-foreground">
              {geadresseerde.naam
                ?? geadresseerde.bedrijfsnaam
                ?? '(zonder naam)'}
            </span>
            {geadresseerde.verzendadres && (
              <span> · {geadresseerde.verzendadres.replace(/\s+/g, ' ')}</span>
            )}
            {!geadresseerde.volledigPostadres && (
              <span className="text-destructive"> · adres onvolledig</span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
