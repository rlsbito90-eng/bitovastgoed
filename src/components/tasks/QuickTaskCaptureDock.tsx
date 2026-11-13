import { useEffect, useState } from 'react';
import { Building2, CheckSquare2, Plus, Users, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import ObjectQuickCreateDialog from '@/components/forms/ObjectQuickCreateDialog';
import { QuickCreateRelationDialog } from '@/components/forms/QuickCreateRelationDialog';
import QuickTaskCapture from './QuickTaskCapture';

type QuickMode = 'closed' | 'menu' | 'task';

/**
 * Eén plek voor snel toevoegen. Hergebruikt bestaande create-dialogen en
 * laat de vaste invoerbalk op /taken zelf ongemoeid.
 */
export default function QuickTaskCaptureDock() {
  const location = useLocation();
  const navigate = useNavigate();
  const [mode, setMode] = useState<QuickMode>('closed');
  const [objectOpen, setObjectOpen] = useState(false);
  const [relationOpen, setRelationOpen] = useState(false);

  useEffect(() => {
    setMode('closed');
    setObjectOpen(false);
    setRelationOpen(false);
  }, [location.pathname]);

  if (location.pathname === '/taken' || location.pathname.startsWith('/taken/')) return null;

  return (
    <>
      <div
        data-testid="quick-task-capture-dock"
        className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-3 z-30 sm:left-auto sm:right-5 lg:bottom-5 lg:right-6"
      >
        {mode === 'task' ? (
          <div className="relative w-[min(94vw,620px)] rounded-[1.4rem]">
            <QuickTaskCapture defaultTarget="inbox" />
            <button
              type="button"
              onClick={() => setMode('closed')}
              aria-label="Snelle taakinvoer sluiten"
              className="absolute -right-2 -top-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-background/90 text-muted-foreground shadow-md hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative">
            {mode === 'menu' && (
              <div
                role="menu"
                aria-label="Snel toevoegen"
                data-testid="quick-create-menu"
                className="absolute bottom-[calc(100%+0.65rem)] left-0 w-48 rounded-xl border border-border bg-card p-1.5 shadow-xl sm:left-auto sm:right-0"
              >
                <button type="button" role="menuitem" onClick={() => setMode('task')} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-muted">
                  <CheckSquare2 className="h-4 w-4 text-muted-foreground" /> Taak
                </button>
                <button type="button" role="menuitem" onClick={() => { setMode('closed'); setObjectOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-muted">
                  <Building2 className="h-4 w-4 text-muted-foreground" /> Object
                </button>
                <button type="button" role="menuitem" onClick={() => { setMode('closed'); setRelationOpen(true); }} className="flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-muted">
                  <Users className="h-4 w-4 text-muted-foreground" /> Relatie
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => setMode(mode === 'menu' ? 'closed' : 'menu')}
              aria-label={mode === 'menu' ? 'Snelmenu sluiten' : 'Snel toevoegen'}
              aria-expanded={mode === 'menu'}
              className="acquisitie-selection-glass flex h-12 items-center gap-2 rounded-full px-4 text-sm font-medium text-foreground transition-transform hover:-translate-y-0.5"
            >
              {mode === 'menu' ? <X className="h-4 w-4 text-accent" /> : <Plus className="h-4 w-4 text-accent" />}
              <span>Nieuw</span>
            </button>
          </div>
        )}
      </div>
      <ObjectQuickCreateDialog open={objectOpen} onOpenChange={setObjectOpen} />
      <QuickCreateRelationDialog
        open={relationOpen}
        onOpenChange={setRelationOpen}
        context="algemeen"
        onCreated={(relatie) => {
          setRelationOpen(false);
          navigate(`/relaties/${relatie.id}`);
        }}
      />
    </>
  );
}
