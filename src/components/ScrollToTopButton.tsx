import { useEffect, useState, useRef } from 'react';
import { ArrowUp } from 'lucide-react';

const SCROLL_THRESHOLD = 400;

/**
 * App-brede scroll-to-top knop.
 * Detecteert of de scroll plaatsvindt op window of op de <main> container
 * (AppLayout gebruikt overflow-y-auto op <main>).
 */
export default function ScrollToTopButton() {
  const [zichtbaar, setZichtbaar] = useState(false);
  const containerRef = useRef<HTMLElement | Window | null>(null);

  useEffect(() => {
    const main = document.querySelector('main');
    // Kies de echte scroll container: main als die scrollbaar is, anders window
    const container: HTMLElement | Window =
      main && main.scrollHeight > main.clientHeight ? main : window;
    containerRef.current = container;

    const getScrollTop = () =>
      container === window
        ? window.scrollY || document.documentElement.scrollTop
        : (container as HTMLElement).scrollTop;

    const onScroll = () => setZichtbaar(getScrollTop() > SCROLL_THRESHOLD);

    onScroll();
    container.addEventListener('scroll', onScroll, { passive: true });
    // Re-check bij window resize (container kan veranderen op layout shifts)
    window.addEventListener('resize', onScroll);
    return () => {
      container.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const naarBoven = () => {
    const c = containerRef.current;
    if (!c) return;
    if (c === window) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      (c as HTMLElement).scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <button
      type="button"
      onClick={naarBoven}
      aria-label="Naar boven"
      className={`fixed bottom-5 right-5 sm:bottom-6 sm:right-6 z-40 h-11 w-11 sm:h-12 sm:w-12 rounded-full
        glass-fab text-primary-foreground
        flex items-center justify-center
        ring-1 ring-accent/30
        hover:scale-105 hover:ring-accent/60 active:scale-95
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/70
        transition-all duration-200 ease-out
        ${zichtbaar ? 'opacity-100 translate-y-0 pointer-events-auto' : 'opacity-0 translate-y-2 pointer-events-none'}
      `}
    >
      <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.25} />
    </button>
  );
}
