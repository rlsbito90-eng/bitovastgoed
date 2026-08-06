import type { ReactNode } from 'react';

import GeadresseerdenLijst from './GeadresseerdenLijst';
import SelecteerbareDossierRij from './SelecteerbareDossierRij';

interface GeadresseerdeVoorDossierRij {
  key: string;
  naam?: string | null;
  bedrijfsnaam?: string | null;
  verzendadres?: string | null;
  volledigPostadres: boolean;
}

interface AcquisitieDossierRijProps {
  geselecteerd: boolean;
  onToggle: () => void;
  signaalId: string;
  fase: string;
  werkbak: string;
  actieCategorie?: string | null;
  geadresseerden: GeadresseerdeVoorDossierRij[];
  hoofdinhoud: ReactNode;
  acties: ReactNode;
}

/**
 * Volledige presentatielaag voor één dossier in de acquisitieselectie.
 * De kaartselectie, zichtbare geadresseerden en actiezone worden hier bewust
 * samengebracht zodat de lijstcontainer zelf geen interactielogica dupliceert.
 */
export default function AcquisitieDossierRij({
  geselecteerd,
  onToggle,
  signaalId,
  fase,
  werkbak,
  actieCategorie,
  geadresseerden,
  hoofdinhoud,
  acties,
}: AcquisitieDossierRijProps) {
  return (
    <SelecteerbareDossierRij
      geselecteerd={geselecteerd}
      onToggle={onToggle}
      signaalId={signaalId}
      fase={fase}
      werkbak={werkbak}
      actieCategorie={actieCategorie}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          {hoofdinhoud}
          <GeadresseerdenLijst geadresseerden={geadresseerden} />
        </div>
        <div
          className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0"
          data-no-row-select="true"
        >
          {acties}
        </div>
      </div>
    </SelecteerbareDossierRij>
  );
}
