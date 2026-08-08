import ProductiekernProductiepakketZone from './ProductiekernProductiepakketZone';
import { productiekernStandaardUitgeschakeld } from '@/lib/offMarket/acquisitie/productieActivatiePoort';
import { maakStandaardProductiekernBrowserLeesSamenstelling } from '@/lib/offMarket/acquisitie/productiekernBrowserClient';

/**
 * Fysieke frontendmount voor de nieuwe acquisitieproductiekern.
 *
 * De mount is nu aan de bestaande CRM-Supabase-client gekoppeld via de aparte
 * read-only browsercompositie. Die compositie blijft standaard fail-closed:
 * zonder volledig leesbewijs bereikt geen enkele read client.from(). Pas na een
 * afzonderlijk leesakkoord kan hier formele productiekerndata worden geladen.
 *
 * De productie-/writepoort blijft daarnaast zelfstandig dicht. De bestaande
 * legacy-acquisitieworkflow blijft hierdoor ongewijzigd functioneren.
 */
export default function ProductiekernAcquisitieMount() {
  const leesSamenstelling = maakStandaardProductiekernBrowserLeesSamenstelling();

  if (!leesSamenstelling.activatie.lezenActief) return null;

  return (
    <ProductiekernProductiepakketZone
      activatie={productiekernStandaardUitgeschakeld}
      pakket={null}
    />
  );
}
