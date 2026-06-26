// Compacte mobiele actiebar — horizontale pill-rij met icon + label,
// scrollbaar indien nodig. Vervangt de eerdere 2-rij grid.
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
    { key: 'kadaster', kort: 'Kadastrale kaart', aria: 'Open in KadastraleKaart.com', href: bouwKadastraleKaartUrl(), Icon: Landmark },
    { key: 'bron', kort: 'Bron', aria: 'Open bekendmaking', href: signaal.bron_url || null, Icon: FileText, disabled: !signaal.bron_url },
    { key: 'copy', kort: 'Kopieer', aria: 'Kopieer adres', href: null, onClick: kopieer, Icon: Copy, disabled: !query },
  ];

  const pillBase =
    'shrink-0 inline-flex items-center gap-1.5 px-3 h-9 rounded-full text-[12.5px] font-medium ' +
    'text-foreground/85 border border-transparent transition-colors ' +
    'hover:text-accent hover:bg-accent/[0.06] hover:border-accent/25 ' +
    'active:bg-accent/15 active:text-accent active:border-accent/40 ' +
    'disabled:opacity-40 disabled:cursor-not-allowed';

  return (
    <section
      data-testid="signaal-mobile-actionbar"
      className="glass-mobile-action px-1.5 py-1"
    >
      <div className="tabs-scroll flex items-center gap-1 overflow-x-auto no-scrollbar">
        {acties.map(({ key, kort, aria, href, onClick, Icon, disabled }) => {
          const inhoud = (
            <>
              <Icon className="h-4 w-4" />
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
                className={pillBase}
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
              className={pillBase}
            >
              {inhoud}
            </button>
          );
        })}
      </div>
    </section>
  );
}
