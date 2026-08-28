import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import QuickTaskCapture, { type QuickTaskTarget } from './QuickTaskCapture';

function targetFromPath(pathname: string): QuickTaskTarget {
  if (pathname === '/taken') return 'today';
  return 'inbox';
}

export default function QuickTaskCaptureDock() {
  const location = useLocation();
  const [open, setOpen] = useState(location.pathname === '/taken');

  useEffect(() => {
    setOpen(location.pathname === '/taken');
  }, [location.pathname]);

  if (location.pathname.startsWith('/taken/')) return null;

  const target = targetFromPath(location.pathname);

  return (
    <div
      data-testid="quick-task-capture-dock"
      className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-3 z-30 w-[min(94vw,520px)] sm:right-5 lg:bottom-5 lg:right-6"
    >
      {open ? (
        <div className="relative rounded-xl shadow-lg shadow-black/10">
          <QuickTaskCapture defaultTarget={target} />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Snelle taakinvoer sluiten"
            className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground shadow-sm hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Snel taak toevoegen"
          className="ml-auto flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-sm font-medium text-foreground shadow-lg shadow-black/10 transition-transform hover:-translate-y-0.5"
        >
          <Plus className="h-4 w-4" />
          <span>Taak</span>
        </button>
      )}
    </div>
  );
}
