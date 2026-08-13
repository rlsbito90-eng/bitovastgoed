import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { useActieveVastgoedkansSelectieIds } from '@/hooks/useAcquisitieSelectie';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketSignalenAlle } from '@/hooks/useOffMarketSignalen';
import type { BagVerkennerPand } from '@/lib/bag/pandenverkennerModel';
import {
  bouwCrmObjectMatchIndex,
  CRM_OBJECT_BRON_LABEL,
  vindCrmObjectMatch,
  type CrmObjectReferentie,
} from '@/lib/bag/crmObjectMatch';

interface Props {
  pand: BagVerkennerPand;
  fallbackLabel: string;
}

export default function BagCrmMatchBadge({ pand, fallbackLabel }: Props) {
  const { kansen, archief } = useVastgoedkansen();
  const alleVastgoedkansen = useMemo(() => [...kansen, ...archief], [kansen, archief]);
  const actieveVastgoedkansSelectieIds = useActieveVastgoedkansSelectieIds();
  const { objecten } = useDataStore();
  const { data: signalen = [] } = useOffMarketSignalenAlle();

  const index = useMemo(() => {
    const referenties: CrmObjectReferentie[] = [
      ...alleVastgoedkansen.map(kans => ({
        bron: 'vastgoedkans' as const,
        recordId: kans.id,
        route: `/vastgoedkansen/${kans.id}`,
        bagPandId: kans.bagPandId,
        adres: kans.adres,
        postcode: kans.postcode,
      })),
      ...objecten.map(object => {
        const bron = object as typeof object & { bagPandId?: string; straatAdres?: string };
        return {
          bron: 'object' as const,
          recordId: object.id,
          route: `/objecten/${object.id}`,
          bagPandId: bron.bagPandId,
          adres: object.adres ?? bron.straatAdres ?? '',
          postcode: object.postcode,
        };
      }),
      ...signalen.map(signaal => {
        const bron = signaal as typeof signaal & { bagPandId?: string; bag_pand_id?: string };
        return {
          bron: 'signaal' as const,
          recordId: signaal.id,
          route: `/off-market/${signaal.id}`,
          bagPandId: bron.bagPandId ?? bron.bag_pand_id,
          adres: signaal.adres ?? '',
          postcode: signaal.postcode,
        };
      }),
    ];
    return bouwCrmObjectMatchIndex(referenties.filter(referentie => referentie.adres || referentie.bagPandId));
  }, [alleVastgoedkansen, objecten, signalen]);

  const match = vindCrmObjectMatch(pand, index);
  if (!match) return <Badge variant="secondary">{fallbackLabel}</Badge>;

  let label = `Al bekend als ${CRM_OBJECT_BRON_LABEL[match.bron]}`;
  let variant: 'secondary' | 'outline' = 'secondary';

  if (match.bron === 'vastgoedkans') {
    const kans = alleVastgoedkansen.find(item => item.id === match.recordId);
    if (kans?.archivedAt) {
      label = 'Gearchiveerd';
      variant = 'outline';
    } else if (actieveVastgoedkansSelectieIds.has(match.recordId)) {
      label = 'In Acquisitieselectie';
    } else {
      label = 'Al Vastgoedkans';
    }
  }

  return (
    <Link
      to={match.route}
      aria-label={`${label}; open bestaand CRM-record`}
      title={`${label} via ${match.matchtype === 'bag_id' ? 'BAG-ID' : 'adres'}`}
      onClick={event => event.stopPropagation()}
    >
      <Badge variant={variant} className="cursor-pointer hover:underline">{label}</Badge>
    </Link>
  );
}
