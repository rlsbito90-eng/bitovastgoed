// Mobiele tabbar-wrapper voor Off-Market signaaldetail.
// Voegt een subtiele edge-fade en automatische "actieve tab in beeld"-scroll toe
// rond een bestaande TabsList. Behoudt de bestaande .glass-tabbar/.glass-tab-pill
// styling — alleen presentatie, geen tabsstate-wijziging.
import { useEffect, useRef } from 'react';

interface Props {
  activeValue: string;
  children: React.ReactNode;
}

export default function MobileTabbarScroller({ activeValue, children }: Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const trigger = root.querySelector<HTMLElement>(`[role="tab"][data-state="active"]`);
    if (trigger && typeof trigger.scrollIntoView === 'function') {
      // 'nearest' inline scroll houdt de actieve tab in beeld zonder hard te springen.
      trigger.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
    }
  }, [activeValue]);

  return (
    <div
      ref={ref}
      data-testid="mobile-tabbar-scroller"
      className="relative -mx-1"
      style={{
        WebkitMaskImage:
          'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 12px), transparent 100%)',
        maskImage:
          'linear-gradient(to right, transparent 0, black 12px, black calc(100% - 12px), transparent 100%)',
      }}
    >
      <div className="overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}
