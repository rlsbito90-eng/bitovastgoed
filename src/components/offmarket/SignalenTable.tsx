import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Calendar, ExternalLink } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { OffMarketStatusBadge } from '@/components/offmarket/OffMarketBadges';
import {
  BRON_TYPE_LABEL, VERGUNNINGTYPE_LABEL, AANVRAAG_BESLUIT_LABEL,
  type OffMarketSignaal, type OffMarketVergunningtype, type OffMarketAanvraagOfBesluit,
} from '@/lib/offMarket/types';
import { relevantieBucket } from '@/lib/offMarket/relevantie';
import { useRelaties } from '@/hooks/useDataStore';

interface Props {
  signalen: OffMarketSignaal[];
  laden: boolean;
}

function formatDateNL(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('nl-NL'); } catch { return d; }
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

function eigenaarChip(s: OffMarketSignaal): { label: string; tone: 'on' | 'off' | 'neutral' } {
  if (s.eigenaar_relatie_id) return { label: 'Bekend', tone: 'on' };
  if (s.eigenaar_bekend) return { label: 'Bekend', tone: 'on' };
  return { label: 'Onbekend', tone: 'neutral' };
}

function brondatumOfCreated(s: OffMarketSignaal): string | null {
  return s.bron_datum ?? s.created_at ?? null;
}

export default function SignalenTable({ signalen, laden }: Props) {
  const rows = useMemo(() => signalen, [signalen]);
  const navigate = useNavigate();
  const go = (id: string) => navigate(`/off-market/${id}`);
  const { data: relaties = [] } = useRelaties();
  const relatieNaam = (id: string | null) => {
    if (!id) return null;
    const r = relaties.find((x: any) => x.id === id);
    return r ? (r.bedrijfsnaam ?? r.naam ?? r.volledige_naam ?? '—') : null;
  };

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
          const eig = eigenaarChip(s);
          const rel = relatieNaam(s.eigenaar_relatie_id);
          return (
            <div key={s.id} className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => go(s.id)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex px-1.5 py-0.5 text-[10px] font-medium rounded border border-accent/30 bg-accent/10 text-accent">
                      {vergunningLabel(s)}
                    </span>
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wide">
                      {aanvraagBesluitLabel(s)}
                    </span>
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
                <span className={`text-[10px] px-1.5 py-0.5 rounded border ${
                  eig.tone === 'on'
                    ? 'bg-success/10 text-success border-success/25'
                    : 'bg-muted/60 text-muted-foreground border-border'
                }`}>Eigenaar: {eig.label}</span>
                {rel && <span className="text-[10px] text-muted-foreground truncate max-w-[150px]">{rel}</span>}
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
              <TableHead>Vergunningtype</TableHead>
              <TableHead>Aanvraag/Besluit</TableHead>
              <TableHead>Adres</TableHead>
              <TableHead>Plaats</TableHead>
              <TableHead className="text-right">AI-score</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Eigenaar</TableHead>
              <TableHead>Relatie</TableHead>
              <TableHead>Brondatum</TableHead>
              <TableHead>Bron</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(s => {
              const eig = eigenaarChip(s);
              const rel = relatieNaam(s.eigenaar_relatie_id);
              return (
                <TableRow key={s.id} className="cursor-pointer" onClick={() => go(s.id)} title={s.titel}>
                  <TableCell>
                    <span className="inline-flex px-2 py-0.5 text-[11px] font-medium rounded-full border border-accent/30 bg-accent/10 text-accent whitespace-nowrap">
                      {vergunningLabel(s)}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground uppercase tracking-wide">
                    {aanvraagBesluitLabel(s)}
                  </TableCell>
                  <TableCell className="max-w-[220px]">
                    <p className="text-sm text-foreground truncate">{s.adres || '—'}</p>
                    {s.postcode && (
                      <p className="text-[11px] text-muted-foreground font-mono-data">{s.postcode}</p>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-foreground">{s.plaats || '—'}</TableCell>
                  <TableCell className="text-right font-mono-data text-sm">
                    {typeof s.ai_score === 'number' ? s.ai_score : '—'}
                  </TableCell>
                  <TableCell><OffMarketStatusBadge status={s.status} /></TableCell>
                  <TableCell>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border whitespace-nowrap ${
                      eig.tone === 'on'
                        ? 'bg-success/10 text-success border-success/25'
                        : 'bg-muted/60 text-muted-foreground border-border'
                    }`}>{eig.label}</span>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                    {rel ?? '—'}
                  </TableCell>
                  <TableCell className="text-xs font-mono-data text-foreground">
                    {formatDateNL(brondatumOfCreated(s))}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="text-muted-foreground">{s.bron_type ? BRON_TYPE_LABEL[s.bron_type] : '—'}</span>
                    {s.bron_url && (
                      <a href={s.bron_url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()} className="ml-1 inline-flex text-accent hover:underline">
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
