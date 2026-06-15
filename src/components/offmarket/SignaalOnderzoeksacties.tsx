// Prominent blok met externe onderzoeksacties voor een off-market signaal.
// Gebruikt op:
//  - Overzicht-tab (primaire workflow, ook direct zichtbaar op mobiel)
//  - Onderzoek-tab (uitgebreidere variant)
import { Copy, ExternalLink, Landmark, Map as MapIcon, MapPin, Search, FileText } from 'lucide-react';
import { toast } from 'sonner';
import {
  bouwBagViewerUrl, bouwGoogleMapsUrl, bouwGoogleSearchUrl,
  bouwKadastraleKaartUrl, bouwOnderzoeksAdresQuery,
} from '@/lib/offMarket/onderzoeksAdres';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props {
  signaal: OffMarketSignaal;
  /** Compacte variant: alleen icoon + kort label, geschikt voor mobiele scrollbar. */
  variant?: 'standaard' | 'compact';
  /** Optioneel: toon header met titel "Onderzoeksacties". */
  withHeader?: boolean;
}

interface Actie {
  key: string;
  label: string;
  kort: string;
  href: string | null;
  onClick?: () => void;
  Icon: React.ComponentType<{ className?: string }>;
  disabled?: boolean;
}

export default function SignaalOnderzoeksacties({ signaal, variant = 'standaard', withHeader = true }: Props) {
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

  const kopieerAdres = async () => {
    if (!query) return;
    try {
      await navigator.clipboard.writeText(query);
      toast.success('Adres gekopieerd');
    } catch {
      toast.error('Kopiëren mislukt');
    }
  };

  const acties: Actie[] = [
    { key: 'maps', label: 'Open in Google Maps', kort: 'Maps', href: mapsUrl, Icon: MapPin, disabled: !mapsUrl },
    { key: 'google', label: 'Zoek adres op Google', kort: 'Google', href: googleUrl, Icon: Search, disabled: !googleUrl },
    { key: 'bag', label: 'Open in BAG Viewer', kort: 'BAG', href: bouwBagViewerUrl(), Icon: MapIcon },
    { key: 'kadaster', label: 'Open in KadastraleKaart.com', kort: 'Kadasterkaart', href: bouwKadastraleKaartUrl(), Icon: Landmark },
    { key: 'bron', label: 'Open bekendmaking', kort: 'Bron', href: signaal.bron_url || null, Icon: FileText, disabled: !signaal.bron_url },
    { key: 'copy', label: 'Kopieer adres', kort: 'Kopieer', href: null, onClick: kopieerAdres, Icon: Copy, disabled: !query },
  ];

  const isCompact = variant === 'compact';
  const knopBase =
    'shrink-0 inline-flex items-center gap-1.5 rounded-md border text-xs whitespace-nowrap transition-colors ' +
    'border-border bg-card text-foreground hover:border-accent/50 hover:text-accent ' +
    'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border disabled:hover:text-foreground';
  const knopPad = isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2';

  return (
    <section
      data-testid="signaal-onderzoeksacties"
      className={withHeader ? 'section-card p-4 sm:p-5 space-y-3' : 'space-y-2'}
    >
      {withHeader && (
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            Onderzoeksacties
          </h2>
          {query && (
            <span className="hidden sm:inline text-[11px] text-muted-foreground truncate max-w-[60%]">
              {query}
            </span>
          )}
        </div>
      )}
      <div className="flex gap-1.5 overflow-x-auto sm:flex-wrap -mx-1 px-1 sm:mx-0 sm:px-0 pb-1 sm:pb-0">
        {acties.map(({ key, label, kort, href, onClick, Icon, disabled }) => {
          const inhoud = (
            <>
              <Icon className="h-3.5 w-3.5" />
              <span>{isCompact ? kort : label}</span>
              {href && !isCompact && <ExternalLink className="h-3 w-3 opacity-50" />}
            </>
          );
          if (href && !disabled) {
            return (
              <a key={key} href={href} target="_blank" rel="noopener noreferrer"
                 className={`${knopBase} ${knopPad}`} aria-label={label}>
                {inhoud}
              </a>
            );
          }
          return (
            <button
              key={key} type="button" onClick={onClick}
              disabled={disabled}
              aria-label={label}
              className={`${knopBase} ${knopPad}`}
            >
              {inhoud}
            </button>
          );
        })}
      </div>
      {!query && withHeader && (
        <p className="text-[11px] text-muted-foreground">
          Geen volledig adres beschikbaar — Maps/Google werken pas zodra het adres is ingevuld.
        </p>
      )}
    </section>
  );
}
