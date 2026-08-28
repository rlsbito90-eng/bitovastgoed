import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import QuickTaskCapture from './QuickTaskCapture';

export default function QuickTaskCaptureDock() {
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  // Taken heeft een eigen zwevende Quick Capture. Taakdetail blijft bewust rustig.
  if (location.pathname === '/taken' || location.pathname.startsWith('/taken/')) return null;

  return (
    <div
      data-testid="quick-task-capture-dock"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-30 sm:left-auto sm:right-5 lg:bottom-5 lg:right-6"
    >
      {open ? (
        <div className="relative w-[min(94vw,620px)] rounded-[1.4rem]">
          <QuickTaskCapture defaultTarget="inbox" />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Snelle taakinvoer sluiten"
            className="absolute -top-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-background/70 text-muted-foreground shadow-md backdrop-blur-xl hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Snel taak toevoegen"
          className="acquisitie-selection-glass flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium text-foreground transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4 text-accent" />
          <span>Taak</span>
        </button>
      )}
    </div>
  );
}
