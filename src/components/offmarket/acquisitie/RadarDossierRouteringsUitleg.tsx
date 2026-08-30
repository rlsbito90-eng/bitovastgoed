import { useAlleOffMarketBrievenVoorPartijen } from '@/hooks/useAcquisitiePartijOverzicht';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import RadarBundelingUitleg from './RadarBundelingUitleg';

interface Props {
  signaalId: string;
  gebundeld: boolean;
}

export default function RadarDossierRouteringsUitleg({ signaalId, gebundeld }: Props) {
  const { data: signalen = [] } = useOffMarketSignalen();
  const { data: brieven = [] } = useAlleOffMarketBrievenVoorPartijen();

  if (!gebundeld) return null;
  const signaal = signalen.find((s) => s.id === signaalId);
  if (!signaal) {
    return <p className="text-[11px] text-amber-900">Bundelingscontext kon niet aan dit signaal worden gekoppeld.</p>;
  }

  return <RadarBundelingUitleg signaal={signaal} brieven={brieven} />;
}
