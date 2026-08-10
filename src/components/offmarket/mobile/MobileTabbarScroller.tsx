// Mobiele tabbar-wrapper voor Off-Market signaaldetail.
// De mobiele tabbar is bewust NIET horizontaal scrollbaar: zes tabs staan
// altijd als een vaste 3x2 indeling binnen de beschikbare breedte.

interface Props {
  activeValue: string;
  children: React.ReactNode;
}

export default function MobileTabbarScroller({ activeValue: _activeValue, children }: Props) {
  return (
    <div
      data-testid="mobile-tabbar-scroller"
      className="relative w-full min-w-0 max-w-full overflow-hidden"
    >
      <div className="w-full min-w-0 max-w-full overflow-hidden">
        {children}
      </div>
    </div>
  );
}
