import { Layers3 } from 'lucide-react';
import { naarVoorlettersAchternaam } from '@/lib/format/naam';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { useAcquisitiePartijOverzicht } from '@/hooks/useAcquisitiePartijOverzicht';
import { partijKeyVoorKandidaat } from '@/lib/offMarket/acquisitie/partijOverzicht';

export interface GeadresseerdeVoorLijst {
  key: string;
  naam?: string | null;
  bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  volledigPostadres: boolean;
}

interface GeadresseerdenLijstProps {
  geadresseerden: GeadresseerdeVoorLijst[];
}

export function weergavenaamGeadresseerde(geadresseerde: GeadresseerdeVoorLijst): string {
  if (geadresseerde.bedrijfsnaam?.trim()) return geadresseerde.bedrijfsnaam.trim();
  if (geadresseerde.naam?.trim()) return naarVoorlettersAchternaam(geadresseerde.naam.trim());
  return '(zonder naam)';
}

export function weergaveadresGeadresseerde(adres: string | null | undefined): string | null {
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
  const { data: alleSignalen = [] } = useOffMarketSignalen();
  const partijOverzicht = useAcquisitiePartijOverzicht(alleSignalen);

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
          const adres = weergaveadresGeadresseerde(geadresseerde.verzendadres);
          const partijKey = partijKeyVoorKandidaat(geadresseerde);
          const partij = partijKey ? partijOverzicht.perKey.get(partijKey) : undefined;
          const bekendePartij = partij && partij.objecten.length >= 2 ? partij : undefined;
          return (
            <li
              key={geadresseerde.key}
              data-testid="acquisitie-rij-geadresseerde"
              className="min-w-0 break-words"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <div className="font-medium text-foreground" data-testid="acquisitie-rij-geadresseerde-naam">
                  {weergavenaamGeadresseerde(geadresseerde)}
                </div>
                {bekendePartij && (
                  <span
                    data-testid="acquisitie-rij-bekende-partij"
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900"
                    title={`Deze partij is gekoppeld aan ${bekendePartij.objecten.length} bekende objecten.`}
                  >
                    <Layers3 className="h-3 w-3" />
                    Bekende partij · {bekendePartij.objecten.length} objecten
                  </span>
                )}
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
