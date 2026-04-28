// src/components/RelatieNaamDisplay.tsx
//
// Standaard weergave-component voor een relatie-naam in twee regels:
// - primair (vet, bovenaan) = contactpersoon of bedrijfsnaam
// - secundair (kleiner, eronder) = bedrijfsnaam (alleen als er ook een
//   contactpersoon is)
//
// Variants:
//   default — voor lijst-rijen (sm:text-sm)
//   detail  — voor detail-pagina headers (groter, meer ruimte)
//   inline  — één regel "Contactpersoon · Bedrijfsnaam"

import { useDataStore } from '@/hooks/useDataStore';
import { getRelatieNamen, getRelatieNaamCompact } from '@/lib/relatieNaam';
import type { Relatie } from '@/data/mock-data';

interface Props {
  relatie: Relatie | null | undefined;
  variant?: 'default' | 'detail' | 'inline';
  className?: string;
}

export default function RelatieNaamDisplay({ relatie, variant = 'default', className = '' }: Props) {
  const store = useDataStore();
  const contactpersonen = store.contactpersonen ?? [];

  if (variant === 'inline') {
    return (
      <span className={className}>
        {getRelatieNaamCompact(relatie, contactpersonen)}
      </span>
    );
  }

  const { primair, secundair, isLeeg } = getRelatieNamen(relatie, contactpersonen);

  if (variant === 'detail') {
    return (
      <div className={className}>
        <h1 className={`text-2xl sm:text-3xl font-semibold tracking-tight ${
          isLeeg ? 'text-muted-foreground italic' : 'text-foreground'
        }`}>
          {primair}
        </h1>
        {secundair && (
          <p className="text-sm text-muted-foreground mt-1">{secundair}</p>
        )}
      </div>
    );
  }

  // default - voor lijst-rijen
  return (
    <div className={`min-w-0 ${className}`}>
      <p className={`text-sm font-medium truncate ${
        isLeeg ? 'text-muted-foreground italic' : 'text-foreground'
      }`}>
        {primair}
      </p>
      {secundair && (
        <p className="text-xs text-muted-foreground truncate mt-0.5">{secundair}</p>
      )}
    </div>
  );
}
