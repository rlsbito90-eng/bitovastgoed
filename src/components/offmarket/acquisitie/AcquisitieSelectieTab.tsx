// V1B+V2 — Tab-inhoud "Acquisitieselectie": persistente werklijst met
// afgeleide readiness, KPI's, filter, focusmodus en (V2) bulkvoorbereiding
// van fysieke brieven + gecombineerde brief-PDF.
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ExternalLink, FileDown, Inbox, Mail, PlayCircle, Printer, Send, Sparkles, Tag, Users,
} from 'lucide-react';
import { useAcquisitieSelectie } from '@/hooks/useAcquisitieSelectie';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import {
  useAcquisitieReadiness, useBrievenVoorSignalen,
} from '@/hooks/useAcquisitieReadiness';
import StatusWijzigDropdown from '@/components/offmarket/overzicht/StatusWijzigDropdown';
import PrioriteitWijzigDropdown from '@/components/offmarket/cockpit/PrioriteitWijzigDropdown';
import EigenaarstatusWijzigDropdown from '@/components/offmarket/cockpit/EigenaarstatusWijzigDropdown';
import SignaalBriefStatusBadge from '@/components/offmarket/SignaalBriefStatusBadge';
import { bepaalBriefStatus, type BriefStatus } from '@/lib/offMarket/briefStatus';
import { groepeerBrievenPerGeadresseerde } from '@/lib/offMarket/brieven/groepering';
import { useDataStore } from '@/hooks/useDataStore';
import type { OffMarketEigenaarstatus } from '@/lib/offMarket/types';
import { BagKaartBadge } from '@/components/offmarket/kaart/KaartSignaalBadges';
import {
  SIGNAALTYPE_LABEL, type OffMarketSignaal,
} from '@/lib/offMarket/types';
import { cleanAdres, cleanPlaats, formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import ToevoegenAanAcquisitieSelectieKnop from './ToevoegenAanAcquisitieSelectieKnop';
import AcquisitieKpis from './AcquisitieKpis';
import AcquisitieFilterChips from './AcquisitieFilterChips';
import { ReadinessBadge, WaarschuwingBadges } from './ReadinessBadge';
import FocusModus from './FocusModus';
import BulkBriefVoorbereidenWizard from './BulkBriefVoorbereidenWizard';
import GecombineerdeBrievenPdfDialog from './GecombineerdeBrievenPdfDialog';
import AdreslabelsPdfDialog from './AdreslabelsPdfDialog';
import MarkeerBulkDialog, { type MarkeerModus } from './MarkeerBulkDialog';
import {
  pastInFilter, type SelectieFilter,
} from '@/lib/offMarket/acquisitie/readiness';
import { bouwKandidatenVoorSignaal } from '@/lib/offMarket/acquisitie/bulkBrief';

function tekstType(s: OffMarketSignaal): string {
  return (SIGNAALTYPE_LABEL as Record<string, string>)[s.type_signaal] ?? s.type_signaal ?? '—';
}

const FILTER_KEY = 'off-market-acq:filter';
const FOCUS_INDEX_KEY = 'off-market-acq:focus-index';
const SCROLL_KEY = 'off-market-acq:scroll';

export default function AcquisitieSelectieTab() {
  const navigate = useNavigate();
  const location = useLocation();
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

  const toegevoegdOpPerSignaal = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const it of items) m.set(it.signaal_id, it.toegevoegd_op ?? null);
    return m;
  }, [items]);

  const readiness = useAcquisitieReadiness(geselecteerdeSignalen);

  // Bulk-brieven query — al bulk gefetcht door readiness, maar we hebben de
  // brieven hier nodig voor plan/dedupe en gecombineerde PDF.
  const signaalIds = useMemo(() => geselecteerdeSignalen.map(s => s.id), [geselecteerdeSignalen]);
  const { data: brieven = [] } = useBrievenVoorSignalen(signaalIds);

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

  // ---- Bulk-selectie per signaal ---------------------------------------
  const [bulkSelectie, setBulkSelectie] = useState<Set<string>>(new Set());
  const toggleBulk = (id: string) => {
    setBulkSelectie(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const brievenPerSignaal = useMemo(() => {
    const m = new Map<string, typeof brieven>();
    for (const b of brieven) {
      const arr = m.get(b.signaal_id) ?? [];
      arr.push(b);
      m.set(b.signaal_id, arr);
    }
    return m;
  }, [brieven]);

  // Briefstatus + verzendtelling per signaal (read-only afgeleid).
  const { taken } = useDataStore();
  const briefInfoPerSignaal = useMemo(() => {
    const m = new Map<string, { status: BriefStatus; verzonden: number; aantalGeadresseerden: number }>();
    for (const s of geselecteerdeSignalen) {
      const bs = brievenPerSignaal.get(s.id) ?? [];
      const status = bepaalBriefStatus(bs, taken as any, s.id);
      const groepen = groepeerBrievenPerGeadresseerde(bs.filter(b => !b.archived_at));
      const verzonden = groepen.filter(g => g.brieven.some(b => b.status === 'verstuurd')).length;
      m.set(s.id, { status, verzonden, aantalGeadresseerden: groepen.length });
    }
    return m;
  }, [geselecteerdeSignalen, brievenPerSignaal, taken]);

  // Tellingen voor de bulktoolbar: signalen, geadresseerden, voorgestelde brieven.
  const bulkTotalen = useMemo(() => {
    let geadresseerden = 0;
    let geschikt = 0;
    for (const id of bulkSelectie) {
      const s = signaalIndex.get(id);
      if (!s) continue;
      const k = bouwKandidatenVoorSignaal(s, brievenPerSignaal.get(id) ?? []);
      geadresseerden += k.length;
      geschikt += k.filter(x => x.geschikt).length;
    }
    return {
      signalen: bulkSelectie.size,
      geadresseerden,
      geschikteBrieven: geschikt,
    };
  }, [bulkSelectie, signaalIndex, brievenPerSignaal]);

  function selecteerAlleGeschikteBulk() {
    const next = new Set<string>();
    for (const { signaal, readiness: r } of gefilterd) {
      if (r.info.status === 'geblokkeerd') continue;
      next.add(signaal.id);
    }
    setBulkSelectie(next);
  }

  function wisBulk() { setBulkSelectie(new Set()); }

  const [wizardOpen, setWizardOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [labelsOpen, setLabelsOpen] = useState(false);
  const [markeerModus, setMarkeerModus] = useState<MarkeerModus | null>(null);

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
  // Scope-IDs voor de huidige Verwerk-sessie. `null` = volledige lijst.
  const [verwerkScopeIds, setVerwerkScopeIds] = useState<string[] | null>(null);

  const focusItems = useMemo(() => {
    if (!verwerkScopeIds || verwerkScopeIds.length === 0) return readiness.lijst;
    const set = new Set(verwerkScopeIds);
    return readiness.lijst.filter((x) => set.has(x.signaal.id));
  }, [readiness.lijst, verwerkScopeIds]);

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

  // Hervat Verwerk selectie wanneer we terugkeren vanuit signaaldetail.
  useEffect(() => {
    const state = location.state as { resumeAcquisitieFocus?: boolean; focusIndex?: number } | null;
    if (state?.resumeAcquisitieFocus) {
      if (typeof state.focusIndex === 'number') setFocusIndex(state.focusIndex);
      setFocusOpen(true);
      // Wis state zodat refresh niet opnieuw opent.
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openVerwerk = () => {
    // Als rijen zijn geselecteerd: alleen die subset verwerken.
    if (bulkSelectie.size > 0) {
      const ids = Array.from(bulkSelectie);
      setVerwerkScopeIds(ids);
      const lijst = readiness.lijst.filter((x) => bulkSelectie.has(x.signaal.id));
      const startIdx = lijst.findIndex(({ readiness: r }) => r.info.status !== 'afgehandeld');
      setFocusIndex(startIdx >= 0 ? startIdx : 0);
      setFocusOpen(true);
      return;
    }
    setVerwerkScopeIds(null);
    const startIdx = readiness.lijst.findIndex(({ readiness: r }) =>
      r.info.status !== 'afgehandeld');
    setFocusIndex(startIdx >= 0 ? startIdx : 0);
    setFocusOpen(true);
  };

  const openVerwerkVanSignaal = (signaalId: string) => {
    setVerwerkScopeIds(null);
    const idx = readiness.lijst.findIndex(x => x.signaal.id === signaalId);
    if (idx >= 0) {
      setFocusIndex(idx);
      setFocusOpen(true);
    }
  };

  const openSignaalMetContext = (signaalId: string) => {
    const idx = readiness.lijst.findIndex(x => x.signaal.id === signaalId);
    navigate(`/off-market/${signaalId}?tab=brieven`, {
      state: { fromAcquisitieFocus: true, focusIndex: idx >= 0 ? idx : 0 },
    });
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

  const geselecteerdeSignalenBulk = Array.from(bulkSelectie)
    .map(id => signaalIndex.get(id))
    .filter((s): s is OffMarketSignaal => !!s);

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

      {/* Bulktoolbar */}
      <div
        data-testid="acquisitie-bulk-toolbar"
        className="section-card flex flex-wrap items-center justify-between gap-2 px-3 py-2"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Button
            type="button" variant="outline" size="sm"
            onClick={selecteerAlleGeschikteBulk}
            data-testid="acquisitie-bulk-selecteer-alle"
          >
            <Users className="h-3.5 w-3.5" />
            Selecteer alle geschikte
          </Button>
          {bulkSelectie.size > 0 && (
            <Button type="button" variant="ghost" size="sm" onClick={wisBulk}>
              Wis selectie
            </Button>
          )}
          <span data-testid="acquisitie-bulk-telling">
            {bulkTotalen.signalen} signalen · {bulkTotalen.geadresseerden} geadresseerden ·{' '}
            {bulkTotalen.geschikteBrieven} brieven
          </span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button" size="sm" variant="secondary"
            onClick={() => setWizardOpen(true)}
            disabled={bulkSelectie.size === 0}
            data-testid="acquisitie-bulk-brieven-voorbereiden"
          >
            <Mail className="h-3.5 w-3.5" />
            Brieven voorbereiden
          </Button>
          <Button
            type="button" size="sm" variant="secondary"
            onClick={() => setPdfOpen(true)}
            disabled={bulkSelectie.size === 0}
            data-testid="acquisitie-bulk-gecombineerde-pdf"
          >
            <FileDown className="h-3.5 w-3.5" />
            Brieven-PDF
          </Button>
          <Button
            type="button" size="sm" variant="secondary"
            onClick={() => setLabelsOpen(true)}
            disabled={bulkSelectie.size === 0}
            data-testid="acquisitie-bulk-adreslabels"
          >
            <Tag className="h-3.5 w-3.5" />
            Adreslabels
          </Button>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => setMarkeerModus('geprint')}
            disabled={bulkSelectie.size === 0}
            data-testid="acquisitie-bulk-markeer-geprint"
          >
            <Printer className="h-3.5 w-3.5" />
            Markeer geprint
          </Button>
          <Button
            type="button" size="sm" variant="outline"
            onClick={() => setMarkeerModus('gepost')}
            disabled={bulkSelectie.size === 0}
            data-testid="acquisitie-bulk-markeer-gepost"
          >
            <Send className="h-3.5 w-3.5" />
            Markeer gepost
          </Button>
        </div>
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
            const bulkChecked = bulkSelectie.has(signaal.id);
            return (
              <li
                key={signaal.id}
                data-testid="acquisitie-selectie-rij"
                data-signaal-id={signaal.id}
                data-fase={r.fase}
                className="p-3 sm:p-4"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Checkbox
                      checked={bulkChecked}
                      onCheckedChange={() => toggleBulk(signaal.id)}
                      aria-label="Selecteer signaal voor bulkacties"
                      data-testid="acquisitie-rij-bulkcheck"
                      className="mt-1"
                    />
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
                        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                          <StatusWijzigDropdown signaal={signaal} variant="compact" />
                        </span>
                        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                          <PrioriteitWijzigDropdown signaalId={signaal.id} prioriteit={signaal.prioriteit} />
                        </span>
                        <span onClick={(e) => e.stopPropagation()} className="inline-flex">
                          <EigenaarstatusWijzigDropdown
                            signaalId={signaal.id}
                            eigenaarstatus={((signaal as any).eigenaarstatus as OffMarketEigenaarstatus | null) ?? 'onbekend'}
                          />
                        </span>
                        {(() => {
                          const info = briefInfoPerSignaal.get(signaal.id);
                          if (!info) return null;
                          const toonSuffix = info.aantalGeadresseerden > 1 && info.verzonden > 0;
                          const toonOpvolging = info.status === 'brief2_gepland';
                          return (
                            <span
                              data-testid="acquisitie-rij-briefstatus"
                              className="inline-flex items-center gap-1"
                            >
                              <SignaalBriefStatusBadge status={info.status} />
                              {toonSuffix && (
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                                  {info.verzonden}/{info.aantalGeadresseerden}
                                </span>
                              )}
                              {toonOpvolging && (
                                <span className="text-[10px] text-accent whitespace-nowrap">
                                  Opvolging nodig
                                </span>
                              )}
                            </span>
                          );
                        })()}
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

                      {/* Geadresseerden onder het signaal — compact, niet-genest */}
                      {r.geadresseerden.length > 0 && (
                        <details className="mt-1.5" data-testid="acquisitie-rij-geadresseerden">
                          <summary className="cursor-pointer text-[11px] text-muted-foreground">
                            {r.geadresseerden.length} geadresseerde{r.geadresseerden.length === 1 ? '' : 'n'} tonen
                          </summary>
                          <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                            {r.geadresseerden.map(g => (
                              <li
                                key={g.key}
                                data-testid="acquisitie-rij-geadresseerde"
                                className="break-words"
                              >
                                <span className="text-foreground">
                                  {g.naam ?? g.bedrijfsnaam ?? '(zonder naam)'}
                                </span>
                                {g.verzendadres && (
                                  <span> · {g.verzendadres.replace(/\s+/g, ' ')}</span>
                                )}
                                {!g.volledigPostadres && (
                                  <span className="text-destructive"> · adres onvolledig</span>
                                )}
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </div>
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

      <BulkBriefVoorbereidenWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        signalen={geselecteerdeSignalenBulk}
        brieven={brieven.filter(b => bulkSelectie.has(b.signaal_id))}
      />

      <GecombineerdeBrievenPdfDialog
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        signalen={geselecteerdeSignalenBulk}
        toegevoegdOpPerSignaal={toegevoegdOpPerSignaal}
        brieven={brieven.filter(b => bulkSelectie.has(b.signaal_id))}
      />

      <AdreslabelsPdfDialog
        open={labelsOpen}
        onClose={() => setLabelsOpen(false)}
        signalen={geselecteerdeSignalenBulk}
        toegevoegdOpPerSignaal={toegevoegdOpPerSignaal}
        brieven={brieven.filter(b => bulkSelectie.has(b.signaal_id))}
      />

      <MarkeerBulkDialog
        open={markeerModus !== null}
        onClose={() => setMarkeerModus(null)}
        modus={markeerModus ?? 'geprint'}
        signalen={geselecteerdeSignalenBulk}
        brieven={brieven.filter(b => bulkSelectie.has(b.signaal_id))}
      />
    </section>
  );
}
