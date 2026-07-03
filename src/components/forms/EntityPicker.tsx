// src/components/forms/EntityPicker.tsx
//
// Herbruikbare zoekbare picker voor entiteiten (Relatie, Object, Deal).
// - Mobiel: bottom sheet (Sheet uit shadcn met side="bottom")
// - Desktop: gecentreerde Dialog met zoekveld
// - Trigger: een rustige "card" die de huidige selectie toont met
//   Wijzigen / Wissen acties, of Kiezen wanneer leeg.
//
// Items kunnen "recent" en "relevant" eerst tonen voor snellere selectie.
//
// -------------------------------------------------------------------------
// PII-policy (Fase 1C-1) — verplicht voor ALLE callers:
//   - `primair` en `secundair` tonen UITSLUITEND naam en/of bedrijfsnaam.
//   - E-mail, telefoon en adres mogen NOOIT in `primair`/`secundair` staan.
//   - E-mail/telefoon/adres mogen wel in `searchHaystack` staan als dat
//     functioneel nodig is voor zoeken (bijv. snel vinden op e-mailadres);
//     `searchHaystack` wordt nooit gerenderd.
//   - Voor relatie-items: bouw labels via `getRelatieNamen()` uit
//     `@/lib/relatieNaam`. Die helper is privacy-safe by design.
// -------------------------------------------------------------------------

import { useMemo, useState, useEffect, useRef } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, X, Check, Pencil, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface EntityPickerItem {
  id: string;
  /** Zichtbaar hoofdlabel. Mag GEEN e-mail, telefoon of adres bevatten. */
  primair: string;
  /** Zichtbaar sublabel. Mag GEEN e-mail, telefoon of adres bevatten. */
  secundair?: string | null;
  /**
   * Lowercase string waarin gezocht wordt. Wordt nooit gerenderd; mag
   * e-mail/telefoon/adres bevatten voor functioneel zoeken.
   */
  searchHaystack: string;
}

interface Props {
  /** Geselecteerd id of leeg */
  value: string;
  onChange: (id: string) => void;
  /** Alle beschikbare items */
  items: EntityPickerItem[];
  /** Label boven de trigger, bijv. "Relatie" */
  label: string;
  /** Titel binnen picker, bijv. "Kies relatie" */
  pickerTitle: string;
  /** Placeholder zoekveld */
  searchPlaceholder?: string;
  /** Wat te tonen als nog niets gekozen */
  emptyLabel?: string;
  /** Ids die als "relevant" bovenaan moeten verschijnen */
  relevantIds?: string[];
  relevantLabel?: string;
  /** Recent gebruikte ids */
  recentIds?: string[];
  /** Toon "Toon archief"-knop? Indien archivedItems gegeven. */
  archivedItems?: EntityPickerItem[];
  className?: string;
}

const norm = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '');

export default function EntityPicker({
  value,
  onChange,
  items,
  label,
  pickerTitle,
  searchPlaceholder = 'Zoeken…',
  emptyLabel = `Geen gekoppelde ${label.toLowerCase()}`,
  relevantIds = [],
  relevantLabel = 'Relevant',
  recentIds = [],
  archivedItems,
  className,
}: Props) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setShowArchived(false);
      // klein delay zodat sheet/dialog gerenderd is
      const t = setTimeout(() => inputRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  const selected = useMemo(
    () => items.find(i => i.id === value) ?? archivedItems?.find(i => i.id === value),
    [items, archivedItems, value],
  );

  const allItems = useMemo(() => {
    return showArchived && archivedItems ? [...items, ...archivedItems] : items;
  }, [items, archivedItems, showArchived]);

  const { relevant, recent, rest } = useMemo(() => {
    const q = norm(query.trim());
    const filtered = q
      ? allItems.filter(i => i.searchHaystack.includes(q))
      : allItems;

    const relevantSet = new Set(relevantIds);
    const recentSet = new Set(recentIds.filter(id => !relevantSet.has(id)));

    const relevant = filtered.filter(i => relevantSet.has(i.id));
    const recent = filtered.filter(i => recentSet.has(i.id));
    const rest = filtered.filter(i => !relevantSet.has(i.id) && !recentSet.has(i.id));
    return { relevant, recent, rest };
  }, [allItems, query, relevantIds, recentIds]);

  const handleSelect = (id: string) => {
    onChange(id);
    setOpen(false);
  };

  // ---- Trigger card ----
  const trigger = (
    <div className={cn('space-y-1.5', className)}>
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {label}
      </div>
      <div className="rounded-md border border-input bg-card px-3 py-2.5 flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {selected ? (
            <>
              <p className="text-sm font-medium text-foreground truncate">{selected.primair}</p>
              {selected.secundair && (
                <p className="text-xs text-muted-foreground truncate">{selected.secundair}</p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground italic">{emptyLabel}</p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {selected ? (
            <>
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1 px-2 py-1 text-xs text-foreground hover:bg-muted rounded transition-colors"
              >
                <Pencil className="h-3 w-3" /> Wijzigen
              </button>
              <button
                type="button"
                onClick={() => onChange('')}
                className="inline-flex items-center px-1.5 py-1 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded transition-colors"
                aria-label="Wissen"
                title="Wissen"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-accent-foreground bg-accent rounded hover:bg-accent/90 transition-colors"
            >
              <Plus className="h-3 w-3" /> Kiezen
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ---- Inner content (lijst) ----
  const renderItem = (item: EntityPickerItem) => {
    const isSel = item.id === value;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleSelect(item.id)}
        className={cn(
          'w-full text-left px-3 py-3 rounded-md transition-colors flex items-center gap-2 min-h-[44px]',
          isSel ? 'bg-accent/15 border border-accent/40' : 'hover:bg-muted border border-transparent',
        )}
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{item.primair}</p>
          {item.secundair && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{item.secundair}</p>
          )}
        </div>
        {isSel && <Check className="h-4 w-4 text-accent shrink-0" />}
      </button>
    );
  };

  const totalCount = relevant.length + recent.length + rest.length;

  const innerContent = (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-1 pb-3 shrink-0">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9 h-11"
          />
        </div>
        {value && (
          <button
            type="button"
            onClick={() => {
              onChange('');
              setOpen(false);
            }}
            className="mt-2 text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
          >
            <X className="h-3 w-3" /> Selectie wissen
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-1 space-y-3 pb-2">
        {totalCount === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">
            Geen resultaten{query ? ` voor "${query}"` : ''}.
          </p>
        )}

        {relevant.length > 0 && (
          <section>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {relevantLabel}
            </p>
            <div className="space-y-1">{relevant.map(renderItem)}</div>
          </section>
        )}

        {recent.length > 0 && (
          <section>
            <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Recent
            </p>
            <div className="space-y-1">{recent.map(renderItem)}</div>
          </section>
        )}

        {rest.length > 0 && (
          <section>
            {(relevant.length > 0 || recent.length > 0) && (
              <p className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Alle resultaten
              </p>
            )}
            <div className="space-y-1">{rest.map(renderItem)}</div>
          </section>
        )}

        {archivedItems && archivedItems.length > 0 && (
          <div className="pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setShowArchived(v => !v)}
              className="w-full text-center py-2 text-xs text-muted-foreground hover:text-foreground"
            >
              {showArchived ? 'Verberg archief' : `Toon archief (${archivedItems.length})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {trigger}
      {isMobile ? (
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="bottom" className="h-[85vh] flex flex-col p-4 sm:max-w-full">
            <SheetHeader className="text-left shrink-0">
              <SheetTitle>{pickerTitle}</SheetTitle>
            </SheetHeader>
            <div className="flex-1 min-h-0 mt-3">{innerContent}</div>
            <div className="shrink-0 pt-2 border-t border-border">
              <Button type="button" variant="outline" className="w-full" onClick={() => setOpen(false)}>
                Sluiten
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      ) : (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-lg p-0 gap-0">
            <DialogHeader className="px-4 pt-4 pb-2">
              <DialogTitle>{pickerTitle}</DialogTitle>
            </DialogHeader>
            <div className="px-3 pb-3" style={{ height: '60vh', display: 'flex', flexDirection: 'column' }}>
              {innerContent}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
