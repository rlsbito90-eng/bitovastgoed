// Mobiele 4-staps eigenaar-workflow.
// Wikkelt bestaande secties in genummerde stap-kaders, zodat de Eigenaar-tab
// als workflow voelt zonder dat we logica dupliceren.
import { MapPin, Landmark, UserSearch, Link2 } from 'lucide-react';
import SignaalKadasterKaart from '@/components/offmarket/kadaster/SignaalKadasterKaart';
import SignaalEigenaarsonderzoekSectie from '@/components/offmarket/SignaalEigenaarsonderzoekSectie';
import SignaalKoppelingenSectie from '@/components/offmarket/SignaalKoppelingenSectie';
import {
  bouwBagViewerUrl,
  bouwGoogleMapsUrl,
} from '@/lib/offMarket/onderzoeksAdres';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props { signaal: OffMarketSignaal; }

export default function SignaalMobileEigenaarWorkflow({ signaal }: Props) {
  const mapsUrl = bouwGoogleMapsUrl({
    adres: signaal.adres, postcode: signaal.postcode, plaats: signaal.plaats,
    lat: (signaal as any).lat ?? null, lng: (signaal as any).lng ?? null,
  });
  const bagUrl = bouwBagViewerUrl();
  const adres = [signaal.adres, signaal.postcode, signaal.plaats].filter(Boolean).join(', ') || '—';

  return (
    <div className="space-y-4" data-testid="eigenaar-workflow">
      <Stap nummer={1} titel="BAG-adres controleren" Icon={MapPin}>
        <div className="space-y-2">
          <p className="text-[13px] text-foreground break-words">{adres}</p>
          <div className="flex flex-wrap gap-1.5">
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-card hover:border-accent/50 hover:text-accent text-foreground"
              >
                Open in Maps
              </a>
            )}
            <a
              href={bagUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[12px] inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-card hover:border-accent/50 hover:text-accent text-foreground"
            >
              Open in BAG Viewer
            </a>
          </div>
        </div>
      </Stap>

      <Stap nummer={2} titel="Kadastergegevens ophalen" Icon={Landmark}>
        <SignaalKadasterKaart signaal={signaal} />
      </Stap>

      <Stap nummer={3} titel="Eigenaarsonderzoek" Icon={UserSearch}>
        <SignaalEigenaarsonderzoekSectie signaal={signaal} />
      </Stap>

      <Stap nummer={4} titel="Koppeling" Icon={Link2}>
        <SignaalKoppelingenSectie signaal={signaal} />
      </Stap>
    </div>
  );
}

function Stap({
  nummer, titel, Icon, children,
}: {
  nummer: number;
  titel: string;
  Icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div className="relative pl-9">
      <div className="absolute left-0 top-0 flex items-center justify-center h-7 w-7 rounded-full border border-accent/40 bg-accent/10 text-accent text-[12px] font-semibold">
        {nummer}
      </div>
      <div className="space-y-2">
        <h3 className="text-[13px] font-semibold text-foreground flex items-center gap-1.5">
          <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          Stap {nummer} — {titel}
        </h3>
        <div>{children}</div>
      </div>
    </div>
  );
}
