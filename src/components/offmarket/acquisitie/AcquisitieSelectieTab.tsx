// V1B+V2+Fase1 — Tab-inhoud "Acquisitieselectie".
// Fase 1 voegt hoofdwerkbakken (Actie/Wachten/Afgehandeld/Alles),
// subfilters onder Actie, contextuele procesdatums, Werkvolgorde-sortering
// en verplaatsfeedback toe. Readiness/fase blijft ongewijzigd.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
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
import AcquisitieWerkbakChips from './AcquisitieWerkbakChips';
import { ReadinessBadge, WaarschuwingBadges } from './ReadinessBadge';
import FocusModus from './FocusModus';
import BulkBriefVoorbereidenWizard from './BulkBriefVoorbereidenWizard';
import GecombineerdeBrievenPdfDialog from './GecombineerdeBrievenPdfDialog';
import BrotherAdreslabelsCsvDialog from './BrotherAdreslabelsCsvDialog';
import MarkeerBulkDialog, { type MarkeerModus } from './MarkeerBulkDialog';
import { bouwKandidatenVoorSignaal } from '@/lib/offMarket/acquisitie/bulkBrief';
import {
  bepaalWerkbakContext,
  sorteerWerkvolgorde,
  toegevoegdOpLabel,
  WERKBAK_LABEL,
  ACTIE_SUBFILTER_LABEL,
  type ActieSubfilter,
  type SorteerRij,
  type Werkbak,
  type WerkbakContext,
  type WerkbakView,
} from '@/lib/offMarket/acquisitie/werkbak';

/**
 * Zoek in de variables van een mutatie naar signaal-id's zodat we een
 * expliciete gebruikersactie kunnen koppelen aan een specifiek signaal.
 * We accepteren gangbare vormen: `{ id }` (signaal-update), `{ signaal_id }`,
 * `{ signaalId }`, of arrays van bovenstaande.
 */
function extraheerSignaalIds(vars: unknown): string[] {
  if (vars == null) return [];
  if (Array.isArray(vars)) return vars.flatMap(extraheerSignaalIds);
  if (typeof vars !== 'object') return [];
  const out: string[] = [];
  const rec = vars as Record<string, unknown>;
  for (const key of ['signaal_id', 'signaalId', 'id']) {
    const v = rec[key];
    if (typeof v === 'string' && v.length > 0) out.push(v);
  }
  return out;
}

function tekstType(s: OffMarketSignaal): string {
  return (SIGNAALTYPE_LABEL as Record<string, string>)[s.type_signaal] ?? s.type_signaal ?? '—';
}

// Nieuwe sessionStorage-keys voor Fase 1.
const WERKBAK_KEY = 'off-market-acq:werkbak';
const SUBFILTER_KEY = 'off-market-acq:subfilter';
// Legacy key uit V1B; wordt defensief gemigreerd en daarna niet meer geschreven.
const LEGACY_FILTER_KEY = 'off-market-acq:filter';
const FOCUS_INDEX_KEY = 'off-market-acq:focus-index';
const SCROLL_KEY = 'off-market-acq:scroll';

/** Migratie van legacy filterwaarde naar (werkbak, subfilter). */
function migreerLegacyFilter(v: string | null): { werkbak: WerkbakView; subfilter: ActieSubfilter } {
  switch (v) {
    case 'alles': return { werkbak: 'alles', subfilter: 'alle' };
    case 'geblokkeerd': return { werkbak: 'actie', subfilter: 'onderzoeken' };
    case 'brief_voorbereiden': return { werkbak: 'actie', subfilter: 'brief_voorbereiden' };
    case 'printklaar': return { werkbak: 'actie', subfilter: 'printen_posten' };
    case 'opvolging': return { werkbak: 'actie', subfilter: 'opvolgen' };
    default: return { werkbak: 'actie', subfilter: 'alle' };
  }
}

function leesInitieleView(): { werkbak: WerkbakView; subfilter: ActieSubfilter } {
  try {
    const wb = sessionStorage.getItem(WERKBAK_KEY);
    const sf = sessionStorage.getItem(SUBFILTER_KEY);
    const geldigeWb: WerkbakView[] = ['actie', 'wachten', 'afgehandeld', 'alles'];
    const geldigeSf: ActieSubfilter[] = ['alle', 'onderzoeken', 'brief_voorbereiden', 'printen_posten', 'opvolgen'];
    if (wb && geldigeWb.includes(wb as WerkbakView)) {
      return {
        werkbak: wb as WerkbakView,
        subfilter: sf && geldigeSf.includes(sf as ActieSubfilter) ? sf as ActieSubfilter : 'alle',
      };
    }
    const legacy = sessionStorage.getItem(LEGACY_FILTER_KEY);
    if (legacy) return migreerLegacyFilter(legacy);
  } catch { /* ignore */ }
  return { werkbak: 'actie', subfilter: 'alle' };
}

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

  // ---- Fase 1: view (werkbak + subfilter) --------------------------------
  const initieel = useMemo(leesInitieleView, []);
  const [werkbak, setWerkbakState] = useState<WerkbakView>(initieel.werkbak);
  const [subfilter, setSubfilterState] = useState<ActieSubfilter>(initieel.subfilter);
  const setWerkbak = (v: WerkbakView) => {
    setWerkbakState(v);
    try { sessionStorage.setItem(WERKBAK_KEY, v); } catch { /* ignore */ }
  };
  const setSubfilter = (v: ActieSubfilter) => {
    setSubfilterState(v);
    try { sessionStorage.setItem(SUBFILTER_KEY, v); } catch { /* ignore */ }
  };

  // Werkbak-context per signaal (fase → werkbak/actieCategorie/subfilter/procesdatum).
  const werkbakPerSignaal = useMemo(() => {
    const m = new Map<string, WerkbakContext>();
    const brievenPer = new Map<string, typeof brieven>();
    for (const b of brieven) {
      const arr = brievenPer.get(b.signaal_id) ?? [];
      arr.push(b);
      brievenPer.set(b.signaal_id, arr);
    }
    for (const { signaal, readiness: r } of readiness.lijst) {
      const ctx = bepaalWerkbakContext({
        signaal,
        readiness: r,
        brieven: brievenPer.get(signaal.id) ?? [],
        toegevoegdOp: toegevoegdOpPerSignaal.get(signaal.id) ?? null,
      });
      m.set(signaal.id, ctx);
    }
    return m;
  }, [readiness.lijst, brieven, toegevoegdOpPerSignaal]);

  // Tellingen per werkbak + per subfilter (dynamisch).
  const tellingen = useMemo(() => {
    const wb: Record<WerkbakView, number> = { actie: 0, wachten: 0, afgehandeld: 0, alles: 0 };
    const sf: Record<ActieSubfilter, number> = {
      alle: 0, onderzoeken: 0, brief_voorbereiden: 0, printen_posten: 0, opvolgen: 0,
    };
    for (const ctx of werkbakPerSignaal.values()) {
      wb.alles += 1;
      wb[ctx.werkbak] += 1;
      if (ctx.werkbak === 'actie' && ctx.actieSubfilter) {
        sf.alle += 1;
        sf[ctx.actieSubfilter] += 1;
      }
    }
    return { werkbak: wb, subfilter: sf };
  }, [werkbakPerSignaal]);

  // ---- Verplaatsfeedback ------------------------------------------------
  // Toont uitsluitend een toast wanneer een signaal door een expliciete
  // gebruikersmutatie in deze sessie in een andere werkbak of Actie-subfilter
  // terechtkomt. Initiële laadactie, achtergrondrefresh en wijzigingen door
  // een andere gebruiker triggeren geen melding.
  const queryClient = useQueryClient();
  const recenteMutatiesRef = useRef<Map<string, number>>(new Map());
  useEffect(() => {
    const cache = queryClient.getMutationCache();
    const unsubscribe = cache.subscribe((event) => {
      const mutation = event?.mutation;
      if (!mutation || mutation.state.status !== 'success') return;
      const vars = mutation.state.variables as unknown;
      const ids = extraheerSignaalIds(vars);
      if (ids.length === 0) return;
      const nu = Date.now();
      for (const id of ids) recenteMutatiesRef.current.set(id, nu);
    });
    return () => { unsubscribe(); };
  }, [queryClient]);

  type VorigeCtx = { werkbak: Werkbak; subfilter: ActieSubfilter | null };
  const vorigeCtxRef = useRef<Map<string, VorigeCtx> | null>(null);
  useEffect(() => {
    const huidig = new Map<string, VorigeCtx>();
    for (const [id, ctx] of werkbakPerSignaal.entries()) {
      huidig.set(id, { werkbak: ctx.werkbak, subfilter: ctx.actieSubfilter });
    }
    const vorig = vorigeCtxRef.current;
    // Skip initiële laadactie: geen vorige snapshot.
    if (vorig) {
      const nu = Date.now();
      const MUT_TTL_MS = 7000;
      for (const [id, oud] of vorig.entries()) {
        const nieuw = huidig.get(id);
        if (!nieuw) continue;
        const werkbakChanged = nieuw.werkbak !== oud.werkbak;
        const subfilterChanged =
          nieuw.werkbak === 'actie' && oud.werkbak === 'actie'
          && nieuw.subfilter !== oud.subfilter;
        if (!werkbakChanged && !subfilterChanged) continue;
        // Alleen na expliciete gebruikersmutatie in deze sessie tonen.
        const mutAt = recenteMutatiesRef.current.get(id);
        if (!mutAt || nu - mutAt > MUT_TTL_MS) continue;

        const doelLabel = werkbakChanged
          ? WERKBAK_LABEL[nieuw.werkbak]
          : (nieuw.subfilter ? ACTIE_SUBFILTER_LABEL[nieuw.subfilter] : WERKBAK_LABEL.actie);

        toast.success(`Verplaatst naar ${doelLabel}`, {
          description: werkbakChanged
            ? 'Signaal is naar een andere werkbak verplaatst.'
            : 'Signaal is naar een andere actiegroep verplaatst.',
          action: {
            label: 'Bekijken',
            onClick: () => navigate(`/off-market/${id}`),
          },
        });
        recenteMutatiesRef.current.delete(id);
      }
    }
    vorigeCtxRef.current = huidig;
  }, [werkbakPerSignaal, navigate]);

  // Gefilterde + gesorteerde lijst voor de huidige view.
  const gefilterd = useMemo(() => {
    // Verzamel rijen die in de huidige werkbak passen.
    const rijen: SorteerRij[] = [];
    for (const { signaal } of readiness.lijst) {
      const ctx = werkbakPerSignaal.get(signaal.id);
      if (!ctx) continue;
      const inWerkbak =
        werkbak === 'alles' ? true : ctx.werkbak === werkbak;
      if (!inWerkbak) continue;
      if (werkbak === 'actie' && subfilter !== 'alle' && ctx.actieSubfilter !== subfilter) continue;
      rijen.push({
        signaalId: signaal.id,
        toegevoegdOp: toegevoegdOpPerSignaal.get(signaal.id) ?? null,
        ctx,
        procesDatumIsoWachten: ctx.werkbak === 'wachten' ? (ctx.procesDatum?.iso ?? null) : null,
      });
    }
    const gesorteerd = sorteerWerkvolgorde(werkbak, rijen);
    // Terug-map naar { signaal, readiness, ctx }.
    const byId = new Map(readiness.lijst.map(x => [x.signaal.id, x]));
    return gesorteerd
      .map(r => {
        const item = byId.get(r.signaalId);
        if (!item) return null;
        return { ...item, ctx: r.ctx };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [readiness.lijst, werkbakPerSignaal, werkbak, subfilter, toegevoegdOpPerSignaal]);

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

  /** Selecteer alle zichtbare/gefilterde rijen — exact zoals "Verwerk filter" gebruikt. */
  function selecteerZichtbareBulk() {
    setBulkSelectie(new Set(gefilterd.map((x) => x.signaal.id)));
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
    const state = location.state as {
      resumeAcquisitieFocus?: boolean;
      focusIndex?: number;
      focusScopeIds?: string[] | null;
      selectedIds?: string[] | null;
    } | null;
    if (state?.resumeAcquisitieFocus) {
      if (Array.isArray(state.focusScopeIds) && state.focusScopeIds.length > 0) {
        setVerwerkScopeIds(state.focusScopeIds);
      } else {
        setVerwerkScopeIds(null);
      }
      if (Array.isArray(state.selectedIds)) {
        setBulkSelectie(new Set(state.selectedIds));
      }
      if (typeof state.focusIndex === 'number') setFocusIndex(state.focusIndex);
      setFocusOpen(true);
      // Wis state zodat refresh niet opnieuw opent.
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openVerwerk = () => {
    // 1) Handmatige bulkselectie heeft voorrang.
    if (bulkSelectie.size > 0) {
      const ids = Array.from(bulkSelectie);
      setVerwerkScopeIds(ids);
      const lijst = readiness.lijst.filter((x) => bulkSelectie.has(x.signaal.id));
      const startIdx = lijst.findIndex(({ readiness: r }) => r.info.status !== 'afgehandeld');
      setFocusIndex(startIdx >= 0 ? startIdx : 0);
      setFocusOpen(true);
      return;
    }
    // 2) Geen bulkselectie + view is niet "alles": verwerk uitsluitend de
    //    zichtbare/gefilterde rijen.
    if (werkbak !== 'alles') {
      const ids = gefilterd.map((x) => x.signaal.id);
      setVerwerkScopeIds(ids);
      const startIdx = gefilterd.findIndex(({ readiness: r }) => r.info.status !== 'afgehandeld');
      setFocusIndex(startIdx >= 0 ? startIdx : 0);
      setFocusOpen(true);
      return;
    }
    // 3) View "alles" + geen bulkselectie: volledige acquisitieselectie.
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
    // Bepaal scope conform openVerwerk: bulkselectie > actieve filter > volledige lijst.
    let scopeIds: string[] | null = null;
    if (bulkSelectie.size > 0) {
      scopeIds = readiness.lijst
        .filter((x) => bulkSelectie.has(x.signaal.id))
        .map((x) => x.signaal.id);
    } else if (werkbak !== 'alles') {
      scopeIds = gefilterd.map((x) => x.signaal.id);
    }
    const scopeList = scopeIds
      ? readiness.lijst.filter((x) => scopeIds!.includes(x.signaal.id))
      : readiness.lijst;
    const idx = scopeList.findIndex((x) => x.signaal.id === signaalId);
    navigate(`/off-market/${signaalId}?tab=brieven`, {
      state: {
        fromAcquisitieFocus: true,
        focusIndex: idx >= 0 ? idx : 0,
        focusScopeIds: scopeIds,
        selectedIds: Array.from(bulkSelectie),
      },
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
        <AcquisitieWerkbakChips
          werkbak={werkbak}
          subfilter={subfilter}
          onWerkbakChange={setWerkbak}
          onSubfilterChange={setSubfilter}
          counts={tellingen}
        />
        <Button
          type="button"
          size="sm"
          variant="default"
          onClick={openVerwerk}
          data-testid="acquisitie-verwerk-selectie"
          disabled={readiness.lijst.length === 0}
        >
          <PlayCircle className="h-4 w-4" />
          {bulkSelectie.size > 0
            ? `Verwerk geselecteerde (${bulkSelectie.size})`
            : werkbak !== 'alles'
              ? `Verwerk ${WERKBAK_LABEL[werkbak]} (${gefilterd.length})`
              : 'Verwerk selectie'}
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
            onClick={selecteerZichtbareBulk}
            disabled={gefilterd.length === 0}
            data-testid="acquisitie-bulk-selecteer-zichtbare"
          >
            <Users className="h-3.5 w-3.5" />
            Selecteer zichtbare ({gefilterd.length})
          </Button>
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
            title="Download een CSV-database voor Brother P-touch Editor."
          >
            <Tag className="h-3.5 w-3.5" />
            Brother-adreslabels exporteren
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
          {gefilterd.map(({ signaal, readiness: r, ctx }) => {
            const adres = formatSignaalAdres(signaal) || cleanAdres(signaal.adres) || '—';
            const plaats = cleanPlaats(signaal.plaats) || '';
            const bulkChecked = bulkSelectie.has(signaal.id);
            const toegevoegd = toegevoegdOpLabel(toegevoegdOpPerSignaal.get(signaal.id) ?? null);
            return (
              <li
                key={signaal.id}
                data-testid="acquisitie-selectie-rij"
                data-signaal-id={signaal.id}
                data-fase={r.fase}
                data-werkbak={ctx.werkbak}
                data-actie-categorie={ctx.actieCategorie ?? ''}
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
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                        {ctx.procesDatum && (
                          <span
                            data-testid="acquisitie-rij-procesdatum"
                            title={ctx.procesDatum.a11yLabel}
                          >
                            {ctx.procesDatum.label}
                          </span>
                        )}
                        {toegevoegd && (
                          <span data-testid="acquisitie-rij-toegevoegd" title={toegevoegd.volledig}>
                            Toegevoegd {toegevoegd.relatief}
                          </span>
                        )}
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
                      onClick={() => openSignaalMetContext(signaal.id)}
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
        onClose={() => { setFocusOpen(false); setVerwerkScopeIds(null); }}
        items={focusItems}
        index={focusIndex}
        onIndexChange={setFocusIndex}
        focusScopeIds={verwerkScopeIds}
        selectedIds={Array.from(bulkSelectie)}
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

      <BrotherAdreslabelsCsvDialog
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
