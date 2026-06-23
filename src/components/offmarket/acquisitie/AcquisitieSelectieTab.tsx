// V1B — Tab-inhoud "Acquisitieselectie": persistente werklijst met
// afgeleide readiness, KPI's, filter en focusmodus. Geen bulkacties.
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Inbox, PlayCircle, Sparkles } from 'lucide-react';
import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { useAcquisitieReadiness } from '@/hooks/useAcquisitieReadiness';
import {
  OffMarketStatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import { BagKaartBadge } from '@/components/offmarket/kaart/KaartSignaalBadges';
import {
  SIGNAALTYPE_LABEL, type OffMarketSignaal,
} from '@/lib/offMarket/types';
import { cleanAdres, cleanPlaats, formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import { Button } from '@/components/ui/button';
import ToevoegenAanAcquisitieSelectieKnop from './ToevoegenAanAcquisitieSelectieKnop';
import AcquisitieKpis from './AcquisitieKpis';
import AcquisitieFilterChips from './AcquisitieFilterChips';
import { ReadinessBadge, WaarschuwingBadges } from './ReadinessBadge';
import FocusModus from './FocusModus';
import {
  pastInFilter, type SelectieFilter,
} from '@/lib/offMarket/acquisitie/readiness';

function tekstType(s: OffMarketSignaal): string {
  return (SIGNAALTYPE_LABEL as Record<string, string>)[s.type_signaal] ?? s.type_signaal ?? '—';
}

const FILTER_KEY = 'off-market-acq:filter';
const FOCUS_INDEX_KEY = 'off-market-acq:focus-index';
const SCROLL_KEY = 'off-market-acq:scroll';

export default function AcquisitieSelectieTab() {
  const navigate = useNavigate();
  const { data: items = [], isLoading } = useAcquisitieSelectie();
  const { data: signalen = [] } = useOffMarketSignalen();

  const signaalIndex = useMemo(() => {
    const map = new Map<string, OffMarketSignaal>();
    for (const s of signalen) map.set(s.id, s);
    return map;
  }, [signalen]);

  // Stabiele volgorde: toegevoegd_op ASC zoals gevraagd voor focusmodus.
  const geselecteerdeSignalen = useMemo<OffMarketSignaal[]>(() => {
    const lijst = [...items].sort((a, b) =>
      (a.toegevoegd_op ?? '').localeCompare(b.toegevoegd_op ?? ''),
    );
    return lijst
      .map(it => signaalIndex.get(it.signaal_id))
      .filter((s): s is OffMarketSignaal => !!s);
  }, [items, signaalIndex]);

  const readiness = useAcquisitieReadiness(geselecteerdeSignalen);

  const [filter, setFilterState] = useState<SelectieFilter>(() => {
    try {
      const v = sessionStorage.getItem(FILTER_KEY) as SelectieFilter | null;
      return v ?? 'alles';
    } catch { return 'alles'; }
  });
  const setFilter = (f: SelectieFilter) => {
    setFilterState(f);
    try { sessionStorage.setItem(FILTER_KEY, f); } catch {}
  };

  const gefilterd = useMemo(() => {
    return readiness.lijst.filter(({ readiness: r }) => pastInFilter(r, filter));
  }, [readiness.lijst, filter]);

  const filterCounts = useMemo(() => {
    const out: Record<SelectieFilter, number> = {
      alles: readiness.lijst.length,
      geblokkeerd: 0, brief_voorbereiden: 0, printklaar: 0, opvolging: 0,
    };
    for (const { readiness: r } of readiness.lijst) {
      if (r.info.status === 'geblokkeerd') out.geblokkeerd += 1;
      if (r.fase === 'brief_voorbereiden' || r.fase === 'concept_gereed') out.brief_voorbereiden += 1;
      if (r.fase === 'gereed_voor_print') out.printklaar += 1;
      if (r.fase === 'opvolging_open') out.opvolging += 1;
    }
    return out;
  }, [readiness.lijst]);

  // Focusmodus
  const [focusOpen, setFocusOpen] = useState(false);
  const [focusIndex, setFocusIndexState] = useState<number>(() => {
    try {
      const v = sessionStorage.getItem(FOCUS_INDEX_KEY);
      return v ? Math.max(0, parseInt(v, 10) || 0) : 0;
    } catch { return 0; }
  });
  const setFocusIndex = (i: number) => {
    setFocusIndexState(i);
    try { sessionStorage.setItem(FOCUS_INDEX_KEY, String(i)); } catch {}
  };

  // Restore scrollpositie bij terugkeer
  useEffect(() => {
    try {
      const v = sessionStorage.getItem(SCROLL_KEY);
      if (v) window.scrollTo({ top: parseInt(v, 10) || 0 });
    } catch {}
  }, []);
  useEffect(() => {
    const onScroll = () => {
      try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch {}
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openVerwerk = () => {
    const startIdx = readiness.lijst.findIndex(({ readiness: r }) =>
      r.info.status !== 'afgehandeld');
    const idx = startIdx >= 0 ? startIdx : 0;
    setFocusIndex(idx);
    setFocusOpen(true);
  };

  const openVerwerkVanSignaal = (signaalId: string) => {
    const idx = readiness.lijst.findIndex(x => x.signaal.id === signaalId);
    if (idx >= 0) {
      setFocusIndex(idx);
      setFocusOpen(true);
    }
  };

  if (isLoading) {
    return <p className="px-5 py-10 text-sm text-muted-foreground">Selectie laden…</p>;
  }

  if (geselecteerdeSignalen.length === 0) {
    return (
      <section className="section-card px-5 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted/60 p-3">
            <Inbox className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="text-base font-medium text-foreground">Nog geen signalen in selectie</h3>
          <p className="max-w-md text-sm text-muted-foreground">
            Voeg interessante signalen vanuit de signalenlijst, het signaaldetail of de
            kaartpopup toe aan de acquisitieselectie. De selectie blijft bewaard en is
            zichtbaar voor het hele team.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-3" data-testid="acquisitie-selectie-tab">
      <AcquisitieKpis kpis={readiness.kpis} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AcquisitieFilterChips value={filter} onChange={setFilter} counts={filterCounts} />
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={openVerwerk}
          data-testid="acquisitie-verwerk-selectie"
          disabled={readiness.lijst.length === 0}
        >
          <PlayCircle className="h-4 w-4" />
          Verwerk selectie
        </Button>
      </div>

      {gefilterd.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1 py-4">
          Geen signalen in dit filter.
        </p>
      ) : (
        <ul
          className="section-card divide-y divide-border/70"
          data-testid="acquisitie-selectie-lijst"
        >
          {gefilterd.map(({ signaal, readiness: r }) => {
            const adres = formatSignaalAdres(signaal) || cleanAdres(signaal.adres) || '—';
            const plaats = cleanPlaats(signaal.plaats) || '';
            return (
              <li
                key={signaal.id}
                data-testid="acquisitie-selectie-rij"
                data-signaal-id={signaal.id}
                data-fase={r.fase}
                className="p-3 sm:p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="text-sm font-medium text-foreground break-words">{adres}</p>
                    {plaats && (
                      <p className="text-xs text-muted-foreground break-words">{plaats}</p>
                    )}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <ReadinessBadge fase={r.fase} />
                      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-muted/40 text-muted-foreground whitespace-nowrap">
                        {tekstType(signaal)}
                      </span>
                      <OffMarketStatusBadge status={signaal.status} />
                      {typeof signaal.ai_score === 'number' && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-card text-muted-foreground whitespace-nowrap">
                          <Sparkles className="h-3 w-3" /> AI {signaal.ai_score}
                        </span>
                      )}
                      {(signaal as any).bag_status && <BagKaartBadge signaal={signaal} size="sm" />}
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {r.telling.totaal} geadr.
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground break-words">
                      {r.blokkadeReden ?? r.info.reden}
                    </p>
                    <WaarschuwingBadges waarschuwingen={r.waarschuwingen} />
                  </div>
                  <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:shrink-0">
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => navigate(`/off-market/${signaal.id}`)}
                      data-testid="acquisitie-selectie-open"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      Open signaal
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      onClick={() => openVerwerkVanSignaal(signaal.id)}
                      data-testid="acquisitie-selectie-verwerk"
                    >
                      <PlayCircle className="h-3.5 w-3.5" />
                      Verwerk
                    </Button>
                    <ToevoegenAanAcquisitieSelectieKnop
                      signaalId={signaal.id}
                      variant="compact"
                      labelMode="remove"
                      isInSelectie
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <FocusModus
        open={focusOpen}
        onClose={() => setFocusOpen(false)}
        items={readiness.lijst}
        index={focusIndex}
        onIndexChange={setFocusIndex}
      />
    </section>
  );
}
