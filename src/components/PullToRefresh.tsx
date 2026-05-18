import { ReactNode, useEffect, useRef, useState } from 'react';
import { Loader2, ArrowDown, Check } from 'lucide-react';
import { useAppRefresh } from '@/hooks/useAppRefresh';
import { useIsMobile } from '@/hooks/use-mobile';

const DREMPEL = 70;       // px om refresh te triggeren
const MAX_TREK = 110;     // max visuele uitslag
const WEERSTAND = 0.5;    // pull weerstand

type Fase = 'idle' | 'trekken' | 'klaar_om_te_lossen' | 'vernieuwen' | 'gelukt';

/**
 * Pull-to-refresh wrapper voor het scrollende <main>-element.
 * - Alleen actief op mobiel
 * - Triggert alleen wanneer de scrollcontainer bovenaan staat
 * - Wordt uitgeschakeld als een modal/dialog/sheet/popover/dropdown open is
 */
export default function PullToRefresh({ children }: { children: ReactNode }) {
  const mobiel = useIsMobile();
  const { refresh, refreshing } = useAppRefresh();
  const containerRef = useRef<HTMLElement | null>(null);
  const startYRef = useRef<number | null>(null);
  const actiefRef = useRef(false);
  const [trek, setTrek] = useState(0);
  const [fase, setFase] = useState<Fase>('idle');

  // Externe refresh-state synchroniseren
  useEffect(() => {
    if (refreshing) setFase('vernieuwen');
  }, [refreshing]);

  useEffect(() => {
    if (!mobiel) return;
    const el = document.querySelector('main') as HTMLElement | null;
    if (!el) return;
    containerRef.current = el;

    const heeftOpenOverlay = () => {
      // Radix markeert open dialogs/sheets/popovers/dropdowns met data-state="open"
      const sel = [
        '[role="dialog"][data-state="open"]',
        '[role="alertdialog"][data-state="open"]',
        '[data-radix-popper-content-wrapper]',
        '[data-state="open"][role="menu"]',
      ].join(',');
      return !!document.querySelector(sel);
    };

    const onTouchStart = (e: TouchEvent) => {
      if (heeftOpenOverlay()) return;
      if (el.scrollTop > 0) return;
      if (e.touches.length !== 1) return;
      startYRef.current = e.touches[0].clientY;
      actiefRef.current = true;
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!actiefRef.current || startYRef.current === null) return;
      if (fase === 'vernieuwen') return;
      const dy = e.touches[0].clientY - startYRef.current;
      if (dy <= 0) {
        setTrek(0);
        setFase('idle');
        return;
      }
      // Alleen overnemen als we echt aan het trekken zijn
      if (dy > 6 && el.scrollTop <= 0) {
        e.preventDefault();
        const visueel = Math.min(MAX_TREK, dy * WEERSTAND);
        setTrek(visueel);
        setFase(visueel >= DREMPEL ? 'klaar_om_te_lossen' : 'trekken');
      }
    };

    const onTouchEnd = async () => {
      if (!actiefRef.current) return;
      actiefRef.current = false;
      startYRef.current = null;
      if (fase === 'klaar_om_te_lossen' || trek >= DREMPEL) {
        setFase('vernieuwen');
        setTrek(DREMPEL);
        try {
          await refresh();
          setFase('gelukt');
          setTimeout(() => {
            setFase('idle');
            setTrek(0);
          }, 700);
        } catch {
          setFase('idle');
          setTrek(0);
        }
      } else {
        setFase('idle');
        setTrek(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    el.addEventListener('touchcancel', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove as any);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [mobiel, fase, trek, refresh]);

  const zichtbaar = mobiel && (trek > 0 || fase === 'vernieuwen' || fase === 'gelukt');
  const label =
    fase === 'vernieuwen' ? 'Vernieuwen…' :
    fase === 'gelukt' ? 'Bijgewerkt' :
    fase === 'klaar_om_te_lossen' ? 'Loslaten om te vernieuwen' :
    'Trek omlaag om te vernieuwen';

  return (
    <>
      {zichtbaar && (
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 right-0 z-40 flex justify-center"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 76px)',
            transform: `translateY(${Math.min(trek, MAX_TREK) - 40}px)`,
            transition: fase === 'vernieuwen' || fase === 'gelukt' ? 'transform 200ms ease-out' : 'none',
          }}
        >
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-card border border-border shadow-sm text-xs text-muted-foreground">
            {fase === 'vernieuwen' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : fase === 'gelukt' ? (
              <Check className="h-3.5 w-3.5 text-success" />
            ) : (
              <ArrowDown
                className="h-3.5 w-3.5 transition-transform"
                style={{ transform: fase === 'klaar_om_te_lossen' ? 'rotate(180deg)' : 'none' }}
              />
            )}
            <span>{label}</span>
          </div>
        </div>
      )}
      {children}
    </>
  );
}
