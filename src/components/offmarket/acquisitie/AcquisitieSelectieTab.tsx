// V1A — Tab-inhoud "Acquisitieselectie": compacte, persistente werklijst.
// V1: alleen tonen + open/verwijder. Geen readiness, bulkacties of brieven.
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Inbox, Sparkles } from 'lucide-react';
import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import {
  OffMarketStatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import { BagKaartBadge } from '@/components/offmarket/kaart/KaartSignaalBadges';
import {
  SIGNAALTYPE_LABEL, type OffMarketSignaal,
} from '@/lib/offMarket/types';
import { cleanAdres, cleanPlaats, formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import { Button } from '@/components/ui/button';
import ToevoegenAanAcquisitieSelectieKnop from './ToevoegenAanAcquisitieSelectieKnop';

function tekstType(s: OffMarketSignaal): string {
  return (SIGNAALTYPE_LABEL as Record<string, string>)[s.type_signaal] ?? s.type_signaal ?? '—';
}

export default function AcquisitieSelectieTab() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useAcquisitieSelectie();
  const { data: signalen = [] } = useOffMarketSignalen();

  const signaalIndex = useMemo(() => {
    const map = new Map<string, OffMarketSignaal>();
    for (const s of signalen) map.set(s.id, s);
    return map;
  }, [signalen]);

  const rijen = useMemo(() => {
    return items
      .map(item => ({ item, signaal: signaalIndex.get(item.signaal_id) ?? null }))
      .filter((r): r is { item: typeof items[number]; signaal: OffMarketSignaal } => !!r.signaal);
  }, [items, signaalIndex]);

  if (isLoading) {
    return <p className="px-5 py-10 text-sm text-muted-foreground">Selectie laden…</p>;
  }

  if (rijen.length === 0) {
    return (
      <section className="section-card px-5 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted/60 p-3">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium text-foreground">Nog geen signalen in selectie</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Voeg interessante signalen vanuit de signalenlijst, het signaaldetail of de
            kaartpopup toe aan de acquisitieselectie. De selectie blijft bewaard en is
            zichtbaar voor het hele team.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3" data-testid="acquisitie-selectie-tab">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-foreground">
          {rijen.length} signaal{rijen.length === 1 ? '' : 'en'} in selectie
        </h2>
      </div>

      {/* Lijst — werkt zowel op desktop als mobiel zonder horizontale scroll. */}
      <ul
        className="section-card divide-y divide-border/70"
        data-testid="acquisitie-selectie-lijst"
      >
        {rijen.map(({ item, signaal }) => {
          const adres = formatSignaalAdres(signaal) || cleanAdres(signaal.adres) || '—';
          const plaats = cleanPlaats(signaal.plaats) || '';
          const bagStatus = (signaal as unknown as { bag_status?: string | null }).bag_status ?? null;
          return (
            <li
              key={item.id}
              data-testid="acquisitie-selectie-rij"
              data-signaal-id={signaal.id}
              className="p-3 sm:p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm font-medium text-foreground break-words">{adres}</p>
                  {plaats && (
                    <p className="text-xs text-muted-foreground break-words">{plaats}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-muted/40 text-muted-foreground whitespace-nowrap">
                      {tekstType(signaal)}
                    </span>
                    <OffMarketStatusBadge status={signaal.status} />
                    {typeof signaal.ai_score === 'number' && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-card text-muted-foreground whitespace-nowrap">
                        <Sparkles className="h-3 w-3" /> AI {signaal.ai_score}
                      </span>
                    )}
                    {bagStatus && <BagKaartBadge signaal={signaal} size="sm" />}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => navigate(`/off-market/${signaal.id}`)}
                    data-testid="acquisitie-selectie-open"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Open signaal
                  </Button>
                  <ToevoegenAanAcquisitieSelectieKnop
                    signaalId={signaal.id}
                    variant="compact"
                    labelMode="remove"
                    isInSelectie
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
