import { naarVoorlettersAchternaam } from '@/lib/format/naam';

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

function weergavenaam(geadresseerde: GeadresseerdeVoorLijst): string {
  if (geadresseerde.bedrijfsnaam?.trim()) return geadresseerde.bedrijfsnaam.trim();
  if (geadresseerde.naam?.trim()) return naarVoorlettersAchternaam(geadresseerde.naam.trim());
  return '(zonder naam)';
}

function weergaveadres(adres: string | null | undefined): string | null {
  const schoon = adres?.replace(/\s+/g, ' ').trim();
  return schoon || null;
}

/**
 * Altijd zichtbare eigenaar-/geadresseerdenweergave voor één acquisitiedossier.
 * De objectregel erboven blijft het primaire anker; hier staan alle partijen met
 * hun correspondentieadres zodat ook eigenaren op een ander adres direct aan het
 * juiste object te koppelen zijn.
 */
export default function GeadresseerdenLijst({
  geadresseerden,
}: GeadresseerdenLijstProps) {
  if (geadresseerden.length === 0) return null;

  return (
    <section
      className="mt-2 rounded-md border border-border/70 bg-muted/20 px-2.5 py-2"
      data-testid="acquisitie-rij-geadresseerden"
      aria-label={`${geadresseerden.length} eigenaar/geadresseerde${geadresseerden.length === 1 ? '' : 'n'}`}
    >
      <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Eigenaar / geadresseerde{geadresseerden.length === 1 ? '' : 'n'} ({geadresseerden.length})
      </p>
      <ul className="space-y-1.5 text-[11px] text-muted-foreground">
        {geadresseerden.map((geadresseerde) => {
          const adres = weergaveadres(geadresseerde.verzendadres);
          return (
            <li
              key={geadresseerde.key}
              data-testid="acquisitie-rij-geadresseerde"
              className="min-w-0 break-words"
            >
              <div className="font-medium text-foreground" data-testid="acquisitie-rij-geadresseerde-naam">
                {weergavenaam(geadresseerde)}
              </div>
              {adres ? (
                <div data-testid="acquisitie-rij-geadresseerde-adres">
                  <span className="text-muted-foreground/80">Postadres:</span> {adres}
                  {!geadresseerde.volledigPostadres && (
                    <span className="text-destructive"> · adres onvolledig</span>
                  )}
                </div>
              ) : (
                <div className="text-destructive" data-testid="acquisitie-rij-geadresseerde-adres-ontbreekt">
                  Postadres ontbreekt
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
