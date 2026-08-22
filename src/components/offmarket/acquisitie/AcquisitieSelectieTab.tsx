// V1B+V2+Fase1 — Tab-inhoud "Acquisitieselectie".
// Fase 1 voegt hoofdwerkbakken (Actie/Wachten/Afgehandeld/Alles),
// subfilters onder Actie, contextuele procesdatums, Werkvolgorde-sortering
// en verplaatsfeedback toe. Readiness/fase blijft ongewijzigd.
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  ArrowDownUp, ExternalLink, FileDown, Inbox, Mail, MessageSquare, PackageCheck, PlayCircle, Search, Sparkles, Trash2, Users,
} from 'lucide-react';

import {
  useAcquisitieSelectie,
  useVerwijderUitAcquisitieSelectie,
} from '@/hooks/useAcquisitieSelectie';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import {
  useAcquisitieReadiness, useBrievenVoorSignalen,
} from '@/hooks/useAcquisitieReadiness';
import StatusWijzigDropdown from '@/components/offmarket/overzicht/StatusWijzigDropdown';
import PrioriteitWijzigDropdown from '@/components/offmarket/cockpit/PrioriteitWijzigDropdown';
import EigenaarstatusWijzigDropdown from '@/components/offmarket/cockpit/EigenaarstatusWijzigDropdown';
import {
  bepaalEigenaarProcesStatus,
  toonErfpachtChip,
  EIGENAAR_PROCES_LABEL,
} from '@/lib/offMarket/acquisitie/rechtenbewusteEigenaar';
import SignaalBriefStatusBadge from '@/components/offmarket/SignaalBriefStatusBadge';
import { bepaalBriefStatus, type BriefStatus } from '@/lib/offMarket/briefStatus';
import { groepeerBrievenPerGeadresseerde } from '@/lib/offMarket/brieven/groepering';
import {
  RESPONS_LABEL, badgeClassVoorRespons, type Responsstatus,
} from '@/lib/offMarket/brieven/respons';
import { KANAAL_LABEL, type Kanaal } from '@/lib/offMarket/brieven/verzendstatus';
import { useDataStore } from '@/hooks/useDataStore';
import { useProductiekernSelectieOverzicht } from '@/hooks/useProductiekernSelectieOverzicht';
import type { OffMarketEigenaarstatus } from '@/lib/offMarket/types';
import { BagKaartBadge } from '@/components/offmarket/kaart/KaartSignaalBadges';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import { acquisitieSignaalLabel } from '@/lib/offMarket/acquisitie/signaalLabel';
import { cleanAdres, cleanPlaats, formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import ToevoegenAanAcquisitieSelectieKnop from './ToevoegenAanAcquisitieSelectieKnop';
import AcquisitieKpis from './AcquisitieKpis';
import AcquisitieWerkbakChips from './AcquisitieWerkbakChips';
import { ReadinessBadge, WaarschuwingBadges } from './ReadinessBadge';
import FocusModus from './FocusModus';
import BulkBriefVoorbereidenWizard from './BulkBriefVoorbereidenWizard';
import GecombineerdeBrievenPdfDialog from './GecombineerdeBrievenPdfDialog';
import ProductiekernPrintbatchWerkbak from './ProductiekernPrintbatchWerkbak';
import AcquisitieDossierRij from './AcquisitieDossierRij';
import VastgoedkansenInAcquisitieSelectie from './VastgoedkansenInAcquisitieSelectie';
import { bouwKandidatenVoorSignaal } from '@/lib/offMarket/acquisitie/bulkBrief';
import {
  ACTIE_SUBFILTER_LABEL,
  bepaalWerkbakContext,
  toegevoegdOpLabel,
  WERKBAK_LABEL,
  type ActieSubfilter,
  type Werkbak,
  type WerkbakContext,
  type WerkbakView,
} from '@/lib/offMarket/acquisitie/werkbak';

import {
  bepaalVerplaatsToasts,
  extraheerSignaalIds,
  leesInitieleView,
  WERKBAK_KEY,
  SUBFILTER_KEY,
} from '@/lib/offMarket/acquisitie/selectieViewState';
import {
  bepaalPrintPostGroep,
  isPrintPostFilter,
  matchtPrintPostFilter,
  PRINT_POST_LABEL,
  PRINT_POST_VOLGORDE,
  type PrintPostFilter,
} from '@/lib/offMarket/acquisitie/printPostFilter';
import {
  isSorteerOptie,
  SORTEER_LABEL,
  SORTEER_VOLGORDE,
  sorteerRijen,
  standaardSortering,
  type SorteerbareRij,
  type SorteerOptie,
} from '@/lib/offMarket/acquisitie/sortering';
import {
  eerstVolgendeId,
  leesWerkronde,
  markeerBehandeld,
  schrijfWerkronde,
  startWerkronde,
  voortgang,
  voortgangTekst,
  wisWerkronde,
  type Werkronde,
  type WerkrondeBron,
} from '@/lib/offMarket/acquisitie/werkronde';
import {
  bepaalOnderzoekRedenen, onderzoekRedenTekst,
} from '@/lib/offMarket/acquisitie/onderzoekRedenen';
import {
  focusTabVoorWerkbakContext,
  hoortWerkbakContextBijBron,
  werkrondeBronVoorView,
} from '@/lib/offMarket/acquisitie/werkrondeContext';

function tekstType(s: OffMarketSignaal): string {
  return acquisitieSignaalLabel(s);
}

function normaliseerZoektekst(waarde: unknown): string {
  return String(waarde ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function vervolgactieVoorRespons(status: Responsstatus): string {
  switch (status) {
    case 'interesse': return 'Lead kwalificeren';
    case 'wil_meer_informatie': return 'Informatie verstrekken en contact vervolgen';
    case 'gesprek_gepland': return 'Gesprek voorbereiden';
    case 'reactie_ontvangen': return 'Reactie beoordelen';
    case 'later_opnieuw_benaderen': return 'Later opvolgen';
    case 'niet_geinteresseerd': return 'Dossier beoordelen / afsluiten';
    case 'verkeerd_adres': return 'Geadresseerde herstellen';
    case 'retour_post': return 'Adres controleren';
    case 'verkocht_of_niet_relevant': return 'Dossier beoordelen / afsluiten';
    case 'afgevallen': return 'Dossier afsluiten';
    case 'geen_reactie': return 'Opvolgstrategie bepalen';
    default: return 'Reactie beoordelen';
  }
}

const FOCUS_INDEX_KEY = 'off-market-acq:focus-index';
const SCROLL_KEY = 'off-market-acq:scroll';
const PRINTPOST_KEY = 'off-market-acq:printpost';
const SORTEER_KEY = 'off-market-acq:sortering';
const ZOEK_KEY = 'off-market-acq:zoekterm';

export default function AcquisitieSelectieTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: items = [], isLoading } = useAcquisitieSelectie();
  const verwijderUitSelectie = useVerwijderUitAcquisitieSelectie();
  const { data: signalen = [] } = useOffMarketSignalen();

  const signaalIndex = useMemo(() => {
    const map = new Map<string, OffMarketSignaal>();
    for (const s of signalen) map.set(s.id, s);
    return map;
  }, [signalen]);

  const geselecteerdeSignalen = useMemo<OffMarketSignaal[]>(() => {
    const lijst = [...items].sort((a, b) =>
      (a.toegevoegd_op ?? '').localeCompare(b.toegevoegd_op ?? ''),
    );
    return lijst
      .filter(it => typeof it.signaal_id === 'string' && it.signaal_id.length > 0)
      .map(it => signaalIndex.get(it.signaal_id!))
      .filter((s): s is OffMarketSignaal => !!s);
  }, [items, signaalIndex]);

  const toegevoegdOpPerSignaal = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const it of items) if (it.signaal_id) m.set(it.signaal_id, it.toegevoegd_op ?? null);
    return m;
  }, [items]);

  const readiness = useAcquisitieReadiness(geselecteerdeSignalen);
  const signaalIds = useMemo(() => geselecteerdeSignalen.map(s => s.id), [geselecteerdeSignalen]);
  const { data: brieven = [] } = useBrievenVoorSignalen(signaalIds);
  const productieOverzicht = useProductiekernSelectieOverzicht(brieven, geselecteerdeSignalen);

  const initieel = useMemo(leesInitieleView, []);
  const [werkbak, setWerkbakState] = useState<WerkbakView>(initieel.werkbak);
  const [subfilter, setSubfilterState] = useState<ActieSubfilter>(initieel.subfilter);
  const [zoekterm, setZoektermState] = useState(() => {
    try { return sessionStorage.getItem(ZOEK_KEY) ?? ''; } catch { return ''; }
  });
  const setZoekterm = (waarde: string) => {
    setZoektermState(waarde);
    try {
      if (waarde) sessionStorage.setItem(ZOEK_KEY, waarde);
      else sessionStorage.removeItem(ZOEK_KEY);
    } catch { /* ignore */ }
  };
  const zoek = normaliseerZoektekst(zoekterm);
  const zoekActief = zoek.length > 0;

  const setWerkbak = (v: WerkbakView) => {
    setWerkbakState(v);
    try { sessionStorage.setItem(WERKBAK_KEY, v); } catch { /* ignore */ }
  };
  const setSubfilter = (v: ActieSubfilter) => {
    setSubfilterState(v);
    try { sessionStorage.setItem(SUBFILTER_KEY, v); } catch { /* ignore */ }
  };

  const [printPost, setPrintPostState] = useState<PrintPostFilter>(() => {
    try {
      const v = sessionStorage.getItem(PRINTPOST_KEY);
      return isPrintPostFilter(v) ? v : 'te_printen';
    } catch { return 'te_printen'; }
  });
  const setPrintPost = (v: PrintPostFilter) => {
    setPrintPostState(v);
    try { sessionStorage.setItem(PRINTPOST_KEY, v); } catch { /* ignore */ }
  };

  const [sorteerKeuze, setSorteerKeuzeState] = useState<SorteerOptie | null>(() => {
    try {
      const v = sessionStorage.getItem(SORTEER_KEY);
      return isSorteerOptie(v) ? v : null;
    } catch { return null; }
  });
  const setSorteerKeuze = (v: SorteerOptie | null) => {
    setSorteerKeuzeState(v);
    try {
      if (v) sessionStorage.setItem(SORTEER_KEY, v);
      else sessionStorage.removeItem(SORTEER_KEY);
    } catch { /* ignore */ }
  };

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

  const tellingen = useMemo(() => {
    const wb: Record<WerkbakView, number> = { actie: 0, wachten: 0, afgehandeld: 0, alles: 0 };
    const sf: Record<ActieSubfilter, number> = {
      alle: 0, onderzoeken: 0, eigenaar_controleren: 0, adres_achterhalen: 0, brief_voorbereiden: 0,
      printen_posten: 0, opvolgen: 0,
    };
    const pp: Record<PrintPostFilter, number> = { alles: 0, te_printen: 0, te_posten: 0 };
    for (const ctx of werkbakPerSignaal.values()) {
      wb.alles += 1;
      wb[ctx.werkbak] += 1;
      if (ctx.werkbak === 'actie' && ctx.actieSubfilter) {
        sf.alle += 1;
        sf[ctx.actieSubfilter] += 1;
        const groep = bepaalPrintPostGroep(ctx.actieCategorie);
        if (groep) { pp.alles += 1; pp[groep] += 1; }
      }
    }
    return { werkbak: wb, subfilter: sf, printPost: pp };
  }, [werkbakPerSignaal]);

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
    const toasts = bepaalVerplaatsToasts({
      vorig: vorigeCtxRef.current,
      huidig,
      recenteMutaties: recenteMutatiesRef.current,
      nu: Date.now(),
    });
    for (const t of toasts) {
      toast.success(`Verplaatst naar ${t.doelLabel}`, {
        description: t.soort === 'werkbak'
          ? 'Signaal is naar een andere werkbak verplaatst.'
          : 'Signaal is naar een andere actiegroep verplaatst.',
        action: {
          label: 'Bekijken',
          onClick: () => navigate(`/off-market/${t.id}`),
        },
      });
      recenteMutatiesRef.current.delete(t.id);
    }
    vorigeCtxRef.current = huidig;
  }, [werkbakPerSignaal, navigate]);

  const actieveSortering: SorteerOptie = sorteerKeuze
    ?? standaardSortering(werkbak, subfilter, printPost);

  const gefilterd = useMemo(() => {
    const rijen: SorteerbareRij[] = [];
    for (const { signaal, readiness: r } of readiness.lijst) {
      const ctx = werkbakPerSignaal.get(signaal.id);
      if (!ctx) continue;

      if (zoekActief) {
        const productieNummers = productieOverzicht.nummersPerSignaal.get(signaal.id);
        const geadresseerdeTekst = r.geadresseerden
          .flatMap((g) => [g.naam, g.bedrijfsnaam, g.verzendadres])
          .filter(Boolean)
          .join(' ');
        const haystack = normaliseerZoektekst([
          formatSignaalAdres(signaal),
          cleanAdres(signaal.adres),
          (signaal as any).postcode,
          cleanPlaats(signaal.plaats),
          tekstType(signaal),
          signaal.type_signaal,
          signaal.id,
          geadresseerdeTekst,
          ...(productieNummers?.briefnummers ?? []),
          ...(productieNummers?.batchnummers ?? []),
        ].filter(Boolean).join(' '));
        if (!haystack.includes(zoek)) continue;
      } else {
        const inWerkbak = werkbak === 'alles' ? true : ctx.werkbak === werkbak;
        if (!inWerkbak) continue;
        if (werkbak === 'actie' && subfilter !== 'alle' && ctx.actieSubfilter !== subfilter) continue;
        if (
          werkbak === 'actie' && subfilter === 'printen_posten'
          && !matchtPrintPostFilter(ctx.actieCategorie, printPost)
        ) continue;
      }

      rijen.push({
        signaalId: signaal.id,
        toegevoegdOp: toegevoegdOpPerSignaal.get(signaal.id) ?? null,
        ctx,
        procesDatumIsoWachten: ctx.werkbak === 'wachten' ? (ctx.procesDatum?.iso ?? null) : null,
        prioriteit: (signaal.prioriteit as string | null) ?? null,
        aiScore: typeof signaal.ai_score === 'number' ? signaal.ai_score : null,
        plaats: cleanPlaats(signaal.plaats) || null,
      });
    }
    const gesorteerd = sorteerRijen(actieveSortering, zoekActief ? 'alles' : werkbak, rijen);
    const byId = new Map(readiness.lijst.map(x => [x.signaal.id, x]));
    return gesorteerd
      .map(r => {
        const item = byId.get(r.signaalId);
        if (!item) return null;
        return { ...item, ctx: r.ctx };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [
    readiness.lijst, werkbakPerSignaal, werkbak, subfilter, printPost,
    actieveSortering, toegevoegdOpPerSignaal, zoek, zoekActief,
    productieOverzicht.nummersPerSignaal,
  ]);

  const [werkronde, setWerkrondeState] = useState<Werkronde | null>(() => leesWerkronde());
  const bewaarWerkronde = (w: Werkronde | null) => {
    setWerkrondeState(w);
    if (w) schrijfWerkronde(w); else wisWerkronde();
  };

  useEffect(() => {
    if (!werkronde) return;
    if (werkronde.bron === 'handmatig') return;
    let next = werkronde;
    for (const id of werkronde.scopeIds) {
      const ctx = werkbakPerSignaal.get(id);
      if (!ctx) continue;
      if (!hoortWerkbakContextBijBron(werkronde.bron, ctx) && !next.behandeldeIds.includes(id)) {
        next = markeerBehandeld(next, id);
      }
    }
    if (next !== werkronde) bewaarWerkronde(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [werkbakPerSignaal, werkronde]);

  const werkrondeVoortgang = werkronde ? voortgang(werkronde) : null;

  const werkrondeItems = useMemo(() => {
    if (!werkronde) return [];
    const set = new Set(werkronde.scopeIds);
    const inVolgorde = gefilterd.filter(x => set.has(x.signaal.id));
    const aanwezig = new Set(inVolgorde.map(x => x.signaal.id));
    const rest = readiness.lijst.filter(
      x => set.has(x.signaal.id) && !aanwezig.has(x.signaal.id),
    );
    return [...inVolgorde, ...rest];
  }, [werkronde, gefilterd, readiness.lijst]);

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

  const { taken } = useDataStore();
  const briefInfoPerSignaal = useMemo(() => {
    const m = new Map<string, {
      status: BriefStatus;
      verzonden: number;
      aantalGeadresseerden: number;
      respons: null | {
        status: Responsstatus;
        datum: string | null;
        kanaal: Kanaal | null;
        samenvatting: string | null;
      };
    }>();
    for (const s of geselecteerdeSignalen) {
      const bs = brievenPerSignaal.get(s.id) ?? [];
      const status = bepaalBriefStatus(bs, taken as any, s.id);
      const groepen = groepeerBrievenPerGeadresseerde(bs.filter(b => !b.archived_at));
      const verzonden = groepen.filter(g => g.brieven.some(b => b.status === 'verstuurd')).length;
      const reacties = bs
        .filter((b) => !b.archived_at && !!b.responsstatus)
        .sort((a, b) => String(b.responsdatum ?? (b as any).updated_at ?? b.created_at ?? '')
          .localeCompare(String(a.responsdatum ?? (a as any).updated_at ?? a.created_at ?? '')));
      const laatste = reacties[0];
      m.set(s.id, {
        status,
        verzonden,
        aantalGeadresseerden: groepen.length,
        respons: laatste ? {
          status: laatste.responsstatus as Responsstatus,
          datum: laatste.responsdatum ?? null,
          kanaal: (laatste.respons_kanaal as Kanaal | null | undefined) ?? null,
          samenvatting: laatste.respons_samenvatting ?? null,
        } : null,
      });
    }
    return m;
  }, [geselecteerdeSignalen, brievenPerSignaal, taken]);

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

  function selecteerZichtbareBulk() {
    setBulkSelectie(new Set(gefilterd.map((x) => x.signaal.id)));
  }

  function wisBulk() { setBulkSelectie(new Set()); }

  async function verwijderBulkUitSelectie() {
    const ids = Array.from(bulkSelectie);
    if (ids.length === 0 || verwijderUitSelectie.isPending) return;

    const bevestigd = window.confirm(
      `${ids.length} geselecteerde signalen uit de acquisitieselectie halen?\n\n` +
      'De oorspronkelijke signalen, eigenaren, brieven en historie blijven behouden.',
    );
    if (!bevestigd) return;

    try {
      for (const id of ids) {
        await verwijderUitSelectie.mutateAsync(id);
      }
      setBulkSelectie(new Set());
      toast.success(`${ids.length} signalen uit de acquisitieselectie gehaald`, {
        description: 'De oorspronkelijke signalen en historie zijn behouden.',
      });
    } catch (err) {
      toast.error('Geselecteerde signalen uit selectie halen mislukt', {
        description: err instanceof Error ? err.message : 'Onbekende fout',
      });
    }
  }

  const [wizardOpen, setWizardOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);

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
  const [verwerkScopeIds, setVerwerkScopeIds] = useState<string[] | null>(null);

  const focusItems = useMemo(() => {
    if (!verwerkScopeIds || verwerkScopeIds.length === 0) return readiness.lijst;
    const byId = new Map(readiness.lijst.map((x) => [x.signaal.id, x]));
    return verwerkScopeIds
      .map((id) => byId.get(id))
      .filter((x): x is NonNullable<typeof x> => !!x);
  }, [readiness.lijst, verwerkScopeIds]);

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

  useEffect(() => {
    const state = location.state as {
      resumeAcquisitieFocus?: boolean;
      focusIndex?: number;
      focusScopeIds?: string[] | null;
      selectedIds?: string[] | null;
      focusTab?: string | null;
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
      window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function huidigeBron(): { bron: WerkrondeBron; naam: string } {
    if (zoekActief) {
      return { bron: 'handmatig', naam: `Zoekresultaten (${gefilterd.length})` };
    }
    const bron = werkrondeBronVoorView({
      heeftHandmatigeSelectie: bulkSelectie.size > 0,
      werkbak,
      subfilter,
      printPost,
    });
    if (bulkSelectie.size > 0) {
      return { bron, naam: `Handmatige selectie (${bulkSelectie.size})` };
    }
    if (bron === 'onderzoeken') return { bron, naam: ACTIE_SUBFILTER_LABEL.onderzoeken };
    if (bron === 'eigenaar_controleren') return { bron, naam: ACTIE_SUBFILTER_LABEL.eigenaar_controleren };
    if (bron === 'brief_voorbereiden') return { bron, naam: ACTIE_SUBFILTER_LABEL.brief_voorbereiden };
    if (bron === 'opvolgen') return { bron, naam: ACTIE_SUBFILTER_LABEL.opvolgen };
    if (bron === 'te_printen' || bron === 'te_posten') return { bron, naam: PRINT_POST_LABEL[bron] };
    if (bron === 'werkbak') return { bron, naam: 'Actie' };
    return { bron, naam: WERKBAK_LABEL[werkbak] };
  }

  const startNieuweWerkronde = () => {
    const ids = bulkSelectie.size > 0
      ? gefilterd.filter(x => bulkSelectie.has(x.signaal.id)).map(x => x.signaal.id)
      : gefilterd.map(x => x.signaal.id);
    if (ids.length === 0) return;
    const { bron, naam } = huidigeBron();
    const w = startWerkronde({ bron, naam: `${naam} (${ids.length})`, scopeIds: ids });
    bewaarWerkronde(w);
    setVerwerkScopeIds(ids);
    setFocusIndex(0);
    setFocusOpen(true);
  };

  const hervatWerkronde = () => {
    if (!werkronde) return;
    const ids = werkrondeItems.map(x => x.signaal.id);
    if (ids.length === 0) return;
    const volgende = eerstVolgendeId(werkronde, ids);
    const idx = volgende ? Math.max(0, ids.indexOf(volgende)) : 0;
    setVerwerkScopeIds(ids);
    setFocusIndex(idx);
    setFocusOpen(true);
  };

  const primaireVerwerkActie = () => {
    if (werkronde) {
      hervatWerkronde();
      return;
    }
    startNieuweWerkronde();
  };

  const primaireVerwerkLabel = (): string => {
    if (werkronde && werkrondeVoortgang) {
      return `Hervat werkronde (${werkrondeVoortgang.resterend})`;
    }
    const n = bulkSelectie.size > 0 ? bulkSelectie.size : gefilterd.length;
    if (bulkSelectie.size > 0) return `Verwerk geselecteerde (${n})`;
    if (zoekActief) return `Verwerk zoekresultaten (${n})`;
    if (werkbak === 'actie') {
      if (subfilter === 'alle') return `Verwerk Actie (${n})`;
      if (subfilter === 'printen_posten') {
        return printPost === 'alles'
          ? `Verwerk Printen & posten (${n})`
          : `Verwerk ${PRINT_POST_LABEL[printPost]} (${n})`;
      }
      return `Verwerk ${ACTIE_SUBFILTER_LABEL[subfilter]} (${n})`;
    }
    if (werkbak === 'alles') return `Verwerk selectie (${n})`;
    return `Verwerk ${WERKBAK_LABEL[werkbak]} (${n})`;
  };

  const primaireVerwerkDisabled = werkronde
    ? (werkrondeVoortgang?.resterend ?? 0) === 0
    : bulkSelectie.size === 0 && gefilterd.length === 0;

  const beeindigWerkronde = () => {
    bewaarWerkronde(null);
    setVerwerkScopeIds(null);
    toast.success('Werkronde beëindigd');
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
    let scopeIds: string[] | null = null;
    if (bulkSelectie.size > 0) {
      scopeIds = readiness.lijst
        .filter((x) => bulkSelectie.has(x.signaal.id))
        .map((x) => x.signaal.id);
    } else if (zoekActief || werkbak !== 'alles') {
      scopeIds = gefilterd.map((x) => x.signaal.id);
    }
    const scopeList = scopeIds
      ? readiness.lijst.filter((x) => scopeIds!.includes(x.signaal.id))
      : readiness.lijst;
    const idx = scopeList.findIndex((x) => x.signaal.id === signaalId);
    const focusTab = focusTabVoorWerkbakContext(werkbakPerSignaal.get(signaalId));
    navigate(`/off-market/${signaalId}?mode=normaal&tab=${focusTab}`, {
      state: {
        fromAcquisitieFocus: true,
        returnToAcquisitieList: true,
        focusIndex: idx >= 0 ? idx : 0,
        focusScopeIds: scopeIds,
        selectedIds: Array.from(bulkSelectie),
        focusTab,
      },
    });
  };

  if (isLoading) {
    return <p className="px-5 py-10 text-sm text-muted-foreground">Selectie laden…</p>;
  }

  const heeftVastgoedkansen = items.some((item) => Boolean(item.vastgoedkans_id));

  if (geselecteerdeSignalen.length === 0 && !heeftVastgoedkansen) {
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

  if (geselecteerdeSignalen.length === 0 && heeftVastgoedkansen) {
    return (
      <section className="space-y-3" data-testid="acquisitie-selectie-tab">
        <VastgoedkansenInAcquisitieSelectie items={items} />
      </section>
    );
  }

  const geselecteerdeSignalenBulk = Array.from(bulkSelectie)
    .map(id => signaalIndex.get(id))
    .filter((s): s is OffMarketSignaal => !!s);

  return (
    <section className="space-y-3" data-testid="acquisitie-selectie-tab">
      {heeftVastgoedkansen && <VastgoedkansenInAcquisitieSelectie items={items} />}
      <AcquisitieKpis kpis={readiness.kpis} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AcquisitieWerkbakChips
          werkbak={werkbak}
          subfilter={subfilter}
          onWerkbakChange={setWerkbak}
          onSubfilterChange={setSubfilter}
          counts={tellingen}
        />
        {!werkronde && (
          <Button
            type="button"
            size="sm"
            variant="default"
            onClick={primaireVerwerkActie}
            data-testid="acquisitie-verwerk-selectie"
            disabled={primaireVerwerkDisabled}
          >
            <PlayCircle className="h-4 w-4" />
            {primaireVerwerkLabel()}
          </Button>
        )}
      </div>

      <div className="section-card px-3 py-2.5" data-testid="acquisitie-zoekbalk">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative w-full sm:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              value={zoekterm}
              onChange={(e) => setZoekterm(e.target.value)}
              placeholder="Zoek adres, eigenaar, BR- of BAT-nummer…"
              className="pl-9"
              aria-label="Zoek in acquisitieselectie"
              data-testid="acquisitie-zoeken"
            />
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground lg:ml-auto">
            <ArrowDownUp className="h-3.5 w-3.5" />
            <span>Sorteren</span>
            <select
              data-testid="acquisitie-sortering"
              value={actieveSortering}
              onChange={(e) => {
                const v = e.target.value;
                setSorteerKeuze(isSorteerOptie(v) ? v : null);
              }}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              {SORTEER_VOLGORDE.map((o) => (
                <option key={o} value={o}>{SORTEER_LABEL[o]}</option>
              ))}
            </select>
            {sorteerKeuze && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setSorteerKeuze(null)}>
                Standaard
              </Button>
            )}
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
          <p className="mr-auto text-[11px] text-muted-foreground">
            {zoekActief
              ? `${gefilterd.length} resultaat${gefilterd.length === 1 ? '' : 'en'} · zoekt in alle werkbakken`
              : `Doorzoek alle ${tellingen.werkbak.alles} signalen in de acquisitieselectie`}
          </p>
          {!zoekActief && werkbak === 'actie' && subfilter === 'printen_posten' && (
            <div
              className="flex flex-wrap items-center gap-1.5"
              data-testid="acquisitie-printpost-chips"
              role="group"
              aria-label="Printen en posten filteren"
            >
              {PRINT_POST_VOLGORDE.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setPrintPost(f)}
                  data-testid={`acquisitie-printpost-${f}`}
                  aria-pressed={printPost === f}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    printPost === f
                      ? 'border-accent/50 bg-accent/15 text-accent font-medium'
                      : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'
                  }`}
                >
                  {PRINT_POST_LABEL[f]} ({tellingen.printPost[f]})
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {werkronde && werkrondeVoortgang && (
        <div
          data-testid="acquisitie-werkronde-balk"
          className="section-card flex flex-wrap items-center justify-between gap-2 px-3 py-2"
        >
          <div className="min-w-0 text-xs">
            <p className="font-medium text-foreground truncate">
              Werkronde: {werkronde.naam}
            </p>
            <p className="text-muted-foreground" data-testid="acquisitie-werkronde-voortgang">
              {voortgangTekst(werkrondeVoortgang)}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button" size="sm" variant="secondary"
              onClick={hervatWerkronde}
              data-testid="acquisitie-werkronde-hervat"
              disabled={werkrondeVoortgang.resterend === 0}
            >
              <PlayCircle className="h-3.5 w-3.5" />
              Hervatten
            </Button>
            <Button
              type="button" size="sm" variant="ghost"
              onClick={beeindigWerkronde}
              data-testid="acquisitie-werkronde-beeindig"
            >
              Beëindigen
            </Button>
          </div>
        </div>
      )}

      <div
        data-testid="acquisitie-bulk-toolbar"
        className="section-card flex flex-wrap items-center justify-between gap-2 px-3 py-2"
      >
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {bulkSelectie.size === 0 ? (
            <Button
              type="button" variant="outline" size="sm"
              onClick={selecteerZichtbareBulk}
              disabled={gefilterd.length === 0}
              data-testid="acquisitie-bulk-selecteer-zichtbare"
            >
              <Users className="h-3.5 w-3.5" />
              Selecteer resultaten ({gefilterd.length})
            </Button>
          ) : (
            <>
              <span className="font-medium text-foreground" data-testid="acquisitie-bulk-telling">
                {bulkTotalen.signalen} geselecteerd · {bulkTotalen.geadresseerden} geadresseerden ·{' '}
                {bulkTotalen.geschikteBrieven} brieven gereed
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={wisBulk}>
                Wis selectie
              </Button>
            </>
          )}
          {bulkSelectie.size > 0 && gefilterd.length > bulkSelectie.size && (
            <Button type="button" variant="ghost" size="sm" onClick={selecteerZichtbareBulk}>
              Selecteer alle {gefilterd.length} resultaten
            </Button>
          )}
        </div>
        {bulkSelectie.size > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button" size="sm" variant="secondary"
              onClick={() => setWizardOpen(true)}
              data-testid="acquisitie-bulk-brieven-voorbereiden"
            >
              <Mail className="h-3.5 w-3.5" />
              Brieven voorbereiden
            </Button>
            <Button
              type="button" size="sm" variant="secondary"
              onClick={() => setPdfOpen(true)}
              data-testid="acquisitie-bulk-gecombineerde-pdf"
            >
              <FileDown className="h-3.5 w-3.5" />
              Conceptbrieven &amp; productie
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={verwijderBulkUitSelectie}
              disabled={verwijderUitSelectie.isPending}
              data-testid="acquisitie-bulk-uit-selectie"
              className="text-destructive hover:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {verwijderUitSelectie.isPending
                ? 'Uit selectie halen…'
                : `Uit Acquisitieselectie (${bulkSelectie.size})`}
            </Button>
          </div>
        )}
      </div>

      {(
        (!zoekActief && werkbak === 'actie' && subfilter === 'printen_posten')
        || (zoekActief && /^(br|bat)[\s-]*\d/i.test(zoekterm.trim()))
      ) && productieOverzicht.actief && (
        <section className="section-card space-y-3 px-3 py-3" data-testid="acquisitie-printbatchbeheer">
          <div className="space-y-1.5">
            <div className="flex min-w-0 items-center justify-between gap-3">
              <p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground">
                <PackageCheck className="h-4 w-4 text-accent" />
                Printbatches
              </p>
              {!productieOverzicht.isLoading && !productieOverzicht.isError && (
                <span className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">
                  {productieOverzicht.modellen.length} {productieOverzicht.modellen.length === 1 ? 'batch' : 'batches'}
                </span>
              )}
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              Download bestaande BAT-bestanden of open de gekoppelde BR-brieven. Er wordt niets opnieuw gegenereerd.
            </p>
          </div>
          {productieOverzicht.isLoading ? (
            <p className="text-xs text-muted-foreground">Printbatches laden…</p>
          ) : (
            <ProductiekernPrintbatchWerkbak
              modellen={productieOverzicht.modellen}
              fout={productieOverzicht.isError}
              repository={productieOverzicht.repository}
              zoekterm={zoekActief ? zoekterm : ''}
            />
          )}
        </section>
      )}

      {gefilterd.length === 0 ? (
        <p className="text-sm text-muted-foreground px-1 py-4">
          {zoekActief
            ? `Geen signalen gevonden voor “${zoekterm.trim()}”.`
            : 'Geen signalen in dit filter.'}
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
            const briefInfo = briefInfoPerSignaal.get(signaal.id);
            const respons = briefInfo?.respons ?? null;
            const productieNummers = productieOverzicht.nummersPerSignaal.get(signaal.id);
            return (
              <AcquisitieDossierRij
                key={signaal.id}
                geselecteerd={bulkChecked}
                onToggle={() => toggleBulk(signaal.id)}
                signaalId={signaal.id}
                fase={r.fase}
                werkbak={ctx.werkbak}
                actieCategorie={ctx.actieCategorie}
                geadresseerden={r.geadresseerden}
                hoofdinhoud={(
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
                        {briefInfo && (
                          <span
                            data-testid="acquisitie-rij-briefstatus"
                            className="inline-flex items-center gap-1"
                          >
                            <SignaalBriefStatusBadge status={briefInfo.status} />
                            {briefInfo.aantalGeadresseerden > 1 && briefInfo.verzonden > 0 && (
                              <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">
                                {briefInfo.verzonden}/{briefInfo.aantalGeadresseerden}
                              </span>
                            )}
                            {briefInfo.status === 'brief2_gepland' && (
                              <span
                                data-testid="acquisitie-rij-opvolging-nodig"
                                className="text-[10px] text-accent whitespace-nowrap"
                              >
                                Opvolging nodig
                              </span>
                            )}
                          </span>
                        )}
                        {productieNummers?.briefnummers.map((nummer) => (
                          <span
                            key={nummer}
                            className="inline-flex rounded border border-border bg-background px-1.5 py-0.5 font-mono-data text-[10px] font-medium text-foreground"
                            data-testid="acquisitie-rij-briefnummer"
                            title={`Formeel briefnummer ${nummer}`}
                          >
                            {nummer}
                          </span>
                        ))}
                        {productieNummers?.batchnummers.map((nummer) => (
                          <span
                            key={nummer}
                            className="inline-flex rounded border border-accent/35 bg-accent/10 px-1.5 py-0.5 font-mono-data text-[10px] font-medium text-accent"
                            data-testid="acquisitie-rij-batchnummer"
                            title={`Printbatch ${nummer}`}
                          >
                            {nummer}
                          </span>
                        ))}
                        {respons && (
                          <span
                            data-testid="acquisitie-rij-responsbadge"
                            className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${badgeClassVoorRespons(respons.status)}`}
                          >
                            <MessageSquare className="h-3.5 w-3.5" />
                            {RESPONS_LABEL[respons.status]}
                          </span>
                        )}
                        {typeof signaal.ai_score === 'number' && (
                          <span
                            data-testid="acquisitie-rij-ai-score"
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-card text-muted-foreground whitespace-nowrap"
                          >
                            <Sparkles className="h-3 w-3" /> AI {signaal.ai_score}
                          </span>
                        )}
                        {(signaal as any).bag_status && <BagKaartBadge signaal={signaal} size="sm" />}
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {r.telling.totaal} geadr.
                        </span>
                        {(() => {
                          const proces = bepaalEigenaarProcesStatus(signaal as any);
                          const kleur = proces === 'gevonden'
                            ? 'border-border bg-card text-muted-foreground'
                            : proces === 'controleren'
                              ? 'border-amber-300 bg-amber-50/60 text-amber-950'
                              : 'border-border bg-muted/40 text-muted-foreground';
                          return (
                            <span
                              data-testid="acquisitie-rij-eigenaarproces"
                              className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${kleur}`}
                            >
                              {EIGENAAR_PROCES_LABEL[proces]}
                            </span>
                          );
                        })()}
                        {toonErfpachtChip(signaal as any) && (
                          <span
                            data-testid="acquisitie-rij-erfpacht"
                            className="inline-flex items-center rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap"
                          >
                            Erfpacht
                          </span>
                        )}
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
                      {respons && (
                        <div
                          data-testid="acquisitie-rij-respons"
                          className="rounded-md border border-accent/30 bg-accent/5 px-2.5 py-2 text-[11px]"
                        >
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <span className="font-semibold text-foreground">Reactie — actie nodig</span>
                            <span className="text-muted-foreground">
                              {RESPONS_LABEL[respons.status]}
                              {respons.datum ? ` · ${respons.datum}` : ''}
                              {respons.kanaal ? ` · ${KANAAL_LABEL[respons.kanaal]}` : ''}
                            </span>
                          </div>
                          {respons.samenvatting && (
                            <p className="mt-1 text-muted-foreground break-words line-clamp-2">
                              {respons.samenvatting}
                            </p>
                          )}
                          <p className="mt-1 font-medium text-foreground">
                            Volgende stap: {vervolgactieVoorRespons(respons.status)}
                          </p>
                        </div>
                      )}
                      <p
                        data-testid="acquisitie-rij-redentekst"
                        className="text-[11px] text-muted-foreground break-words"
                      >
                        {r.blokkadeReden ?? r.info.reden}
                      </p>
                      {ctx.actieCategorie === 'onderzoek' && (() => {
                        const tekst = onderzoekRedenTekst(bepaalOnderzoekRedenen(r));
                        if (!tekst) return null;
                        return (
                          <p
                            data-testid="acquisitie-rij-onderzoekredenen"
                            className="text-[11px] text-destructive break-words"
                          >
                            Nog nodig: {tekst}
                          </p>
                        );
                      })()}
                      <WaarschuwingBadges waarschuwingen={r.waarschuwingen} />
                    </div>
                  </div>
                )}
                acties={(
                  <>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
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
                  </>
                )}
              />
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

    </section>
  );
}
