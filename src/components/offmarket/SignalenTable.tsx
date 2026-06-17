import { useMemo, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar, ExternalLink, Eye } from 'lucide-react';
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

interface Props {
  signalen: OffMarketSignaal[];
  laden: boolean;
  /** Optioneel: override default-zichtbaarheid. Wanneer leeg: standaardkolommen. */
  zichtbareKolommen?: string[];
  /** Optioneel: id van laatst bekeken signaal — wordt visueel gehighlight. */
  highlightedId?: string | null;
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
          <p className="text-sm text-foreground truncate">{s.adres || '—'}</p>
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
    render: (s) => s.plaats || '—',
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

export default function SignalenTable({ signalen, laden, zichtbareKolommen, highlightedId }: Props) {
  const rows = useMemo(() => signalen, [signalen]);
  const navigate = useNavigate();
  const go = (id: string, anchor?: HTMLElement | null) => {
    try {
      const scrollY = getListScrollY(anchor);
      saveListLastViewed('off-market-signalen', { id, scrollY, ts: Date.now() });
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

  return (
    <>
      {/* Mobiel: compacte card */}
      <div className="sm:hidden divide-y divide-border/70">
        {rows.map(s => {
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
                    {isHighlighted && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-accent/40 bg-accent/15 text-accent">
                        <Eye className="h-3 w-3" /> Laatst bekeken
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-medium text-foreground mt-1 truncate">
                    {s.adres || '—'}{s.plaats ? ` · ${s.plaats}` : ''}
                  </p>
                </div>
                {typeof s.ai_score === 'number' && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono-data shrink-0">
                    <Sparkles className="h-3 w-3" />{s.ai_score}
                  </span>
                )}
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


      {/* Desktop: acquisitie-tabel */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              {actieveKolommen.map(k => (
                <TableHead key={k.id} className={k.headerClassName}>{k.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(s => {
              const isHighlighted = highlightedId === s.id;
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
                      {i === 0 && isHighlighted ? (
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border border-accent/40 bg-accent/15 text-accent">
                            <Eye className="h-3 w-3" /> Laatst bekeken
                          </span>
                          {k.render(s, ctx)}
                        </div>
                      ) : k.render(s, ctx)}
                    </TableCell>
                  ))}
                </TableRow>
              );
            })}

          </TableBody>
        </Table>
      </div>
    </>
  );
}
