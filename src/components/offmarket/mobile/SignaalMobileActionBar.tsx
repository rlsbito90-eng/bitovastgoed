// Compacte mobiele actiebar — primaire onderzoeksacties in één grid.
// Vervangt op mobiel de losse SignaalOnderzoeksacties-chiplijst boven de tabs.
import { Copy, Landmark, Map as MapIcon, MapPin, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  bouwBagViewerUrl,
  bouwGoogleMapsUrl,
  bouwGoogleSearchUrl,
  bouwKadastraleKaartUrl,
  bouwOnderzoeksAdresQuery,
} from '@/lib/offMarket/onderzoeksAdres';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
}

interface Actie {
  key: string;
  kort: string;
  aria: string;
  href: string | null;
  onClick?: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export default function SignaalMobileActionBar({ signaal }: Props) {
  const query = bouwOnderzoeksAdresQuery({
    adres: signaal.adres, postcode: signaal.postcode, plaats: signaal.plaats,
  });
  const mapsUrl = bouwGoogleMapsUrl({
    adres: signaal.adres, postcode: signaal.postcode, plaats: signaal.plaats,
    lat: (signaal as any).lat ?? null, lng: (signaal as any).lng ?? null,
  });
  const googleUrl = bouwGoogleSearchUrl({
    adres: signaal.adres, postcode: signaal.postcode, plaats: signaal.plaats,
  });

  const kopieer = async () => {
    if (!query) return;
    try {
      await navigator.clipboard.writeText(query);
      toast.success('Adres gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  const acties: Actie[] = [
    { key: 'maps', kort: 'Maps', aria: 'Open in Google Maps', href: mapsUrl, Icon: MapPin, disabled: !mapsUrl },
    { key: 'google', kort: 'Google', aria: 'Zoek adres op Google', href: googleUrl, Icon: Search, disabled: !googleUrl },
    { key: 'bag', kort: 'BAG', aria: 'Open in BAG Viewer', href: bouwBagViewerUrl(), Icon: MapIcon },
    { key: 'kadaster', kort: 'Kadaster', aria: 'Open in KadastraleKaart.com', href: bouwKadastraleKaartUrl(), Icon: Landmark },
    { key: 'bron', kort: 'Bron', aria: 'Open bekendmaking', href: signaal.bron_url || null, Icon: FileText, disabled: !signaal.bron_url },
    { key: 'copy', kort: 'Kopieer', aria: 'Kopieer adres', href: null, onClick: kopieer, Icon: Copy, disabled: !query },
  ];

  const knopBase = 'glass-mobile-action-btn';

  return (
    <section
      data-testid="signaal-mobile-actionbar"
      className="glass-mobile-action p-1.5 grid grid-cols-3 gap-1"
    >
      {acties.map(({ key, kort, aria, href, onClick, Icon, disabled }) => {
        const inhoud = (
          <>
            <Icon className="h-[18px] w-[18px]" />
            <span className="leading-none">{kort}</span>
          </>
        );
        if (href && !disabled) {
          return (
            <a
              key={key}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className={knopBase}
              aria-label={aria}
            >
              {inhoud}
            </a>
          );
        }
        return (
          <button
            key={key}
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={aria}
            className={knopBase}
          >
            {inhoud}
          </button>
        );
      })}
    </section>
  );
}

