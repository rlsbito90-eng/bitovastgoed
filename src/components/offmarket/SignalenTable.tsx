import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar, ExternalLink, Eye, ChevronLeft, ChevronRight } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { OffMarketStatusBadge, OffMarketPriorityBadge, OffMarketAiStatusBadge, OffMarketEigenaarstatusBadge } from '@/components/offmarket/OffMarketBadges';
import {
  BRON_TYPE_LABEL, VERGUNNINGTYPE_LABEL, AANVRAAG_BESLUIT_LABEL, ASSETTYPE_LABEL,
  type OffMarketSignaal, type OffMarketVergunningtype, type OffMarketAanvraagOfBesluit,
  type OffMarketEigenaarstatus,
} from '@/lib/offMarket/types';
import { relevantieBucket } from '@/lib/offMarket/relevantie';
import { cleanPlaats, cleanAdres, formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';
import { useDataStore } from '@/hooks/useDataStore';
import { getListScrollY, saveListLastViewed } from '@/lib/listNavigation';
import ToevoegenAanAcquisitieSelectieKnop from '@/components/offmarket/acquisitie/ToevoegenAanAcquisitieSelectieKnop';
import InSelectieBadge from '@/components/offmarket/acquisitie/InSelectieBadge';
import { useActieveSelectieIds } from '@/hooks/useAcquisitieSelectie';

interface Props {
  signalen: OffMarketSignaal[];
  laden: boolean;
  /** Optioneel: override default-zichtbaarheid. Wanneer leeg: standaardkolommen. */
  zichtbareKolommen?: string[];
  /** Optioneel: id van laatst bekeken signaal — wordt visueel gehighlight. */
  highlightedId?: string | null;
}

const STANDAARD_PAGINA_GROOTTE = 50;
const PAGINA_GROOTTES = [50, 100] as const;
const PAGINA_STORAGE_KEY = 'off-market-signalen:pagina';
const PAGINA_GROOTTE_STORAGE_KEY = 'off-market-signalen:pagina-grootte';
const SM_BREAKPOINT_QUERY = '(min-width: 640px)';

function leesOpgeslagenPagina(): number {
  try {
    const value = Number(sessionStorage.getItem(PAGINA_STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : 1;
  } catch {
    return 1;
  }
}

function leesOpgeslagenPaginaGrootte(): number {
  try {
    const value = Number(sessionStorage.getItem(PAGINA_GROOTTE_STORAGE_KEY));
    return PAGINA_GROOTTES.includes(value as (typeof PAGINA_GROOTTES)[number])
      ? value
      : STANDAARD_PAGINA_GROOTTE;
  } catch {
    return STANDAARD_PAGINA_GROOTTE;
  }
}

function bewaarPagina(page: number) {
  try { sessionStorage.setItem(PAGINA_STORAGE_KEY, String(page)); } catch { /* ignore */ }
}

function bewaarPaginaGrootte(pageSize: number) {
  try { sessionStorage.setItem(PAGINA_GROOTTE_STORAGE_KEY, String(pageSize)); } catch { /* ignore */ }
}

function useDesktopSignalenLayout() {
  const [desktop, setDesktop] = useState(() => (
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(SM_BREAKPOINT_QUERY).matches
      : false
  ));

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(SM_BREAKPOINT_QUERY);
    const update = () => setDesktop(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  return desktop;
}

function formatDateNL(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('nl-NL'); } catch { return d; }
}

/** Compacte datum: dd-mm-jj */
function formatDateCompact(d: string | null) {
  if (!d) return '—';
  try {
    const dt = new Date(d);
    const dd = String(dt.getDate()).padStart(2, '0');
    const mm = String(dt.getMonth() + 1).padStart(2, '0');
    const yy = String(dt.getFullYear()).slice(-2);
    return `${dd}-${mm}-${yy}`;
  } catch { return d; }
}

function vergunningLabel(s: OffMarketSignaal): string {
  const vt = (s as any).vergunningtype as OffMarketVergunningtype | null | undefined;
  if (vt) return VERGUNNINGTYPE_LABEL[vt];
  return relevantieBucket(s).label;
}

function aanvraagBesluitLabel(s: OffMarketSignaal): string {
  const ab = (s as any).aanvraag_of_besluit as OffMarketAanvraagOfBesluit | null | undefined;
  if (!ab) return '—';
  return AANVRAAG_BESLUIT_LABEL[ab];
}

function eigenaarstatusVan(s: OffMarketSignaal): OffMarketEigenaarstatus {
  return ((s as any).eigenaarstatus as OffMarketEigenaarstatus | null | undefined) ?? 'onbekend';
}

function brondatumOfCreated(s: OffMarketSignaal): string | null {
  return s.bron_datum ?? s.created_at ?? null;
}

/** Centrale kolomconfiguratie — basis voor toekomstige kolomkiezer (D.1.6). */
export interface SignalenKolomCtx {
  relatieNaam: (id: string | null) => string | null;
}

export interface SignalenKolom {
  id: string;
  label: string;
  defaultVisible: boolean;
  headerClassName?: string;
  cellClassName?: string;
  render: (s: OffMarketSignaal, ctx: SignalenKolomCtx) => ReactNode;
}

export const SIGNALEN_KOLOMMEN: SignalenKolom[] = [
  {
    id: 'vergunningtype',
    label: 'Vergunningtype',
    defaultVisible: true,
    render: (s) => (
      <span className="inline-flex px-1.5 py-0.5 text-[11px] font-medium rounded-full border border-accent/30 bg-accent/10 text-accent whitespace-nowrap">
        {vergunningLabel(s)}
      </span>
    ),
  },
  {
    id: 'aanvraag_of_besluit',
    label: 'Aanvraag/Besluit',
    defaultVisible: false,
    cellClassName: 'text-xs text-muted-foreground uppercase tracking-wide',
    render: (s) => aanvraagBesluitLabel(s),
  },
  {
    id: 'adres',
    label: 'Adres',
    defaultVisible: true,
    cellClassName: 'max-w-[260px]',
    render: (s) => {
      const a = s as any;
      const gebied = a.geo_status === 'verrijkt'
        ? [a.geo_gemeente_naam, a.geo_buurt_naam ?? a.geo_wijk_naam].filter(Boolean).join(' · ')
        : null;
      return (
        <div className="min-w-0">
          <p className="text-sm text-foreground truncate">{cleanAdres(s.adres) || '—'}</p>
          {gebied && <p className="text-[11px] text-muted-foreground truncate">{gebied}</p>}
        </div>
      );
    },
  },
  {
    id: 'postcode',
    label: 'Postcode',
    defaultVisible: false,
    cellClassName: 'text-xs font-mono-data text-muted-foreground',
    render: (s) => s.postcode || '—',
  },
  {
    id: 'plaats',
    label: 'Plaats',
    defaultVisible: true,
    cellClassName: 'text-sm text-foreground',
    render: (s) => cleanPlaats(s.plaats) || '—',
  },
  {
    id: 'provincie',
    label: 'Provincie',
    defaultVisible: false,
    cellClassName: 'text-xs text-muted-foreground',
    render: (s) => s.provincie || '—',
  },
  {
    id: 'assettype',
    label: 'Assettype',
    defaultVisible: false,
    cellClassName: 'text-xs text-muted-foreground',
    render: (s) => (s.assettype ? ASSETTYPE_LABEL[s.assettype] : '—'),
  },
  {
    id: 'ai_score',
    label: 'AI-score',
    defaultVisible: true,
    headerClassName: 'text-right',
    cellClassName: 'text-right font-mono-data text-sm',
    render: (s) => (typeof s.ai_score === 'number' ? s.ai_score : '—'),
  },
  {
    id: 'ai_status',
    label: 'AI-status',
    defaultVisible: false,
    render: (s) => <OffMarketAiStatusBadge status={s.ai_status} />,
  },
  {
    id: 'status',
    label: 'Status',
    defaultVisible: true,
    render: (s) => <OffMarketStatusBadge status={s.status} />,
  },
  {
    id: 'prioriteit',
    label: 'Prioriteit',
    defaultVisible: false,
    render: (s) => <OffMarketPriorityBadge prioriteit={s.prioriteit} />,
  },
  {
    id: 'eigenaar',
    label: 'Eigenaar',
    defaultVisible: true,
    render: (s) => <OffMarketEigenaarstatusBadge status={eigenaarstatusVan(s)} />,
  },
  {
    id: 'relatie',
    label: 'Relatie',
    defaultVisible: false,
    cellClassName: 'text-xs text-muted-foreground max-w-[160px] truncate',
    render: (s, ctx) => ctx.relatieNaam(s.eigenaar_relatie_id) ?? '—',
  },
  {
    id: 'brondatum',
    label: 'Brondatum',
    defaultVisible: true,
    cellClassName: 'text-xs font-mono-data text-foreground whitespace-nowrap',
    render: (s) => formatDateCompact(brondatumOfCreated(s)),
  },
  {
    id: 'bron',
    label: 'Bron',
    defaultVisible: false,
    cellClassName: 'text-xs',
    render: (s) => (
      <>
        <span className="text-muted-foreground">{s.bron_type ? BRON_TYPE_LABEL[s.bron_type] : '—'}</span>
        {s.bron_url && (
          <a href={s.bron_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="ml-1 inline-flex text-accent hover:underline">
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </>
    ),
  },
];

export const STANDAARD_ZICHTBARE_KOLOMMEN = SIGNALEN_KOLOMMEN.filter(k => k.defaultVisible).map(k => k.id);

function paginaknoppen(huidigePagina: number, totaalPaginas: number): Array<number | 'ellipsis'> {
  if (totaalPaginas <= 7) return Array.from({ length: totaalPaginas }, (_, i) => i + 1);

  const kandidaten = new Set([1, totaalPaginas]);
  for (let p = huidigePagina - 2; p <= huidigePagina + 2; p += 1) {
    if (p > 1 && p < totaalPaginas) kandidaten.add(p);
  }
  const paginaNummers = [...kandidaten].sort((a, b) => a - b);
  const resultaat: Array<number | 'ellipsis'> = [];
  paginaNummers.forEach((pagina, index) => {
    const vorige = paginaNummers[index - 1];
    if (vorige && pagina - vorige > 1) resultaat.push('ellipsis');
    resultaat.push(pagina);
  });
  return resultaat;
}

export default function SignalenTable({ signalen, laden, zichtbareKolommen, highlightedId }: Props) {
  const rows = useMemo(() => signalen, [signalen]);
  const [paginaGrootte, setPaginaGrootte] = useState(leesOpgeslagenPaginaGrootte);
  const [pagina, setPaginaState] = useState(leesOpgeslagenPagina);
  const desktopLayout = useDesktopSignalenLayout();
  const vorigeLijstSignatuur = useRef('');
  const lijstSignatuur = useMemo(
    () => rows.map(s => s.id).join('|'),
    [rows],
  );

  const totaalPaginas = Math.max(1, Math.ceil(rows.length / paginaGrootte));
  const highlightedIndex = highlightedId ? rows.findIndex(s => s.id === highlightedId) : -1;
  const highlightedPagina = highlightedIndex >= 0
    ? Math.floor(highlightedIndex / paginaGrootte) + 1
    : null;
  const begrensdePagina = Math.min(Math.max(pagina, 1), totaalPaginas);
  const effectievePagina = highlightedPagina ?? begrensdePagina;

  const setPagina = (volgendePagina: number) => {
    const begrensd = Math.min(Math.max(volgendePagina, 1), totaalPaginas);
    setPaginaState(begrensd);
    bewaarPagina(begrensd);
  };

  useEffect(() => {
    if (vorigeLijstSignatuur.current && vorigeLijstSignatuur.current !== lijstSignatuur) {
      setPaginaState(1);
      bewaarPagina(1);
    }
    vorigeLijstSignatuur.current = lijstSignatuur;
  }, [lijstSignatuur]);

  useEffect(() => {
    if (pagina !== begrensdePagina) {
      setPaginaState(begrensdePagina);
      bewaarPagina(begrensdePagina);
    }
  }, [pagina, begrensdePagina]);

  useEffect(() => {
    if (highlightedPagina && highlightedPagina !== pagina) {
      setPaginaState(highlightedPagina);
      bewaarPagina(highlightedPagina);
    }
  }, [highlightedPagina, pagina]);

  const startIndex = (effectievePagina - 1) * paginaGrootte;
  const paginaRows = useMemo(
    () => rows.slice(startIndex, startIndex + paginaGrootte),
    [rows, startIndex, paginaGrootte],
  );
  const eersteNummer = rows.length === 0 ? 0 : startIndex + 1;
  const laatsteNummer = Math.min(startIndex + paginaRows.length, rows.length);

  const wijzigPaginaGrootte = (nieuweGrootte: number) => {
    if (!PAGINA_GROOTTES.includes(nieuweGrootte as (typeof PAGINA_GROOTTES)[number])) return;
    const eersteHuidigeIndex = (effectievePagina - 1) * paginaGrootte;
    const nieuwePagina = Math.floor(eersteHuidigeIndex / nieuweGrootte) + 1;
    setPaginaGrootte(nieuweGrootte);
    setPaginaState(nieuwePagina);
    bewaarPaginaGrootte(nieuweGrootte);
    bewaarPagina(nieuwePagina);
  };

  const navigate = useNavigate();
  const go = (id: string, anchor?: HTMLElement | null) => {
    try {
      const scrollY = getListScrollY(anchor);
      saveListLastViewed('off-market-signalen', { id, scrollY, ts: Date.now() });
      bewaarPagina(effectievePagina);
    } catch { /* ignore */ }
    navigate(`/off-market/${id}`);
  };
  const { relaties } = useDataStore();
  const relatieNaam = (id: string | null) => {
    if (!id) return null;
    const r = relaties.find((x: any) => x.id === id);
    if (!r) return null;
    return (r as any).bedrijfsnaam ?? (r as any).contactpersoon ?? '—';
  };

  const actieveKolommen = useMemo(() => {
    const ids = zichtbareKolommen && zichtbareKolommen.length > 0
      ? zichtbareKolommen
      : STANDAARD_ZICHTBARE_KOLOMMEN;
    const set = new Set(ids);
    return SIGNALEN_KOLOMMEN.filter(k => set.has(k.id));
  }, [zichtbareKolommen]);

  const selectieIds = useActieveSelectieIds();
  const ctx: SignalenKolomCtx = { relatieNaam };

  if (laden) {
    return <p className="px-5 py-10 text-sm text-muted-foreground">Signalen laden…</p>;
  }
  if (rows.length === 0) {
    return (
      <div className="px-5 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          Nog geen off-market signalen. Voeg later handmatig signalen toe of activeer een bron.
        </p>
      </div>
    );
  }

  const pagination = desktopLayout ? (
    <div className="border-t border-border/70 px-4 py-3 flex items-center justify-between gap-4 bg-muted/20">
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span>{eersteNummer}–{laatsteNummer} van {rows.length} signalen</span>
        <label className="inline-flex items-center gap-1.5">
          <span>Per pagina</span>
          <select
            aria-label="Aantal signalen per pagina"
            value={paginaGrootte}
            onChange={e => wijzigPaginaGrootte(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            {PAGINA_GROOTTES.map(grootte => <option key={grootte} value={grootte}>{grootte}</option>)}
          </select>
        </label>
      </div>
      <nav aria-label="Signalen paginering" className="flex items-center gap-1">
        <button
          type="button"
          aria-label="Vorige pagina"
          disabled={effectievePagina <= 1}
          onClick={() => setPagina(effectievePagina - 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {paginaknoppen(effectievePagina, totaalPaginas).map((item, index) => item === 'ellipsis' ? (
          <span key={`ellipsis-${index}`} className="px-1.5 text-xs text-muted-foreground">…</span>
        ) : (
          <button
            key={item}
            type="button"
            aria-label={`Pagina ${item}`}
            aria-current={item === effectievePagina ? 'page' : undefined}
            onClick={() => setPagina(item)}
            className={`inline-flex h-9 min-w-9 items-center justify-center rounded-md border px-2 text-sm ${
              item === effectievePagina
                ? 'border-accent bg-accent text-accent-foreground'
                : 'border-border bg-background text-foreground hover:bg-muted'
            }`}
          >
            {item}
          </button>
        ))}
        <button
          type="button"
          aria-label="Volgende pagina"
          disabled={effectievePagina >= totaalPaginas}
          onClick={() => setPagina(effectievePagina + 1)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  ) : (
    <div className="border-t border-border/70 px-4 py-3 bg-muted/20 space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>{eersteNummer}–{laatsteNummer} van {rows.length}</span>
        <label className="inline-flex items-center gap-1.5">
          <span>Per pagina</span>
          <select
            aria-label="Aantal signalen per pagina"
            value={paginaGrootte}
            onChange={e => wijzigPaginaGrootte(Number(e.target.value))}
            className="h-9 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            {PAGINA_GROOTTES.map(grootte => <option key={grootte} value={grootte}>{grootte}</option>)}
          </select>
        </label>
      </div>
      <nav aria-label="Signalen paginering" className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <button
          type="button"
          disabled={effectievePagina <= 1}
          onClick={() => setPagina(effectievePagina - 1)}
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-sm font-medium disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" /> Vorige
        </button>
        <span className="px-1 text-center text-xs text-muted-foreground whitespace-nowrap">
          Pagina {effectievePagina} van {totaalPaginas}
        </span>
        <button
          type="button"
          disabled={effectievePagina >= totaalPaginas}
          onClick={() => setPagina(effectievePagina + 1)}
          className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-md border border-border bg-background px-3 text-sm font-medium disabled:opacity-40"
        >
          Volgende <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );

  return (
    <>
      {desktopLayout ? (
        <div>
          <Table>
            <TableHeader>
              <TableRow>
                {actieveKolommen.map(k => (
                  <TableHead key={k.id} className={k.headerClassName}>{k.label}</TableHead>
                ))}
                <TableHead className="w-12 text-right">Sel.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginaRows.map(s => {
                const isHighlighted = highlightedId === s.id;
                const inSelectie = selectieIds.has(s.id);
                return (
                  <TableRow
                    key={s.id}
                    data-row-id={s.id}
                    className={`cursor-pointer ${isHighlighted ? 'bg-accent/5 ring-1 ring-inset ring-accent/40' : ''}`}
                    onClick={(e) => go(s.id, e.currentTarget)}
                    title={s.titel}
                  >
                    {actieveKolommen.map((k, i) => (
                      <TableCell key={k.id} className={k.cellClassName}>
                        {i === 0 && (isHighlighted || inSelectie) ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isHighlighted && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-accent/40 bg-accent/15 text-accent">
                                <Eye className="h-3 w-3" /> Laatst bekeken
                              </span>
                            )}
                            {inSelectie && <InSelectieBadge />}
                            {k.render(s, ctx)}
                          </div>
                        ) : k.render(s, ctx)}
                      </TableCell>
                    ))}
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <ToevoegenAanAcquisitieSelectieKnop
                        signaalId={s.id}
                        variant="icon"
                        isInSelectie={inSelectie}
                        stopPropagation
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ) : (
        <div className="divide-y divide-border/70">
          {paginaRows.map(s => {
            const isHighlighted = highlightedId === s.id;
            return (
              <div
                key={s.id}
                data-row-id={s.id}
                className={`px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors ${
                  isHighlighted ? 'bg-accent/5 ring-1 ring-inset ring-accent/40' : ''
                }`}
                onClick={(e) => go(s.id, e.currentTarget)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border border-accent/30 bg-accent/10 text-accent">
                        {vergunningLabel(s)}
                      </span>
                      {selectieIds.has(s.id) && <InSelectieBadge />}
                      {isHighlighted && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-accent/40 bg-accent/15 text-accent">
                          <Eye className="h-3 w-3" /> Laatst bekeken
                        </span>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground mt-1 truncate">
                      {formatSignaalAdres(s) || cleanAdres(s.adres) || '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {typeof s.ai_score === 'number' && (
                      <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono-data">
                        <Sparkles className="h-3 w-3" />{s.ai_score}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-2 flex justify-end">
                  <ToevoegenAanAcquisitieSelectieKnop
                    signaalId={s.id}
                    variant="compact"
                    labelMode="short"
                    isInSelectie={selectieIds.has(s.id)}
                    stopPropagation
                    className={
                      selectieIds.has(s.id)
                        ? 'h-9 px-2 text-[12px] border-accent/60 bg-accent/10 text-accent'
                        : 'h-9 px-2 text-[12px]'
                    }
                  />
                </div>

                <div className="flex items-center flex-wrap gap-1.5 mt-2">
                  <OffMarketStatusBadge status={s.status} />
                  <OffMarketEigenaarstatusBadge status={eigenaarstatusVan(s)} />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                  <Calendar className="h-3 w-3" /> {formatDateNL(brondatumOfCreated(s))}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {pagination}
    </>
  );
}
