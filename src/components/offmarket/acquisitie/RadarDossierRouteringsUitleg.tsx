import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { WerkvoorraadStatus } from '@/hooks/useAcquisitieSelectie';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import RadarBundelingUitleg from './RadarBundelingUitleg';

interface Props {
  status: WerkvoorraadStatus;
  signaal: OffMarketSignaal;
  brieven: OffMarketBrief[];
  onOpenSignaal: (signaalId: string) => void;
}

export default function RadarDossierRouteringsUitleg({ status, signaal, brieven, onOpenSignaal }: Props) {
  if (status !== 'gebundeld_bij_partij') return null;
  return <RadarBundelingUitleg signaal={signaal} brieven={brieven} onOpenSignaal={onOpenSignaal} />;
}
