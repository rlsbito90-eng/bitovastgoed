import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  toonArchiefActie?: boolean;
}

function formatteerArchiefdatum(value: string | null | undefined): string | null {
  if (!value) return null;
  const datum = new Date(value);
  if (Number.isNaN(datum.getTime())) return null;
  return datum.toLocaleDateString('nl-NL');
}

export default function BagCrmMatchBadge({ pand, fallbackLabel, toonArchiefActie = true }: Props) {
  const { kansen, archief, restoreKansen } = useVastgoedkansen();
  const alleVastgoedkansen = useMemo(() => [...kansen, ...archief], [kansen, archief]);
  const actieveVastgoedkansSelectieIds = useActieveVastgoedkansSelectieIds();
  const { objecten } = useDataStore();
  const { data: signalen = [] } = useOffMarketSignalenAlle();
  const [heropenenBezig, setHeropenenBezig] = useState(false);

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
  const vastgoedkans = match.bron === 'vastgoedkans'
    ? alleVastgoedkansen.find(item => item.id === match.recordId)
    : undefined;
  const inAcquisitieselectie = Boolean(
    match.bron === 'vastgoedkans'
    && !vastgoedkans?.archivedAt
    && actieveVastgoedkansSelectieIds.has(match.recordId),
  );

  if (vastgoedkans?.archivedAt) {
    label = 'Gearchiveerd';
    variant = 'outline';
  } else if (inAcquisitieselectie) {
    label = 'In Acquisitieselectie';
  } else if (match.bron === 'vastgoedkans') {
    label = 'Al Vastgoedkans';
  }

  const archiefdatum = formatteerArchiefdatum(vastgoedkans?.archivedAt);
  const toonHeropenen = Boolean(toonArchiefActie && vastgoedkans?.archivedAt);
  const linkRoute = inAcquisitieselectie
    ? `/off-market?vastgoedkans=${encodeURIComponent(match.recordId)}`
    : match.route;

  const openAcquisitieselectie = () => {
    if (!inAcquisitieselectie) return;
    try { sessionStorage.setItem('off-market-filter:tab', 'acquisitieselectie'); } catch { /* ignore */ }
  };

  const heropen = async () => {
    if (!vastgoedkans?.archivedAt || heropenenBezig) return;
    setHeropenenBezig(true);
    try {
      await restoreKansen([vastgoedkans.id]);
      toast.success('Vastgoedkans heropend.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Heropenen mislukt.');
    } finally {
      setHeropenenBezig(false);
    }
  };

  return (
    <div className="space-y-2" onClick={event => event.stopPropagation()}>
      <Link
        to={linkRoute}
        aria-label={`${label}; ${inAcquisitieselectie ? 'open in Acquisitieselectie' : 'open bestaand CRM-record'}`}
        title={`${label} via ${match.matchtype === 'bag_id' ? 'BAG-ID' : 'adres'}`}
        onClick={openAcquisitieselectie}
      >
        <Badge variant={variant} className="cursor-pointer hover:underline">{label}</Badge>
      </Link>
      {inAcquisitieselectie && (
        <Button asChild size="sm" variant="secondary" className="h-7 text-xs">
          <Link to={linkRoute} onClick={openAcquisitieselectie}>Open Acquisitieselectie</Link>
        </Button>
      )}
      {toonHeropenen && (
        <div className="rounded-md border bg-muted/20 p-2 text-xs text-muted-foreground">
          <p>{archiefdatum ? `Gearchiveerd op ${archiefdatum}` : 'Gearchiveerd'}{vastgoedkans?.archivedReason ? ` · ${vastgoedkans.archivedReason}` : ''}</p>
          <Button size="sm" variant="outline" className="mt-2 h-7 text-xs" disabled={heropenenBezig} onClick={() => void heropen()}>
            {heropenenBezig ? 'Heropenen…' : 'Heropenen'}
          </Button>
        </div>
      )}
    </div>
  );
}
