import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, MapPin, Calendar, ExternalLink } from 'lucide-react';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  OffMarketPriorityBadge, OffMarketStatusBadge, OffMarketAiStatusBadge,
} from '@/components/offmarket/OffMarketBadges';
import {
  ASSETTYPE_LABEL, BRON_TYPE_LABEL,
  type OffMarketSignaal,
} from '@/lib/offMarket/types';
import { formatCurrency } from '@/lib/format/nl';

interface Props {
  signalen: OffMarketSignaal[];
  laden: boolean;
}

function formatDateNL(d: string | null) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('nl-NL'); } catch { return d; }
}

function regelOndertitel(s: OffMarketSignaal) {
  const parts: string[] = [];
  if (s.assettype) parts.push(ASSETTYPE_LABEL[s.assettype]);
  if (s.plaats) parts.push(s.plaats);
  if (s.provincie) parts.push(s.provincie);
  if (s.bron_type) parts.push(BRON_TYPE_LABEL[s.bron_type]);
  return parts.join(' · ');
}

export default function SignalenTable({ signalen, laden }: Props) {
  const rows = useMemo(() => signalen, [signalen]);
  const navigate = useNavigate();
  const go = (id: string) => navigate(`/off-market/${id}`);

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
      {/* Mobiel: card-fallback */}
      <div className="sm:hidden divide-y divide-border/70">
        {rows.map(s => (
          <div key={s.id} className="px-4 py-3 cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => go(s.id)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground truncate">{s.titel}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{regelOndertitel(s) || '—'}</p>
              </div>
              {typeof s.ai_score === 'number' && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground font-mono-data shrink-0">
                  <Sparkles className="h-3 w-3" />{s.ai_score}
                </span>
              )}
            </div>
            <div className="flex items-center flex-wrap gap-1.5 mt-2">
              <OffMarketStatusBadge status={s.status} />
              <OffMarketPriorityBadge prioriteit={s.prioriteit} />
              <OffMarketAiStatusBadge status={(s as any).ai_status} />
              {s.mogelijke_fee != null && (
                <span className="text-[11px] text-muted-foreground font-mono-data">
                  Fee: {formatCurrency(Number(s.mogelijke_fee))}
                </span>
              )}
            </div>
            {s.volgende_actie_datum && (
              <p className="text-[11px] text-muted-foreground mt-1.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> {formatDateNL(s.volgende_actie_datum)}
                {s.volgende_actie_omschrijving ? ` · ${s.volgende_actie_omschrijving}` : ''}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: tabel */}
      <div className="hidden sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Signaal</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Prioriteit</TableHead>
              <TableHead>AI-status</TableHead>
              <TableHead className="text-right">AI-score</TableHead>
              <TableHead className="text-right">Mogelijke fee</TableHead>
              <TableHead>Volgende actie</TableHead>
              <TableHead>Bron</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map(s => (
              <TableRow key={s.id} className="cursor-pointer" onClick={() => go(s.id)}>
                <TableCell className="max-w-[320px]">
                  <p className="text-sm font-medium text-foreground truncate">{s.titel}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    {s.adres || s.plaats ? <MapPin className="h-3 w-3 shrink-0" /> : null}
                    {regelOndertitel(s) || '—'}
                  </p>
                </TableCell>
                <TableCell><OffMarketStatusBadge status={s.status} /></TableCell>
                <TableCell><OffMarketPriorityBadge prioriteit={s.prioriteit} /></TableCell>
                <TableCell><OffMarketAiStatusBadge status={(s as any).ai_status} /></TableCell>
                <TableCell className="text-right font-mono-data text-sm">
                  {typeof s.ai_score === 'number' ? s.ai_score : '—'}
                </TableCell>
                <TableCell className="text-right font-mono-data text-sm">
                  {s.mogelijke_fee != null ? formatCurrency(Number(s.mogelijke_fee)) : '—'}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {s.volgende_actie_datum ? (
                    <>
                      <span className="font-mono-data text-foreground">{formatDateNL(s.volgende_actie_datum)}</span>
                      {s.volgende_actie_omschrijving && (
                        <span className="block truncate max-w-[200px]">{s.volgende_actie_omschrijving}</span>
                      )}
                    </>
                  ) : '—'}
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
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
