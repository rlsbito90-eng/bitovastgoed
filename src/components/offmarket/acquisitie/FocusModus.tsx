// V1B — Focusmodus voor de Off-Market Acquisitieselectie.
// Eén signaal tegelijk; navigeren met Vorige/Overslaan/Volgende.
// Geen automatische wijzigingen. Geen Kadaster-/BAG-/AI-aanroep.
import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft, ChevronRight, ExternalLink, SkipForward,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  OffMarketStatusBadge, OffMarketAiStatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import { BagKaartBadge } from '@/components/offmarket/kaart/KaartSignaalBadges';
import {
  ReadinessBadge, WaarschuwingBadges,
} from './ReadinessBadge';
import { cleanAdres, cleanPlaats, formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import {
  SIGNAALTYPE_LABEL, type OffMarketSignaal,
} from '@/lib/offMarket/types';
import type { SignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';
import ToevoegenAanAcquisitieSelectieKnop from './ToevoegenAanAcquisitieSelectieKnop';

export interface FocusItem {
  signaal: OffMarketSignaal;
  readiness: SignaalReadiness;
}

interface Props {
  open: boolean;
  onClose: () => void;
  items: FocusItem[];
  index: number;
  onIndexChange: (i: number) => void;
}

function tekstType(s: OffMarketSignaal): string {
  return (SIGNAALTYPE_LABEL as Record<string, string>)[s.type_signaal] ?? s.type_signaal ?? '—';
}

export default function FocusModus({ open, onClose, items, index, onIndexChange }: Props) {
  const navigate = useNavigate();
  const veiligIndex = useMemo(() => {
    if (items.length === 0) return 0;
    if (index < 0) return 0;
    if (index >= items.length) return items.length - 1;
    return index;
  }, [items.length, index]);

  // Wanneer het huidige item verdwijnt (verwijderd uit selectie), open
  // het volgende beschikbare item. Wanneer de lijst leeg raakt: sluit.
  const vorigeLengte = useRef(items.length);
  useEffect(() => {
    if (!open) { vorigeLengte.current = items.length; return; }
    if (items.length === 0) {
      onClose();
    } else if (vorigeLengte.current > items.length && index >= items.length) {
      onIndexChange(Math.max(0, items.length - 1));
    }
    vorigeLengte.current = items.length;
  }, [items.length, index, open, onClose, onIndexChange]);

  if (!open || items.length === 0) return null;
  const huidig = items[veiligIndex];
  const { signaal, readiness } = huidig;
  const adres = formatSignaalAdres(signaal) || cleanAdres(signaal.adres) || '—';
  const plaats = cleanPlaats(signaal.plaats) || '';

  const goVorige = () => onIndexChange(Math.max(0, veiligIndex - 1));
  const goVolgende = () => onIndexChange(Math.min(items.length - 1, veiligIndex + 1));

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent
        data-testid="focus-modus"
        className="
          p-0 gap-0
          sm:max-w-2xl
          max-sm:!fixed max-sm:!inset-0 max-sm:!w-screen max-sm:!h-[100dvh]
          max-sm:!max-w-none max-sm:!translate-x-0 max-sm:!translate-y-0
          max-sm:!left-0 max-sm:!top-0 max-sm:!rounded-none
          flex flex-col overflow-hidden
        "
      >
        <DialogTitle className="sr-only">Verwerk selectie</DialogTitle>
        <DialogDescription className="sr-only">
          Focusmodus voor de acquisitieselectie. Behandel signalen één voor één.
        </DialogDescription>

        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border/60 bg-background/70 backdrop-blur">
          <div className="min-w-0 pr-8">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Focus · {veiligIndex + 1} van {items.length}
            </p>
            <h2 className="text-sm font-medium text-foreground truncate">Verwerk selectie</h2>
          </div>
        </div>

        {/* Scrollbare body — voldoende bottom-padding voor sticky footer */}
        <div
          className="flex-1 overflow-y-auto px-4 py-4 space-y-4"
          style={{ paddingBottom: 'calc(7.5rem + env(safe-area-inset-bottom))' }}
          data-testid="focus-body"
        >
          <section className="space-y-1.5">
            <p className="text-base font-medium text-foreground break-words">{adres}</p>
            {plaats && <p className="text-xs text-muted-foreground">{plaats}</p>}
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-muted/40 text-muted-foreground whitespace-nowrap">
                {tekstType(signaal)}
              </span>
              <OffMarketStatusBadge status={signaal.status} />
              <OffMarketAiStatusBadge status={signaal.ai_status} />
              {(signaal as any).bag_status && <BagKaartBadge signaal={signaal} size="sm" />}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <ReadinessBadge fase={readiness.fase} />
              <span className="text-xs text-muted-foreground">{readiness.info.reden}</span>
            </div>
            {readiness.blokkadeReden && (
              <p className="text-xs text-destructive" data-testid="focus-blokkade">
                {readiness.blokkadeReden}
              </p>
            )}
            <WaarschuwingBadges waarschuwingen={readiness.waarschuwingen} max={6} />
            <p className="text-xs text-muted-foreground">
              Volgende actie: <span className="text-foreground">{readiness.info.volgendeActie}</span>
            </p>
          </section>

          <section className="rounded-lg border border-border bg-card p-3 space-y-1.5">
            <p className="text-xs uppercase tracking-wide text-muted-foreground">
              Geadresseerden ({readiness.telling.totaal})
            </p>
            <ul className="space-y-1" data-testid="focus-geadresseerden">
              {readiness.geadresseerden.length === 0 && (
                <li className="text-xs text-muted-foreground">Nog geen geadresseerden bekend.</li>
              )}
              {readiness.geadresseerden.map(g => (
                <li key={g.key} className="text-xs text-foreground break-words">
                  <span className="font-medium">
                    {g.naam || g.bedrijfsnaam || '(onbekende geadresseerde)'}
                  </span>
                  {g.bedrijfsnaam && g.naam && (
                    <span className="text-muted-foreground"> — {g.bedrijfsnaam}</span>
                  )}
                  {!g.volledigPostadres && !g.heeftEmailVerzonden && (
                    <span className="ml-1 text-[10px] text-amber-700">· adres onvolledig</span>
                  )}
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 pt-1 text-[11px] text-muted-foreground">
              <span>Volledig adres: {readiness.telling.metVolledigAdres}</span>
              <span>Actief concept: {readiness.telling.metActiefConcept}</span>
              <span>Printklaar: {readiness.telling.gereedVoorPrint}</span>
              <span>Geprint/gepost: {readiness.telling.geprintOfGepost}</span>
            </div>
          </section>
        </div>

        {/* Sticky actiefooter */}
        <div
          data-testid="focus-footer"
          className="sticky bottom-0 left-0 right-0 border-t border-border/60 bg-background/85 backdrop-blur"
          style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
        >
          <div className="flex flex-wrap gap-2 px-4 py-3">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => navigate(
                `/off-market/${signaal.id}?tab=brieven`,
                { state: { fromAcquisitieFocus: true, focusIndex: veiligIndex } },
              )}
              data-testid="focus-open-signaal"
            >
              <ExternalLink className="h-4 w-4" />
              Open signaal
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goVorige}
              disabled={veiligIndex === 0}
              data-testid="focus-vorige"
            >
              <ChevronLeft className="h-4 w-4" />
              Vorige
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={goVolgende}
              disabled={veiligIndex >= items.length - 1}
              data-testid="focus-overslaan"
            >
              <SkipForward className="h-4 w-4" />
              Overslaan
            </Button>
            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={goVolgende}
              disabled={veiligIndex >= items.length - 1}
              data-testid="focus-volgende"
            >
              Volgende
              <ChevronRight className="h-4 w-4" />
            </Button>
            <ToevoegenAanAcquisitieSelectieKnop
              signaalId={signaal.id}
              variant="compact"
              labelMode="remove"
              isInSelectie
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
