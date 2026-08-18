import GecombineerdeBrievenPDF from '@/components/offmarket/GecombineerdeBrievenPDF';
import type { BriefRenderInvoer } from '@/lib/offMarket/acquisitie/briefRenderInvoer';
import { bouwProductiekernBriefRenderItems } from '@/lib/offMarket/acquisitie/productiekernBriefRenderAdapter';
import { BITO_LOGO_URL } from '@/lib/pdf/logo';

interface ProductiekernBrievenPDFProps {
  brieven: readonly BriefRenderInvoer[];
  title?: string;
}

/**
 * Presentatie-adapter voor de nieuwe acquisitieproductiekern.
 *
 * De component gebruikt uitsluitend reeds gevalideerde, immutable
 * BriefRenderInvoer en hergebruikt daarna de bestaande BriefPagina-layout.
 * Hij leest of schrijft zelf niets in Supabase/Storage.
 *
 * Formele BAT-brieven gebruiken expliciet het volledige gekleurde Bito-logo;
 * daarmee is de huisstijl niet afhankelijk van de icon-only fallback.
 */
export default function ProductiekernBrievenPDF({
  brieven,
  title,
}: ProductiekernBrievenPDFProps) {
  const items = bouwProductiekernBriefRenderItems(brieven).map((item) => ({
    key: item.key,
    vm: item.viewModel,
    logo: { mode: 'full' as const, url: BITO_LOGO_URL },
  }));

  return (
    <GecombineerdeBrievenPDF
      items={items}
      title={title ?? 'Bito Vastgoed — acquisitieproductiekern brieven'}
    />
  );
}
