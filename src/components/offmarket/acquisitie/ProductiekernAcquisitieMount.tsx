import ProductiekernProductiepakketZone from './ProductiekernProductiepakketZone';
import { productiekernStandaardUitgeschakeld } from '@/lib/offMarket/acquisitie/productieActivatiePoort';

/**
 * Fysieke frontendmount voor de nieuwe acquisitieproductiekern.
 *
 * Deze eerste integratiestap is bewust fail-closed: zolang er geen expliciete
 * releasecompositie bestaat, blijft de centrale activatiepoort dicht en is er
 * geen formeel productiepakket beschikbaar. Daardoor rendert de productiekern
 * niets en kan de bestaande legacy-acquisitieworkflow ongewijzigd doorwerken.
 */
export default function ProductiekernAcquisitieMount() {
  return (
    <ProductiekernProductiepakketZone
      activatie={productiekernStandaardUitgeschakeld}
      pakket={null}
    />
  );
}
