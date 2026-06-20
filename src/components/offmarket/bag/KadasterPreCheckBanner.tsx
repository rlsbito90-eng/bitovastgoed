// V2.3 + V2.4 — Banner boven Kadaster-aanvraagblok met BAG-pre-check,
// doelobject + pandcontext, en advies.
import { Info, AlertTriangle } from 'lucide-react';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import type { BagStatus, SignaalBagInput } from '@/lib/offMarket/bag/types';
import { BAG_STATUS_LABEL } from '@/lib/offMarket/bag/types';
import { berekenKadasteradvies } from '@/lib/offMarket/bag/kadasteradvies';
import KadasteradviesBadge from './KadasteradviesBadge';

interface Props {
  signaal: OffMarketSignaal;
}

export default function KadasterPreCheckBanner({ signaal }: Props) {
  const s = signaal as unknown as Record<string, unknown> & OffMarketSignaal;
  const bagStatus = (s.bag_status as BagStatus | null | undefined) ?? 'niet_verrijkt';
  const totaalOpp = (s.bag_totaal_oppervlakte_m2 as number | null | undefined) ?? null;
  const aantalVbo = (s.bag_aantal_vbo as number | null | undefined) ?? null;
  const gebruiksdoelen = (s.bag_gebruiksdoelen as string[] | null | undefined) ?? [];
  const matchKw = (s.bag_match_kwaliteit as string | null | undefined) ?? null;
  const bouwjaar = (s.bag_bouwjaar as number | null | undefined) ?? null;
  const pandStatus = (s.bag_pand_status as string | null | undefined) ?? null;

  // V2.4
  const pandAantalVbo = (s.bag_pandcontext_aantal_vbo as number | null | undefined) ?? aantalVbo;
  const pandTotaalOpp = (s.bag_pandcontext_totaal_opp_m2 as number | null | undefined) ?? totaalOpp;
  const gekozenAdres = (s.bag_geselecteerd_adres as string | null | undefined) ?? null;
  const gekozenOpp = (s.bag_geselecteerd_opp_m2 as number | null | undefined) ?? null;

  const advies = berekenKadasteradvies(s as unknown as SignaalBagInput);
  const onzeker = matchKw === 'onzeker' || bagStatus === 'meerdere_matches';
  const detailsOntbreken = bagStatus === 'verrijkt' && pandTotaalOpp == null && gebruiksdoelen.length === 0;

  return (
    <div
      data-testid="kadaster-precheck-banner"
      className="rounded-md border border-accent/30 bg-accent/5 p-3 space-y-2"
    >
      <div className="flex items-start gap-2">
        <Info className="h-4 w-4 text-accent mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-medium text-foreground">BAG pre-check</p>
            <span
              className="text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground"
              data-testid="precheck-bag-status"
            >
              {BAG_STATUS_LABEL[bagStatus] ?? bagStatus}
            </span>
            {bagStatus === 'verrijkt' && <KadasteradviesBadge niveau={advies.niveau} />}
          </div>

          {onzeker ? (
            <div
              data-testid="precheck-onzeker-waarschuwing"
              className="flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-100/60 border border-amber-300/60 rounded px-2 py-1"
            >
              <AlertTriangle className="h-3 w-3 mt-0.5 shrink-0" />
              <span>
                Meerdere of onzekere BAG-matches. Kies eerst het juiste BAG-adres voordat Kadaster wordt aangevraagd.
              </span>
            </div>
          ) : (bagStatus === 'verrijkt') ? (
            <>
              <p className="text-xs text-foreground" data-testid="precheck-bag-cijfers">
                BAG-precheck: {pandAantalVbo ?? 0} VBO{pandAantalVbo === 1 ? '' : "'s"}
                {pandTotaalOpp != null ? ` · ${pandTotaalOpp} m² totaal` : ''}
                {gebruiksdoelen.length ? ` · ${gebruiksdoelen.map((g) => g.charAt(0).toUpperCase() + g.slice(1)).join(', ')}` : ''}.
              </p>
              {(bouwjaar != null || pandStatus) && (
                <p className="text-xs text-foreground" data-testid="precheck-bag-pand">
                  {bouwjaar != null ? `Bouwjaar: ${bouwjaar}` : ''}
                  {bouwjaar != null && pandStatus ? ' · ' : ''}
                  {pandStatus ? `Pandstatus: ${pandStatus}` : ''}.
                </p>
              )}
              {gekozenAdres && (
                <p className="text-xs text-foreground" data-testid="precheck-doelobject">
                  Doelobject: {gekozenAdres}
                  {gekozenOpp != null ? ` · ${gekozenOpp} m²` : ''}.
                </p>
              )}
              {detailsOntbreken && (
                <p className="text-[11px] text-amber-900" data-testid="precheck-details-ontbreken">
                  BAG-detailgegevens beperkt opgehaald. Controleer BAG Viewer.
                </p>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              BAG-data nog niet beschikbaar. Verrijk eerst BAG via de Onderzoek-tab voor een betere pre-check.
            </p>
          )}

          {advies.niveau && (
            <p className="text-xs text-muted-foreground" data-testid="precheck-advies-reden">
              <span className="text-foreground">Kadasteradvies:</span> {advies.reden}
            </p>
          )}

          <p className="text-[11px] text-muted-foreground">
            Advies is informatief — Kadaster blijft altijd handmatig te bevestigen.
          </p>
        </div>
      </div>
    </div>
  );
}
