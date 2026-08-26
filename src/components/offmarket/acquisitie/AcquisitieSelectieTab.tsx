// V1B+V2+Fase1 — Tab-inhoud "Acquisitieselectie".
// Radar en Pandenverkenner delen één operationele werkbank en resultatenlijst.
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
  useVerwijderVastgoedkansUitAcquisitieSelectie,
} from '@/hooks/useAcquisitieSelectie';
import { useOffMarketSignalen } from '@/hooks/useOffMarketSignalen';
import { useVastgoedkansen } from '@/hooks/useVastgoedkansen';
import type { Vastgoedkans } from '@/lib/vastgoedkansen';
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
import VastgoedkansAcquisitieRij from './VastgoedkansAcquisitieRij';
import PandenverkennerBulkKadasterDialog from '@/components/acquisitie/PandenverkennerBulkKadasterDialog';
import PandenverkennerBulkBriefDialog from '@/components/acquisitie/PandenverkennerBulkBriefDialog';
import {
  bepaalVastgoedkansWerkbakContext,
  vastgoedkansNaarSorteerbareRij,
  vastgoedkansPastInView,
  vastgoedkansZoektekst,
  type AcquisitieBronFilter,
} from '@/lib/acquisitie/vastgoedkansWerkbak';
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
const BRON_KEY = 'off-market-acq:bron';

export default function AcquisitieSelectieTab() {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: items = [], isLoading } = useAcquisitieSelectie();
  const verwijderUitSelectie = useVerwijderUitAcquisitieSelectie();
  const verwijderVastgoedkans = useVerwijderVastgoedkansUitAcquisitieSelectie();
  const { data: signalen = [] } = useOffMarketSignalen();
  const { getKansById } = useVastgoedkansen();

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

  const geselecteerdeVastgoedkansen = useMemo<Vastgoedkans[]>(() => {
    const lijst = [...items].sort((a, b) =>
      (a.toegevoegd_op ?? '').localeCompare(b.toegevoegd_op ?? ''),
    );
    return lijst
      .filter(it => typeof it.vastgoedkans_id === 'string' && it.vastgoedkans_id.length > 0)
      .map(it => getKansById(it.vastgoedkans_id!))
      .filter((k): k is Vastgoedkans => Boolean(k));
  }, [items, getKansById]);

  const toegevoegdOpPerSignaal = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const it of items) if (it.signaal_id) m.set(it.signaal_id, it.toegevoegd_op ?? null);
    return m;
  }, [items]);
  const toegevoegdOpPerVastgoedkans = useMemo(() => {
    const m = new Map<string, string | null>();
    for (const it of items) if (it.vastgoedkans_id) m.set(it.vastgoedkans_id, it.toegevoegd_op ?? null);
    return m;
  }, [items]);

  const readiness = useAcquisitieReadiness(geselecteerdeSignalen);
  const signaalIds = useMemo(() => geselecteerdeSignalen.map(s => s.id), [geselecteerdeSignalen]);
  const { data: brieven = [] } = useBrievenVoorSignalen(signaalIds);
  const productieOverzicht = useProductiekernSelectieOverzicht(brieven, geselecteerdeSignalen);

  const initieel = useMemo(leesInitieleView, []);
  const [werkbak, setWerkbakState] = useState<WerkbakView>(initieel.werkbak);
  const [subfilter, setSubfilterState] = useState<ActieSubfilter>(initieel.subfilter);
  const [bronFilter, setBronFilterState] = useState<AcquisitieBronFilter>(() => {
    try {
      const v = sessionStorage.getItem(BRON_KEY);
      return v === 'radar' || v === 'pandenverkenner' ? v : 'alles';
    } catch { return 'alles'; }
  });
  const setBronFilter = (v: AcquisitieBronFilter) => {
    setBronFilterState(v);
    try { sessionStorage.setItem(BRON_KEY, v); } catch { /* ignore */ }
  };
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

  const werkbakPerVastgoedkans = useMemo(() => {
    const m = new Map<string, WerkbakContext>();
    for (const kans of geselecteerdeVastgoedkansen) m.set(kans.id, bepaalVastgoedkansWerkbakContext(kans));
    return m;
  }, [geselecteerdeVastgoedkansen]);

  const tellingen = useMemo(() => {
    const wb: Record<WerkbakView, number> = { actie: 0, wachten: 0, afgehandeld: 0, alles: 0 };
    const sf: Record<ActieSubfilter, number> = {
      alle: 0, onderzoeken: 0, eigenaar_controleren: 0, adres_achterhalen: 0, brief_voorbereiden: 0,
      printen_posten: 0, opvolgen: 0,
    };
    const pp: Record<PrintPostFilter, number> = { alles: 0, te_printen: 0, te_posten: 0 };
    const tel = (ctx: WerkbakContext) => {
      wb.alles += 1;
      wb[ctx.werkbak] += 1;
      if (ctx.werkbak === 'actie' && ctx.actieSubfilter) {
        sf.alle += 1;
        sf[ctx.actieSubfilter] += 1;
        const groep = bepaalPrintPostGroep(ctx.actieCategorie);
        if (groep) { pp.alles += 1; pp[groep] += 1; }
      }
    };
    if (bronFilter !== 'pandenverkenner') for (const ctx of werkbakPerSignaal.values()) tel(ctx);
    if (bronFilter !== 'radar') for (const ctx of werkbakPerVastgoedkans.values()) tel(ctx);
    return { werkbak: wb, subfilter: sf, printPost: pp };
  }, [werkbakPerSignaal, werkbakPerVastgoedkans, bronFilter]);

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
        action: { label: 'Bekijken', onClick: () => navigate(`/off-market/${t.id}`) },
      });
      recenteMutatiesRef.current.delete(t.id);
    }
    vorigeCtxRef.current = huidig;
  }, [werkbakPerSignaal, navigate]);

  const actieveSortering: SorteerOptie = sorteerKeuze
    ?? standaardSortering(werkbak, subfilter, printPost);

  const radarBinnenContext = useMemo(() => {
    const rijen: SorteerbareRij[] = [];
    for (const { signaal, readiness: r } of readiness.lijst) {
      const ctx = werkbakPerSignaal.get(signaal.id);
      if (!ctx) continue;
      if (zoekActief) {
        const productieNummers = productieOverzicht.nummersPerSignaal.get(signaal.id);
        const geadresseerdeTekst = r.geadresseerden
          .flatMap((g) => [g.naam, g.bedrijfsnaam, g.verzendadres])
          .filter(Boolean).join(' ');
        const haystack = normaliseerZoektekst([
          formatSignaalAdres(signaal), cleanAdres(signaal.adres), (signaal as any).postcode,
          cleanPlaats(signaal.plaats), tekstType(signaal), signaal.type_signaal, signaal.id,
          geadresseerdeTekst, 'Radar',
          ...(productieNummers?.briefnummers ?? []), ...(productieNummers?.batchnummers ?? []),
        ].filter(Boolean).join(' '));
        if (!haystack.includes(zoek)) continue;
      } else {
        const inWerkbak = werkbak === 'alles' ? true : ctx.werkbak === werkbak;
        if (!inWerkbak) continue;
        if (werkbak === 'actie' && subfilter !== 'alle' && ctx.actieSubfilter !== subfilter) continue;
        if (werkbak === 'actie' && subfilter === 'printen_posten' && !matchtPrintPostFilter(ctx.actieCategorie, printPost)) continue;
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
    return gesorteerd.map(r => {
      const item = byId.get(r.signaalId);
      return item ? { ...item, ctx: r.ctx } : null;
    }).filter((x): x is NonNullable<typeof x> => x !== null);
  }, [readiness.lijst, werkbakPerSignaal, werkbak, subfilter, printPost, actieveSortering,
    toegevoegdOpPerSignaal, zoek, zoekActief, productieOverzicht.nummersPerSignaal]);

  const gefilterd = useMemo(
    () => bronFilter === 'pandenverkenner' ? [] : radarBinnenContext,
    [bronFilter, radarBinnenContext],
  );

  const pandenverkennerBinnenContext = useMemo(() => {
    const zichtbaar: Array<{ kans: Vastgoedkans; ctx: WerkbakContext; sorteer: SorteerbareRij }> = [];
    for (const kans of geselecteerdeVastgoedkansen) {
      const ctx = werkbakPerVastgoedkans.get(kans.id);
      if (!ctx) continue;
      if (zoekActief) {
        if (!normaliseerZoektekst(vastgoedkansZoektekst(kans)).includes(zoek)) continue;
      } else if (!vastgoedkansPastInView(ctx, werkbak, subfilter, printPost)) continue;
      zichtbaar.push({
        kans,
        ctx,
        sorteer: vastgoedkansNaarSorteerbareRij(kans, toegevoegdOpPerVastgoedkans.get(kans.id) ?? null, ctx),
      });
    }
    const gesorteerd = sorteerRijen(actieveSortering, zoekActief ? 'alles' : werkbak, zichtbaar.map(x => x.sorteer));
    const byId = new Map(zichtbaar.map(x => [x.sorteer.signaalId, x]));
    return gesorteerd.map(r => byId.get(r.signaalId)).filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [geselecteerdeVastgoedkansen, werkbakPerVastgoedkans, zoekActief, zoek,
    werkbak, subfilter, printPost, actieveSortering, toegevoegdOpPerVastgoedkans]);

  const gefilterdeVastgoedkansen = useMemo(
    () => bronFilter === 'radar' ? [] : pandenverkennerBinnenContext,
    [bronFilter, pandenverkennerBinnenContext],
  );

  const gecombineerdeVolgorde = useMemo(() => {
    const radarSort: SorteerbareRij[] = gefilterd.map(({ signaal, ctx }) => ({
      signaalId: signaal.id,
      toegevoegdOp: toegevoegdOpPerSignaal.get(signaal.id) ?? null,
      ctx,
      procesDatumIsoWachten: ctx.werkbak === 'wachten' ? (ctx.procesDatum?.iso ?? null) : null,
      prioriteit: (signaal.prioriteit as string | null) ?? null,
      aiScore: typeof signaal.ai_score === 'number' ? signaal.ai_score : null,
      plaats: cleanPlaats(signaal.plaats) || null,
    }));
    const alle = [...radarSort, ...gefilterdeVastgoedkansen.map(x => x.sorteer)];
    return sorteerRijen(actieveSortering, zoekActief ? 'alles' : werkbak, alle).map(x => x.signaalId);
  }, [gefilterd, gefilterdeVastgoedkansen, actieveSortering, zoekActief, werkbak, toegevoegdOpPerSignaal]);

  const radarGefilterdPerId = useMemo(() => new Map(gefilterd.map(x => [x.signaal.id, x])), [gefilterd]);
  const vastgoedkansGefilterdPerId = useMemo(() => new Map(gefilterdeVastgoedkansen.map(x => [`vastgoedkans:${x.kans.id}`, x])), [gefilterdeVastgoedkansen]);

  const [werkronde, setWerkrondeState] = useState<Werkronde | null>(() => leesWerkronde());
  const bewaarWerkronde = (w: Werkronde | null) => {
    setWerkrondeState(w);
    if (w) schrijfWerkronde(w); else wisWerkronde();
  };

  useEffect(() => {
    if (!werkronde || werkronde.bron === 'handmatig') return;
    let next = werkronde;
    for (const id of werkronde.scopeIds) {
      const ctx = werkbakPerSignaal.get(id);
      if (!ctx) continue;
      if (!hoortWerkbakContextBijBron(werkronde.bron, ctx) && !next.behandeldeIds.includes(id)) next = markeerBehandeld(next, id);
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
    const rest = readiness.lijst.filter(x => set.has(x.signaal.id) && !aanwezig.has(x.signaal.id));
    return [...inVolgorde, ...rest];
  }, [werkronde, gefilterd, readiness.lijst]);

  const [bulkSelectie, setBulkSelectie] = useState<Set<string>>(new Set());
  const [bulkVastgoedkansSelectie, setBulkVastgoedkansSelectie] = useState<Set<string>>(new Set());
  const toggleBulk = (id: string) => setBulkSelectie(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });
  const toggleVastgoedkansBulk = (id: string) => setBulkVastgoedkansSelectie(prev => {
    const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next;
  });

  const brievenPerSignaal = useMemo(() => {
    const m = new Map<string, typeof brieven>();
    for (const b of brieven) {
      const arr = m.get(b.signaal_id) ?? []; arr.push(b); m.set(b.signaal_id, arr);
    }
    return m;
  }, [brieven]);

  const { taken } = useDataStore();
  const briefInfoPerSignaal = useMemo(() => {
    const m = new Map<string, {
      status: BriefStatus; verzonden: number; aantalGeadresseerden: number;
      respons: null | { status: Responsstatus; datum: string | null; kanaal: Kanaal | null; samenvatting: string | null; };
    }>();
    for (const s of geselecteerdeSignalen) {
      const bs = brievenPerSignaal.get(s.id) ?? [];
      const status = bepaalBriefStatus(bs, taken as any, s.id);
      const groepen = groepeerBrievenPerGeadresseerde(bs.filter(b => !b.archived_at));
      const verzonden = groepen.filter(g => g.brieven.some(b => b.status === 'verstuurd')).length;
      const reacties = bs.filter(b => !b.archived_at && !!b.responsstatus)
        .sort((a, b) => String(b.responsdatum ?? (b as any).updated_at ?? b.created_at ?? '')
          .localeCompare(String(a.responsdatum ?? (a as any).updated_at ?? a.created_at ?? '')));
      const laatste = reacties[0];
      m.set(s.id, {
        status, verzonden, aantalGeadresseerden: groepen.length,
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
    let geadresseerden = 0; let geschikt = 0;
    const readinessPerSignaal = new Map(readiness.lijst.map((item) => [item.signaal.id, item.readiness]));
    for (const id of bulkSelectie) {
      const signaalReadiness = readinessPerSignaal.get(id);
      if (!signaalReadiness) continue;
      // De rij en de bulkbar gebruiken bewust exact dezelfde geadresseerdenbron.
      // Een geschikte kandidaat is nog geen gereedstaande brief: daarvoor moet
      // een actief concept én een volledig postadres aanwezig zijn.
      geadresseerden += signaalReadiness.geadresseerden.length;
      geschikt += signaalReadiness.geadresseerden.filter((geadresseerde) =>
        geadresseerde.heeftActiefConcept && geadresseerde.volledigPostadres,
      ).length;
    }
    for (const id of bulkVastgoedkansSelectie) {
      const kans = geselecteerdeVastgoedkansen.find(k => k.id === id);
      if (!kans) continue;
      if (kans.eigenaarNaam || (kans.adres && kans.postcode && kans.plaats)) { geadresseerden += 1; geschikt += 1; }
    }
    return {
      dossiers: bulkSelectie.size + bulkVastgoedkansSelectie.size,
      radar: bulkSelectie.size,
      pandenverkenner: bulkVastgoedkansSelectie.size,
      geadresseerden,
      geschikteBrieven: geschikt,
    };
  }, [bulkSelectie, bulkVastgoedkansSelectie, readiness.lijst, geselecteerdeVastgoedkansen]);

  const geselecteerdeVastgoedkansenBulk = useMemo(
    () => geselecteerdeVastgoedkansen.filter(k => bulkVastgoedkansSelectie.has(k.id)),
    [geselecteerdeVastgoedkansen, bulkVastgoedkansSelectie],
  );

  function selecteerZichtbareBulk() {
    setBulkSelectie(new Set(gefilterd.map(x => x.signaal.id)));
    setBulkVastgoedkansSelectie(new Set(gefilterdeVastgoedkansen.map(x => x.kans.id)));
  }
  function wisBulk() { setBulkSelectie(new Set()); setBulkVastgoedkansSelectie(new Set()); }

  async function verwijderBulkUitSelectie() {
    const signaalIdsBulk = Array.from(bulkSelectie);
    const vastgoedkansIds = Array.from(bulkVastgoedkansSelectie);
    const totaal = signaalIdsBulk.length + vastgoedkansIds.length;
    if (totaal === 0 || verwijderUitSelectie.isPending || verwijderVastgoedkans.isPending) return;
    if (!window.confirm(`${totaal} geselecteerde dossiers uit de acquisitieselectie halen?\n\nDe oorspronkelijke dossiers, brieven en historie blijven behouden.`)) return;
    try {
      for (const id of signaalIdsBulk) await verwijderUitSelectie.mutateAsync(id);
      for (const id of vastgoedkansIds) await verwijderVastgoedkans.mutateAsync(id);
      wisBulk();
      toast.success(`${totaal} dossiers uit de acquisitieselectie gehaald`, { description: 'De oorspronkelijke dossiers en historie zijn behouden.' });
    } catch (err) {
      toast.error('Geselecteerde dossiers uit selectie halen mislukt', { description: err instanceof Error ? err.message : 'Onbekende fout' });
    }
  }

  const [wizardOpen, setWizardOpen] = useState(false);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pandenverkennerKadasterOpen, setPandenverkennerKadasterOpen] = useState(false);
  const [pandenverkennerBriefOpen, setPandenverkennerBriefOpen] = useState(false);

  const [focusOpen, setFocusOpen] = useState(false);
  const [focusIndex, setFocusIndexState] = useState<number>(() => {
    try { const v = sessionStorage.getItem(FOCUS_INDEX_KEY); return v ? Math.max(0, parseInt(v, 10) || 0) : 0; }
    catch { return 0; }
  });
  const setFocusIndex = (i: number) => {
    setFocusIndexState(i); try { sessionStorage.setItem(FOCUS_INDEX_KEY, String(i)); } catch {}
  };
  const [verwerkScopeIds, setVerwerkScopeIds] = useState<string[] | null>(null);
  const focusItems = useMemo(() => {
    if (!verwerkScopeIds || verwerkScopeIds.length === 0) return readiness.lijst;
    const byId = new Map(readiness.lijst.map(x => [x.signaal.id, x]));
    return verwerkScopeIds.map(id => byId.get(id)).filter((x): x is NonNullable<typeof x> => !!x);
  }, [readiness.lijst, verwerkScopeIds]);

  useEffect(() => { try { const v = sessionStorage.getItem(SCROLL_KEY); if (v) window.scrollTo({ top: parseInt(v, 10) || 0 }); } catch {} }, []);
  useEffect(() => {
    const onScroll = () => { try { sessionStorage.setItem(SCROLL_KEY, String(window.scrollY)); } catch {} };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const state = location.state as {
      resumeAcquisitieFocus?: boolean; focusIndex?: number; focusScopeIds?: string[] | null;
      selectedIds?: string[] | null; focusTab?: string | null;
    } | null;
    if (state?.resumeAcquisitieFocus) {
      setVerwerkScopeIds(Array.isArray(state.focusScopeIds) && state.focusScopeIds.length > 0 ? state.focusScopeIds : null);
      if (Array.isArray(state.selectedIds)) setBulkSelectie(new Set(state.selectedIds));
      if (typeof state.focusIndex === 'number') setFocusIndex(state.focusIndex);
      setFocusOpen(true); window.history.replaceState({}, '');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function huidigeBron(): { bron: WerkrondeBron; naam: string } {
    if (zoekActief) return { bron: 'handmatig', naam: `Radar-zoekresultaten (${gefilterd.length})` };
    const bron = werkrondeBronVoorView({ heeftHandmatigeSelectie: bulkSelectie.size > 0, werkbak, subfilter, printPost });
    if (bulkSelectie.size > 0) return { bron, naam: `Radar-selectie (${bulkSelectie.size})` };
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
    bewaarWerkronde(w); setVerwerkScopeIds(ids); setFocusIndex(0); setFocusOpen(true);
  };
  const hervatWerkronde = () => {
    if (!werkronde) return;
    const ids = werkrondeItems.map(x => x.signaal.id); if (ids.length === 0) return;
    const volgende = eerstVolgendeId(werkronde, ids);
    const idx = volgende ? Math.max(0, ids.indexOf(volgende)) : 0;
    setVerwerkScopeIds(ids); setFocusIndex(idx); setFocusOpen(true);
  };
  const primaireVerwerkActie = () => { if (werkronde) hervatWerkronde(); else startNieuweWerkronde(); };
  const primaireVerwerkLabel = (): string => {
    if (werkronde && werkrondeVoortgang) return `Hervat werkronde (${werkrondeVoortgang.resterend})`;
    const n = bulkSelectie.size > 0 ? bulkSelectie.size : gefilterd.length;
    if (bulkSelectie.size > 0) return `Verwerk Radar-selectie (${n})`;
    if (zoekActief) return `Verwerk Radar-resultaten (${n})`;
    if (werkbak === 'actie') {
      if (subfilter === 'alle') return `Verwerk Actie (${n})`;
      if (subfilter === 'printen_posten') return printPost === 'alles' ? `Verwerk Printen & posten (${n})` : `Verwerk ${PRINT_POST_LABEL[printPost]} (${n})`;
      return `Verwerk ${ACTIE_SUBFILTER_LABEL[subfilter]} (${n})`;
    }
    if (werkbak === 'alles') return `Verwerk Radar-selectie (${n})`;
    return `Verwerk ${WERKBAK_LABEL[werkbak]} (${n})`;
  };
  const primaireVerwerkDisabled = werkronde ? (werkrondeVoortgang?.resterend ?? 0) === 0 : bulkSelectie.size === 0 && gefilterd.length === 0;
  const beeindigWerkronde = () => { bewaarWerkronde(null); setVerwerkScopeIds(null); toast.success('Werkronde beëindigd'); };
  const openVerwerkVanSignaal = (signaalId: string) => {
    setVerwerkScopeIds(null); const idx = readiness.lijst.findIndex(x => x.signaal.id === signaalId);
    if (idx >= 0) { setFocusIndex(idx); setFocusOpen(true); }
  };
  const openSignaalMetContext = (signaalId: string) => {
    let scopeIds: string[] | null = null;
    if (bulkSelectie.size > 0) scopeIds = readiness.lijst.filter(x => bulkSelectie.has(x.signaal.id)).map(x => x.signaal.id);
    else if (zoekActief || werkbak !== 'alles') scopeIds = gefilterd.map(x => x.signaal.id);
    const scopeList = scopeIds ? readiness.lijst.filter(x => scopeIds!.includes(x.signaal.id)) : readiness.lijst;
    const idx = scopeList.findIndex(x => x.signaal.id === signaalId);
    const focusTab = focusTabVoorWerkbakContext(werkbakPerSignaal.get(signaalId));
    navigate(`/off-market/${signaalId}?mode=normaal&tab=${focusTab}`, {
      state: { fromAcquisitieFocus: true, returnToAcquisitieList: true, focusIndex: idx >= 0 ? idx : 0,
        focusScopeIds: scopeIds, selectedIds: Array.from(bulkSelectie), focusTab },
    });
  };

  if (isLoading) return <p className="px-5 py-10 text-sm text-muted-foreground">Selectie laden…</p>;
  if (geselecteerdeSignalen.length === 0 && geselecteerdeVastgoedkansen.length === 0) {
    return (
      <section className="section-card px-5 py-12 text-center">
        <div className="flex flex-col items-center gap-3">
          <div className="rounded-full bg-muted/60 p-3"><Inbox className="h-6 w-6 text-muted-foreground" /></div>
          <h3 className="text-base font-medium text-foreground">Nog geen dossiers in selectie</h3>
          <p className="max-w-md text-sm text-muted-foreground">Voeg interessante Radar-signalen of Vastgoedkansen toe aan de Acquisitieselectie. De selectie blijft bewaard en is zichtbaar voor het hele team.</p>
        </div>
      </section>
    );
  }

  const geselecteerdeSignalenBulk = Array.from(bulkSelectie).map(id => signaalIndex.get(id)).filter((s): s is OffMarketSignaal => !!s);
  const totaalSelectie = bulkSelectie.size + bulkVastgoedkansSelectie.size;
  const totaalZichtbaar = gecombineerdeVolgorde.length;
  const bronTellingen = {
    radar: radarBinnenContext.length,
    pandenverkenner: pandenverkennerBinnenContext.length,
  };
  const contextTotaal = bronTellingen.radar + bronTellingen.pandenverkenner;
  const contextLabel = zoekActief
    ? 'zoekresultaten in alle werkbakken'
    : werkbak === 'actie'
      ? subfilter === 'alle'
        ? 'Actie'
        : subfilter === 'printen_posten'
          ? `${ACTIE_SUBFILTER_LABEL[subfilter]} · ${PRINT_POST_LABEL[printPost]}`
          : ACTIE_SUBFILTER_LABEL[subfilter]
      : WERKBAK_LABEL[werkbak];
  const vkKpis = {
    signalen: geselecteerdeVastgoedkansen.length,
    geadresseerden: geselecteerdeVastgoedkansen.filter(k => Boolean(k.eigenaarNaam || (k.adres && k.postcode && k.plaats))).length,
    printklaar: geselecteerdeVastgoedkansen.filter(k => werkbakPerVastgoedkans.get(k.id)?.actieCategorie === 'gereed_voor_print').length,
    geblokkeerd: geselecteerdeVastgoedkansen.filter(k => !(k.adres && k.postcode && k.plaats)).length,
    opvolgingOpen: geselecteerdeVastgoedkansen.filter(k => werkbakPerVastgoedkans.get(k.id)?.actieSubfilter === 'opvolgen').length,
  };
  const kpis = bronFilter === 'radar' ? readiness.kpis : bronFilter === 'pandenverkenner' ? vkKpis : {
    signalen: readiness.kpis.signalen + vkKpis.signalen,
    geadresseerden: readiness.kpis.geadresseerden + vkKpis.geadresseerden,
    printklaar: readiness.kpis.printklaar + vkKpis.printklaar,
    geblokkeerd: readiness.kpis.geblokkeerd + vkKpis.geblokkeerd,
    opvolgingOpen: readiness.kpis.opvolgingOpen + vkKpis.opvolgingOpen,
  };

  const renderRadarRij = (signaalId: string) => {
    const item = radarGefilterdPerId.get(signaalId);
    if (!item) return null;
    const { signaal, readiness: r, ctx } = item;
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
            <Checkbox checked={bulkChecked} onCheckedChange={() => toggleBulk(signaal.id)} aria-label="Selecteer signaal voor bulkacties" data-testid="acquisitie-rij-bulkcheck" className="mt-1" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium text-foreground break-words">{adres}</p>
                <span data-testid="acquisitie-bronchip-radar" className="inline-flex rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground whitespace-nowrap">Radar</span>
              </div>
              {plaats && <p className="text-xs text-muted-foreground break-words">{plaats}</p>}
              <div className="flex flex-wrap items-center gap-1.5">
                <ReadinessBadge fase={r.fase} />
                <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-muted/40 text-muted-foreground whitespace-nowrap">{tekstType(signaal)}</span>
                <span onClick={e => e.stopPropagation()} className="inline-flex"><StatusWijzigDropdown signaal={signaal} variant="compact" /></span>
                <span onClick={e => e.stopPropagation()} className="inline-flex"><PrioriteitWijzigDropdown signaalId={signaal.id} prioriteit={signaal.prioriteit} /></span>
                <span onClick={e => e.stopPropagation()} className="inline-flex"><EigenaarstatusWijzigDropdown signaalId={signaal.id} eigenaarstatus={((signaal as any).eigenaarstatus as OffMarketEigenaarstatus | null) ?? 'onbekend'} /></span>
                {briefInfo && (
                  <span data-testid="acquisitie-rij-briefstatus" className="inline-flex items-center gap-1">
                    <SignaalBriefStatusBadge status={briefInfo.status} />
                    {briefInfo.aantalGeadresseerden > 1 && briefInfo.verzonden > 0 && <span className="text-[10px] text-muted-foreground whitespace-nowrap tabular-nums">{briefInfo.verzonden}/{briefInfo.aantalGeadresseerden}</span>}
                    {briefInfo.status === 'brief2_gepland' && <span data-testid="acquisitie-rij-opvolging-nodig" className="text-[10px] text-accent whitespace-nowrap">Opvolging nodig</span>}
                  </span>
                )}
                {productieNummers?.briefnummers.map(nummer => <span key={nummer} className="inline-flex rounded border border-border bg-background px-1.5 py-0.5 font-mono-data text-[10px] font-medium text-foreground" data-testid="acquisitie-rij-briefnummer" title={`Formeel briefnummer ${nummer}`}>{nummer}</span>)}
                {productieNummers?.batchnummers.map(nummer => <span key={nummer} className="inline-flex rounded border border-accent/35 bg-accent/10 px-1.5 py-0.5 font-mono-data text-[10px] font-medium text-accent" data-testid="acquisitie-rij-batchnummer" title={`Printbatch ${nummer}`}>{nummer}</span>)}
                {respons && <span data-testid="acquisitie-rij-responsbadge" className={`inline-flex items-center gap-1 rounded border px-2 py-1 ${badgeClassVoorRespons(respons.status)}`}><MessageSquare className="h-3.5 w-3.5" />{RESPONS_LABEL[respons.status]}</span>}
                {typeof signaal.ai_score === 'number' && <span data-testid="acquisitie-rij-ai-score" className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-border bg-card text-muted-foreground whitespace-nowrap"><Sparkles className="h-3 w-3" /> AI {signaal.ai_score}</span>}
                {(signaal as any).bag_status && <BagKaartBadge signaal={signaal} size="sm" />}
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">{r.telling.totaal} geadr.</span>
                {(() => {
                  const proces = bepaalEigenaarProcesStatus(signaal as any);
                  const kleur = proces === 'gevonden' ? 'border-border bg-card text-muted-foreground' : proces === 'controleren' ? 'border-amber-300 bg-amber-50/60 text-amber-950' : 'border-border bg-muted/40 text-muted-foreground';
                  return <span data-testid="acquisitie-rij-eigenaarproces" className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium whitespace-nowrap ${kleur}`}>{EIGENAAR_PROCES_LABEL[proces]}</span>;
                })()}
                {toonErfpachtChip(signaal as any) && <span data-testid="acquisitie-rij-erfpacht" className="inline-flex items-center rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] text-muted-foreground whitespace-nowrap">Erfpacht</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {ctx.procesDatum && <span data-testid="acquisitie-rij-procesdatum" title={ctx.procesDatum.a11yLabel}>{ctx.procesDatum.label}</span>}
                {toegevoegd && <span data-testid="acquisitie-rij-toegevoegd" title={toegevoegd.volledig}>Toegevoegd {toegevoegd.relatief}</span>}
              </div>
              {respons && (
                <div data-testid="acquisitie-rij-respons" className="rounded-md border border-accent/30 bg-accent/5 px-2.5 py-2 text-[11px]">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><span className="font-semibold text-foreground">Reactie — actie nodig</span><span className="text-muted-foreground">{RESPONS_LABEL[respons.status]}{respons.datum ? ` · ${respons.datum}` : ''}{respons.kanaal ? ` · ${KANAAL_LABEL[respons.kanaal]}` : ''}</span></div>
                  {respons.samenvatting && <p className="mt-1 text-muted-foreground break-words line-clamp-2">{respons.samenvatting}</p>}
                  <p className="mt-1 font-medium text-foreground">Volgende stap: {vervolgactieVoorRespons(respons.status)}</p>
                </div>
              )}
              <p data-testid="acquisitie-rij-redentekst" className="text-[11px] text-muted-foreground break-words">{r.blokkadeReden ?? r.info.reden}</p>
              {ctx.actieCategorie === 'onderzoek' && (() => {
                const tekst = onderzoekRedenTekst(bepaalOnderzoekRedenen(r));
                return tekst ? <p data-testid="acquisitie-rij-onderzoekredenen" className="text-[11px] text-destructive break-words">Nog nodig: {tekst}</p> : null;
              })()}
              <WaarschuwingBadges waarschuwingen={r.waarschuwingen} />
            </div>
          </div>
        )}
        acties={(
          <>
            <Button type="button" size="sm" variant="outline" onClick={() => openSignaalMetContext(signaal.id)} data-testid="acquisitie-selectie-open"><ExternalLink className="h-3.5 w-3.5" />Open signaal</Button>
            <Button type="button" size="sm" variant="default" onClick={() => openVerwerkVanSignaal(signaal.id)} data-testid="acquisitie-selectie-verwerk"><PlayCircle className="h-3.5 w-3.5" />Verwerk</Button>
            <ToevoegenAanAcquisitieSelectieKnop signaalId={signaal.id} variant="compact" labelMode="remove" isInSelectie />
          </>
        )}
      />
    );
  };

  return (
    <section className="space-y-3" data-testid="acquisitie-selectie-tab">
      <AcquisitieKpis kpis={kpis} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <AcquisitieWerkbakChips werkbak={werkbak} subfilter={subfilter} onWerkbakChange={setWerkbak} onSubfilterChange={setSubfilter} counts={tellingen} />
        {!werkronde && bronFilter !== 'pandenverkenner' && gefilterd.length > 0 && (
          <Button type="button" size="sm" variant="default" onClick={primaireVerwerkActie} data-testid="acquisitie-verwerk-selectie" disabled={primaireVerwerkDisabled}>
            <PlayCircle className="h-4 w-4" />{primaireVerwerkLabel()}
          </Button>
        )}
      </div>

      <div className="section-card px-3 py-2.5" data-testid="acquisitie-zoekbalk">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
          <div className="relative w-full sm:max-w-xl">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input type="search" value={zoekterm} onChange={e => setZoekterm(e.target.value)} placeholder="Zoek adres, eigenaar, BR- of BAT-nummer…" className="pl-9" aria-label="Zoek in acquisitieselectie" data-testid="acquisitie-zoeken" />
          </div>
          <label className="flex shrink-0 items-center gap-2 text-xs text-muted-foreground lg:ml-auto">
            <ArrowDownUp className="h-3.5 w-3.5" /><span>Sorteren</span>
            <select data-testid="acquisitie-sortering" value={actieveSortering} onChange={e => { const v = e.target.value; setSorteerKeuze(isSorteerOptie(v) ? v : null); }} className="rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
              {SORTEER_VOLGORDE.map(o => <option key={o} value={o}>{SORTEER_LABEL[o]}</option>)}
            </select>
            {sorteerKeuze && <Button type="button" variant="ghost" size="sm" onClick={() => setSorteerKeuze(null)}>Standaard</Button>}
          </label>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border/60 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground" data-testid="acquisitie-bron-context">
            Binnen {contextLabel}
          </span>
          <div className="flex flex-wrap items-center gap-1.5" data-testid="acquisitie-bronfilter" role="group" aria-label="Filter acquisitiedossiers op bron">
            {([
              ['alles', `Alles (${bronTellingen.radar + bronTellingen.pandenverkenner})`],
              ['radar', `Radar (${bronTellingen.radar})`],
              ['pandenverkenner', `Pandenverkenner (${bronTellingen.pandenverkenner})`],
            ] as const).map(([bron, label]) => (
              <button key={bron} type="button" onClick={() => setBronFilter(bron)} data-testid={`acquisitie-bron-${bron}`} aria-pressed={bronFilter === bron}
                className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${bronFilter === bron ? 'border-accent/50 bg-accent/15 text-accent font-medium' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'}`}>{label}</button>
            ))}
          </div>
          <p className="mr-auto text-[11px] text-muted-foreground">
            {contextTotaal} {contextTotaal === 1 ? 'dossier' : 'dossiers'} in deze context · {geselecteerdeSignalen.length + geselecteerdeVastgoedkansen.length} totaal in Acquisitieselectie
          </p>
          {!zoekActief && werkbak === 'actie' && subfilter === 'printen_posten' && (
            <div className="flex flex-wrap items-center gap-1.5" data-testid="acquisitie-printpost-chips" role="group" aria-label="Printen en posten filteren">
              {PRINT_POST_VOLGORDE.map(f => (
                <button key={f} type="button" onClick={() => setPrintPost(f)} data-testid={`acquisitie-printpost-${f}`} aria-pressed={printPost === f}
                  className={`rounded-full border px-2.5 py-1 text-xs transition-colors ${printPost === f ? 'border-accent/50 bg-accent/15 text-accent font-medium' : 'border-border bg-muted/30 text-muted-foreground hover:bg-muted/60'}`}>{PRINT_POST_LABEL[f]} ({tellingen.printPost[f]})</button>
              ))}
            </div>
          )}
        </div>
      </div>

      {werkronde && werkrondeVoortgang && (
        <div data-testid="acquisitie-werkronde-balk" className="section-card flex flex-wrap items-center justify-between gap-2 px-3 py-2">
          <div className="min-w-0 text-xs"><p className="font-medium text-foreground truncate">Werkronde: {werkronde.naam}</p><p className="text-muted-foreground" data-testid="acquisitie-werkronde-voortgang">{voortgangTekst(werkrondeVoortgang)}</p></div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="secondary" onClick={hervatWerkronde} data-testid="acquisitie-werkronde-hervat" disabled={werkrondeVoortgang.resterend === 0}><PlayCircle className="h-3.5 w-3.5" />Hervatten</Button>
            <Button type="button" size="sm" variant="ghost" onClick={beeindigWerkronde} data-testid="acquisitie-werkronde-beeindig">Beëindigen</Button>
          </div>
        </div>
      )}

      <div
        data-testid="acquisitie-bulk-toolbar"
        className={`section-card flex flex-col items-stretch justify-between gap-2 px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center ${totaalSelectie > 0 ? 'acquisitie-selection-glass left-1/2 z-50 w-[calc(100vw-1rem)] max-w-6xl -translate-x-1/2 lg:left-[calc((100vw+var(--app-sidebar-width))/2)] lg:w-[calc(100vw-var(--app-sidebar-width)-1rem)]' : ''}`}
        style={totaalSelectie > 0 ? {
          position: 'fixed',
          bottom: 'calc(0.5rem + env(safe-area-inset-bottom))',
        } : undefined}
      >
        <div className="acquisitie-selection-summary flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {totaalSelectie === 0 ? (
            <Button type="button" variant="outline" size="sm" onClick={selecteerZichtbareBulk} disabled={totaalZichtbaar === 0} data-testid="acquisitie-bulk-selecteer-zichtbare"><Users className="h-3.5 w-3.5" />Selecteer resultaten ({totaalZichtbaar})</Button>
          ) : (
            <><span className="font-medium text-foreground" data-testid="acquisitie-bulk-telling">{bulkTotalen.dossiers} geselecteerd · {bulkTotalen.radar} Radar · {bulkTotalen.pandenverkenner} Pandenverkenner · {bulkTotalen.geadresseerden} geadresseerden · {bulkTotalen.geschikteBrieven} brieven gereed</span><Button type="button" variant="ghost" size="sm" onClick={wisBulk}>Wis selectie</Button></>
          )}
          {totaalSelectie > 0 && totaalZichtbaar > totaalSelectie && <Button type="button" variant="ghost" size="sm" onClick={selecteerZichtbareBulk}>Selecteer alle {totaalZichtbaar} resultaten</Button>}
        </div>
        {totaalSelectie > 0 && (
          <div className="acquisitie-selection-actions grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {bulkSelectie.size > 0 && <Button type="button" size="sm" variant="secondary" onClick={() => setWizardOpen(true)} data-testid="acquisitie-bulk-brieven-voorbereiden"><Mail className="h-3.5 w-3.5" />Radar-brieven</Button>}
            {bulkSelectie.size > 0 && <Button type="button" size="sm" variant="secondary" onClick={() => setPdfOpen(true)} data-testid="acquisitie-bulk-gecombineerde-pdf"><FileDown className="h-3.5 w-3.5" />Radar-productie</Button>}
            {bulkVastgoedkansSelectie.size > 0 && <Button type="button" size="sm" variant="secondary" onClick={() => setPandenverkennerKadasterOpen(true)} data-testid="acquisitie-bulk-kadaster-vastgoedkansen">Bulk Kadaster</Button>}
            {bulkVastgoedkansSelectie.size > 0 && <Button type="button" size="sm" variant="secondary" onClick={() => setPandenverkennerBriefOpen(true)} data-testid="acquisitie-bulk-brieven-vastgoedkansen"><Mail className="h-3.5 w-3.5" />Pandenverkenner-brieven</Button>}
            <Button type="button" size="sm" variant="ghost" onClick={verwijderBulkUitSelectie} disabled={verwijderUitSelectie.isPending || verwijderVastgoedkans.isPending} data-testid="acquisitie-bulk-uit-selectie" className="text-destructive hover:text-destructive"><Trash2 className="h-3.5 w-3.5" />Uit Acquisitieselectie ({totaalSelectie})</Button>
          </div>
        )}
      </div>
      {totaalSelectie > 0 && <div aria-hidden="true" className="h-36 sm:h-24" data-testid="acquisitie-bulk-toolbar-ruimte" />}

      {((!zoekActief && werkbak === 'actie' && subfilter === 'printen_posten') || (zoekActief && /^(br|bat)[\s-]*\d/i.test(zoekterm.trim()))) && productieOverzicht.actief && bronFilter !== 'pandenverkenner' && (
        <section className="section-card space-y-3 px-3 py-3" data-testid="acquisitie-printbatchbeheer">
          <div className="space-y-1.5"><div className="flex min-w-0 items-center justify-between gap-3"><p className="flex min-w-0 items-center gap-2 text-sm font-semibold text-foreground"><PackageCheck className="h-4 w-4 text-accent" />Printbatches</p>{!productieOverzicht.isLoading && !productieOverzicht.isError && <span className="shrink-0 rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">{productieOverzicht.modellen.length} {productieOverzicht.modellen.length === 1 ? 'batch' : 'batches'}</span>}</div><p className="text-[11px] leading-relaxed text-muted-foreground">Download bestaande BAT-bestanden of open de gekoppelde BR-brieven. Er wordt niets opnieuw gegenereerd.</p></div>
          {productieOverzicht.isLoading ? <p className="text-xs text-muted-foreground">Printbatches laden…</p> : <ProductiekernPrintbatchWerkbak modellen={productieOverzicht.modellen} fout={productieOverzicht.isError} repository={productieOverzicht.repository} zoekterm={zoekActief ? zoekterm : ''} />}
        </section>
      )}

      {totaalZichtbaar === 0 ? (
        <p className="text-sm text-muted-foreground px-1 py-4">{zoekActief ? `Geen dossiers gevonden voor “${zoekterm.trim()}”.` : 'Geen dossiers in dit filter.'}</p>
      ) : (
        <ul className="section-card divide-y divide-border/70" data-testid="acquisitie-selectie-lijst">
          {gecombineerdeVolgorde.map(id => {
            if (id.startsWith('vastgoedkans:')) {
              const item = vastgoedkansGefilterdPerId.get(id); if (!item) return null;
              return <VastgoedkansAcquisitieRij key={id} kans={item.kans} ctx={item.ctx} geselecteerd={bulkVastgoedkansSelectie.has(item.kans.id)} toegevoegdOp={toegevoegdOpPerVastgoedkans.get(item.kans.id) ?? null} onToggle={() => toggleVastgoedkansBulk(item.kans.id)} onVerwijder={() => void verwijderVastgoedkans.mutateAsync(item.kans.id)} verwijderBezig={verwijderVastgoedkans.isPending} />;
            }
            return renderRadarRij(id);
          })}
        </ul>
      )}

      <FocusModus open={focusOpen} onClose={() => { setFocusOpen(false); setVerwerkScopeIds(null); }} items={focusItems} index={focusIndex} onIndexChange={setFocusIndex} focusScopeIds={verwerkScopeIds} selectedIds={Array.from(bulkSelectie)} />
      <BulkBriefVoorbereidenWizard open={wizardOpen} onClose={() => setWizardOpen(false)} signalen={geselecteerdeSignalenBulk} brieven={brieven.filter(b => bulkSelectie.has(b.signaal_id))} />
      <GecombineerdeBrievenPdfDialog open={pdfOpen} onClose={() => setPdfOpen(false)} signalen={geselecteerdeSignalenBulk} toegevoegdOpPerSignaal={toegevoegdOpPerSignaal} brieven={brieven.filter(b => bulkSelectie.has(b.signaal_id))} />
      <PandenverkennerBulkKadasterDialog open={pandenverkennerKadasterOpen} onOpenChange={setPandenverkennerKadasterOpen} kansen={geselecteerdeVastgoedkansenBulk} />
      <PandenverkennerBulkBriefDialog open={pandenverkennerBriefOpen} onOpenChange={setPandenverkennerBriefOpen} kansen={geselecteerdeVastgoedkansenBulk} />
    </section>
  );
}
