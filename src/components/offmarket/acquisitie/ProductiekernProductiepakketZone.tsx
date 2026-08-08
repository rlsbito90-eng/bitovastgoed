import type { ProductiekernActivatieBesluit } from '@/lib/offMarket/acquisitie/productiekernActivatieBesluit';
import type { ProductiekernProductiepakketPayload } from '@/lib/offMarket/acquisitie/productiekernProductiepakketSamenstelling';

import ProductiekernProductiepakketDownload from './ProductiekernProductiepakketDownload';

interface Props {
  activatie: ProductiekernActivatieBesluit;
  pakket: ProductiekernProductiepakketPayload | null;
}

/**
 * Expliciete frontendgrens voor de nieuwe productiekern.
 * Zonder een volledig groen centraal activatiebesluit of zonder een volledig
 * productiekernpakket rendert deze zone helemaal niets. Legacy conceptdata
 * wordt hier bewust niet omgezet naar productiekerncontracten.
 */
export default function ProductiekernProductiepakketZone({ activatie, pakket }: Props) {
  if (!activatie.lezenActief || !activatie.schrijvenActief || !pakket) return null;

  return (
    <div data-testid="productiekern-productiepakket-zone">
      <ProductiekernProductiepakketDownload
        manifest={pakket.manifest}
        voorblad={pakket.voorblad}
        controlelijst={pakket.controlelijst}
        labels={pakket.labels}
        brieven={pakket.brieven}
      />
    </div>
  );
}
