import GecombineerdeBrievenPDF from '@/components/offmarket/GecombineerdeBrievenPDF';
import type { BriefRenderInvoer } from '@/lib/offMarket/acquisitie/briefRenderInvoer';
import { bouwProductiekernBriefRenderItems } from '@/lib/offMarket/acquisitie/productiekernBriefRenderAdapter';

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
 */
export default function ProductiekernBrievenPDF({
  brieven,
  title,
}: ProductiekernBrievenPDFProps) {
  const items = bouwProductiekernBriefRenderItems(brieven).map((item) => ({
    key: item.key,
    vm: item.viewModel,
  }));

  return (
    <GecombineerdeBrievenPDF
      items={items}
      title={title ?? 'Bito Vastgoed — acquisitieproductiekern brieven'}
    />
  );
}
