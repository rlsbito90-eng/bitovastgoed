import { useEffect, useMemo, useState } from 'react';
import { Building2, Check, ChevronDown, Link2, Search, UsersRound } from 'lucide-react';
import { useDataStore } from '@/hooks/useDataStore';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { getRelatieNamen, getRelatieNaamCompact } from '@/lib/relatieNaam';
import type { TaskLinkEntityType } from '@/lib/tasks/links';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';

export type TaskLinkSelection = Record<TaskLinkEntityType, string[]>;

export const EMPTY_TASK_LINK_SELECTION: TaskLinkSelection = {
  relatie: [], deal: [], object: [], signaal: [],
};

export function countTaskLinks(value: TaskLinkSelection): number {
  return Object.values(value).reduce((sum, ids) => sum + ids.length, 0);
}

export function taskLinkSelectionFromLegacy(input: {
  relatieId?: string | null;
  dealId?: string | null;
  objectId?: string | null;
  offMarketSignaalId?: string | null;
}): TaskLinkSelection {
  return {
    relatie: input.relatieId ? [input.relatieId] : [],
    deal: input.dealId ? [input.dealId] : [],
    object: input.objectId ? [input.objectId] : [],
    signaal: input.offMarketSignaalId ? [input.offMarketSignaalId] : [],
  };
}

/**
 * Vervang alleen de primaire koppeling. Aanvullende koppelingen blijven bestaan.
 */
export function replacePrimaryTaskLink(
  selection: TaskLinkSelection,
  type: TaskLinkEntityType,
  id: string,
): TaskLinkSelection {
  const previous = selection[type];
  if (id === previous[0]) return selection;
  const additional = previous.slice(1).filter(existing => existing !== id);
  return {
    ...selection,
    [type]: id ? [id, ...additional] : additional,
  };
}

type ChoiceRow = {
  id: string;
  title: string;
  subtitle: string | null;
  search: string;
};
type ChoiceGroup = { label: string; rows: ChoiceRow[] };

function cloneSelection(value: TaskLinkSelection): TaskLinkSelection {
  return {
    relatie: [...value.relatie], object: [...value.object],
    deal: [...value.deal], signaal: [...value.signaal],
  };
}
function firstTab(value: TaskLinkSelection): TaskLinkEntityType {
  if (value.object.length) return 'object';
  if (value.relatie.length) return 'relatie';
  if (value.deal.length) return 'deal';
  if (value.signaal.length) return 'signaal';
  return 'object';
}
/** Geselecteerde items staan vooraan, maar zoeken blijft mogelijk over de hele dataset. */
export function visibleTaskLinkRows(
  rows: ChoiceRow[], selected: string[], query: string, limit = 70,
): ChoiceRow[] {
  const q = query.trim().toLocaleLowerCase('nl-NL');
  const selectedSet = new Set(selected);
  const matches = rows.filter(row => !q || row.search.toLocaleLowerCase('nl-NL').includes(q));
  const chosen = matches.filter(row => selectedSet.has(row.id));
  const remaining = matches.filter(row => !selectedSet.has(row.id));
  return [...chosen, ...remaining.slice(0, Math.max(0, limit - chosen.length))];
}

export default function TaskLinksPickerDialog({
  open, onOpenChange, value, onChange,
  title = 'Koppelingen kiezen', onConfirm, confirming = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: TaskLinkSelection;
  onChange: (next: TaskLinkSelection) => void;
  title?: string;
  onConfirm?: (selection: TaskLinkSelection) => void;
  confirming?: boolean;
}) {
  const { relaties, deals, objecten, getObjectById, getRelatieById, contactpersonen } = useDataStore();
  const { data: signalen = [] } = useOffMarketSignalen();
  const [draft, setDraft] = useState<TaskLinkSelection>(() => cloneSelection(value));
  const [activeTab, setActiveTab] = useState<TaskLinkEntityType>(() => firstTab(value));
  const [query, setQuery] = useState('');

  // Een popup is een afzonderlijke bewerksessie: sluiten zonder toepassen wijzigt niets.
  useEffect(() => {
    if (open) {
      setDraft(cloneSelection(value));
      setActiveTab(firstTab(value));
      setQuery('');
    }
    // De popup wordt op alle drie plekken opnieuw gemount bij openen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const groups = useMemo<Record<TaskLinkEntityType, ChoiceGroup>>(() => ({
    object: {
      label: 'Objecten',
      rows: objecten.map((o: any) => {
        const title = o.titel || o.adres || o.straat || 'Object zonder titel';
        const detail = [o.adres && o.adres !== title ? o.adres : null,
          o.plaats && !String(title).toLowerCase().includes(String(o.plaats).toLowerCase()) ? o.plaats : null]
          .filter(Boolean).join(' · ');
        return {
          id: o.id, title, subtitle: detail || null,
          search: [title, o.adres, o.straat, o.plaats, o.internReferentienummer].filter(Boolean).join(' '),
        };
      }),
    },
    relatie: {
      label: 'Relaties',
      rows: relaties.map((r: any) => {
        const { primair, secundair } = getRelatieNamen(r, contactpersonen);
        return {
          id: r.id, title: primair, subtitle: secundair,
          search: [primair, secundair, getRelatieNaamCompact(r, contactpersonen),
            ...contactpersonen.filter(c => c.relatieId === r.id).map(c => c.naam)]
            .filter(Boolean).join(' '),
        };
      }),
    },
    deal: {
      label: 'Deals',
      rows: deals.map((d: any) => {
        const object = getObjectById(d.objectId);
        const title = object?.titel || object?.adres || d.titel || 'Deal';
        const relation = getRelatieById(d.relatieId);
        const relationName = relation ? getRelatieNaamCompact(relation, contactpersonen) : null;
        const subtitle = [relationName, d.fase].filter(Boolean).join(' · ');
        return {
          id: d.id, title, subtitle: subtitle || null,
          search: [title, subtitle, object?.adres, object?.plaats].filter(Boolean).join(' '),
        };
      }),
    },
    signaal: {
      label: 'Radar-signalen',
      rows: signalen.map((s: any) => {
        const title = s.titel || s.adres || s.omschrijving || 'Radar-signaal';
        const subtitle = s.adres && title !== s.adres ? s.adres : (s.plaats || null);
        return { id: s.id, title, subtitle,
          search: [title, s.adres, s.plaats, s.omschrijving].filter(Boolean).join(' ') };
      }),
    },
  }), [relaties, deals, objecten, signalen, getObjectById, getRelatieById, contactpersonen]);

  const chosen = draft[activeTab];
  const total = countTaskLinks(draft);
  const rows = visibleTaskLinkRows(groups[activeTab].rows, chosen, query);
  const searchMatches = groups[activeTab].rows.filter(row =>
    !query.trim() || row.search.toLocaleLowerCase('nl-NL').includes(query.trim().toLocaleLowerCase('nl-NL')),
  ).length;
  const secondaryTab = activeTab === 'deal' || activeTab === 'signaal';

  function changeTab(tab: TaskLinkEntityType) {
    setActiveTab(tab);
    setQuery('');
  }
  function toggle(id: string) {
    setDraft(prev => {
      const current = prev[activeTab];
      return {
        ...prev,
        [activeTab]: current.includes(id) ? current.filter(x => x !== id) : [...current, id],
      };
    });
  }
  function apply() {
    if (confirming) return;
    const next = cloneSelection(draft);
    onChange(next);
    if (onConfirm) onConfirm(next);
    else onOpenChange(false);
  }

  const tabStyle = (selected: boolean) =>
    'min-h-11 flex-1 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
    (selected ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground');

  return (
    <Dialog open={open} onOpenChange={next => { if (!confirming) onOpenChange(next); }}>
      <DialogContent
        className="flex h-[min(88dvh,780px)] w-[calc(100vw-1rem)] max-w-lg flex-col gap-0 overflow-hidden p-0 sm:w-full"
        style={{ paddingBottom: 0 }}
      >
        <DialogHeader className="shrink-0 border-b border-border/60 px-4 pb-3 pt-5 sm:px-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            Selecteer de objecten en relaties die bij deze taak horen.
          </DialogDescription>
        </DialogHeader>

        <div className="shrink-0 space-y-3 border-b border-border/60 px-4 py-3 sm:px-5">
          <div className="flex rounded-xl bg-muted/55 p-1" role="tablist" aria-label="Soort koppeling">
            <button type="button" role="tab" aria-selected={activeTab === 'object'}
              onClick={() => changeTab('object')} className={tabStyle(activeTab === 'object')}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <Building2 className="h-4 w-4" /> Objecten
              </span>
            </button>
            <button type="button" role="tab" aria-selected={activeTab === 'relatie'}
              onClick={() => changeTab('relatie')} className={tabStyle(activeTab === 'relatie')}>
              <span className="inline-flex items-center justify-center gap-1.5">
                <UsersRound className="h-4 w-4" /> Relaties
              </span>
            </button>
            <button type="button" role="tab" aria-selected={secondaryTab}
              onClick={() => changeTab(secondaryTab ? activeTab : 'deal')}
              className={tabStyle(secondaryTab)}>
              <span className="inline-flex items-center justify-center gap-1">
                Meer <ChevronDown className="h-3.5 w-3.5" />
              </span>
            </button>
          </div>
          {secondaryTab && (
            <div className="flex gap-2" aria-label="Overige koppelingen">
              <button type="button" onClick={() => changeTab('deal')}
                aria-pressed={activeTab === 'deal'}
                className={'min-h-9 rounded-lg border px-3 text-xs ' +
                  (activeTab === 'deal' ? 'border-accent/60 bg-accent/10 font-medium' : 'border-border/70')}>
                Deals
              </button>
              <button type="button" onClick={() => changeTab('signaal')}
                aria-pressed={activeTab === 'signaal'}
                className={'min-h-9 rounded-lg border px-3 text-xs ' +
                  (activeTab === 'signaal' ? 'border-accent/60 bg-accent/10 font-medium' : 'border-border/70')}>
                Radar-signalen
              </button>
            </div>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={event => setQuery(event.target.value)}
              aria-label={'Zoek ' + groups[activeTab].label.toLowerCase()}
              placeholder={'Zoek binnen ' + groups[activeTab].label.toLowerCase() + '…'}
              className="h-11 w-full rounded-xl border border-border bg-background/55 pl-9 pr-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 sm:px-4"
          role="tabpanel" aria-label={groups[activeTab].label}>
          <div className="flex items-center justify-between px-2 pb-2">
            <span className="text-xs font-medium text-muted-foreground">
              {groups[activeTab].label}
            </span>
            <span className="text-xs text-muted-foreground">
              {searchMatches} beschikbaar · {chosen.length} geselecteerd
            </span>
          </div>
          {rows.length ? (
            <div className="space-y-1.5">
              {rows.map(row => {
                const selected = chosen.includes(row.id);
                return (
                  <button key={row.id} type="button" role="checkbox" aria-checked={selected}
                    aria-label={row.title} disabled={confirming}
                    onClick={() => toggle(row.id)}
                    className={'flex min-h-14 w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ' +
                      (selected ? 'border-accent/55 bg-accent/10' : 'border-border/60 bg-background/25 hover:bg-muted/40')}>
                    <span className="min-w-0 flex-1">
                      <span className="block break-words text-sm font-medium text-foreground">{row.title}</span>
                      {row.subtitle && (
                        <span className="mt-0.5 block break-words text-xs text-muted-foreground">{row.subtitle}</span>
                      )}
                    </span>
                    <span aria-hidden="true" className={'flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ' +
                      (selected ? 'border-accent bg-accent text-accent-foreground' : 'border-muted-foreground/50')}>
                      {selected && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </button>
                );
              })}
              {searchMatches > rows.length && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Zoek op naam of adres om meer resultaten te vinden.
                </p>
              )}
            </div>
          ) : (
            <div className="px-3 py-12 text-center text-sm text-muted-foreground">
              {query ? 'Geen resultaten gevonden. Probeer een andere zoekterm.' : 'Geen koppelingen beschikbaar.'}
            </div>
          )}
        </div>

        <div className="z-10 flex shrink-0 items-center gap-2 border-t border-border bg-background px-4 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))] sm:px-5">
          <span className="mr-auto hidden text-xs text-muted-foreground sm:inline">{total} geselecteerd</span>
          <button type="button" disabled={confirming} onClick={() => onOpenChange(false)}
            className="min-h-11 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted/40">
            Annuleren
          </button>
          <button type="button" disabled={confirming} onClick={apply}
            className="min-h-11 min-w-0 flex-1 rounded-xl bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-60 sm:flex-none">
            {confirming ? 'Opslaan…' : 'Toepassen · ' + total}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
