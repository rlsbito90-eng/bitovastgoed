import { useCallback, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Calculator, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { VR_STATUS_LABELS, VR_STRATEGY_LABELS } from '@/lib/vastgoedrekenen/defaults';
import { buildQuickscanObjectHref } from '@/lib/vastgoedrekenen/quickscanNavigation';
import { formatLaatsteActiviteit, type OverviewCalculation } from './types';

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{children}</span>
  );
}

function PreviewInhoud({ item, onClose }: { item: OverviewCalculation; onClose?: () => void }) {
  return (
    <div className="space-y-4" data-testid="vr-case-preview">
      <div className="space-y-1">
        <p className="text-sm font-medium">{item.object_naam}</p>
        <p className="text-xs text-muted-foreground">{item.calculation_name}</p>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Chip>{VR_STATUS_LABELS[item.status]}</Chip>
        <Chip>{VR_STRATEGY_LABELS[item.main_strategy]}</Chip>
        <Chip>Betrouwbaarheid: {item.input_reliability}</Chip>
      </div>
      <dl className="space-y-1 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-muted-foreground">Laatste activiteit</dt>
          <dd>{formatLaatsteActiviteit(item.latest_activity_at)}</dd>
        </div>
      </dl>
      <div className="flex flex-col gap-2">
        <Button asChild data-testid="vr-preview-open-case">
          <Link to={buildQuickscanObjectHref(item.object_id, item.id)}>Open volledige case</Link>
        </Button>
        <Button asChild variant="outline" data-testid="vr-preview-open-object">
          <Link to={`/objecten/${item.object_id}`}>Open object</Link>
        </Button>
      </div>
      {onClose && (
        <Button variant="ghost" size="sm" className="w-full" onClick={onClose}>
          Sluiten
        </Button>
      )}
    </div>
  );
}

export default function ProjectenCasesSectie({ items }: { items: OverviewCalculation[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const selected = items.find((item) => item.id === selectedId) ?? null;

  const sluit = useCallback(() => {
    const id = selectedId;
    setSelectedId(null);
    if (id) requestAnimationFrame(() => rowRefs.current[id]?.focus());
  }, [selectedId]);

  if (items.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <Calculator className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nog geen berekeningen. Open een object en ga naar het tabblad "Vastgoedrekenen".
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex gap-4">
      <div className="min-w-0 flex-1">
        <Card>
          <CardContent className="p-0">
            <ul className="divide-y divide-border/60" data-testid="vr-case-lijst">
              {items.map((item) => {
                const actief = item.id === selectedId;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      ref={(el) => {
                        rowRefs.current[item.id] = el;
                      }}
                      aria-current={actief ? 'true' : undefined}
                      data-testid={`vr-case-rij-${item.id}`}
                      onClick={() => setSelectedId(item.id)}
                      className={`w-full px-4 py-3 text-left transition-colors hover:bg-muted/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 ${
                        actief ? 'bg-muted/60' : ''
                      }`}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                        <span className="text-sm font-medium">{item.object_naam}</span>
                        <span className="text-[11px] text-muted-foreground">
                          {formatLaatsteActiviteit(item.latest_activity_at)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item.calculation_name}</p>
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        <Chip>{VR_STATUS_LABELS[item.status]}</Chip>
                        <Chip>{VR_STRATEGY_LABELS[item.main_strategy]}</Chip>
                        <Chip>Betrouwbaarheid: {item.input_reliability}</Chip>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Desktop previewpaneel */}
      {selected && !isMobile && (
        <aside className="hidden w-80 shrink-0 lg:block">
          <Card className="sticky top-4">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
                <Button variant="ghost" size="icon" aria-label="Preview sluiten" onClick={sluit}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <PreviewInhoud item={selected} />
            </CardContent>
          </Card>
        </aside>
      )}

      {/* Mobiel previewpaneel */}
      <Sheet open={Boolean(selected) && isMobile} onOpenChange={(open) => (open ? null : sluit())}>
        <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto">
          <SheetHeader className="text-left">
            <SheetTitle>Preview</SheetTitle>
          </SheetHeader>
          {selected && <PreviewInhoud item={selected} />}
        </SheetContent>
      </Sheet>
    </div>
  );
}
