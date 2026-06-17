// Mobiele premium variant van Gebiedsindeling. Stacked info-rows,
// statusbadge naast titel en compacte icon-knop voor opnieuw verrijken.
// Logica (verrijken, kopieer) blijft hetzelfde als desktopvariant.
import { useState } from 'react';
import { toast } from 'sonner';
import { Globe2, RefreshCcw, Copy } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import {
  formatGeoBron, formatGeoDatum,
  verrijkSignaalGeo, type OffMarketGeoStatus,
} from '@/lib/offMarket/geo';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props { signaal: OffMarketSignaal; }

const STATUS_TINT: Record<OffMarketGeoStatus, string> = {
  verrijkt: 'bg-accent/12 text-accent border-accent/30',
  niet_verrijkt: 'bg-muted text-muted-foreground border-border/60',
  geen_coordinaten: 'bg-muted text-muted-foreground border-border/60',
  geen_match: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
  fout: 'bg-destructive/10 text-destructive border-destructive/30',
};

const STATUS_LABEL: Record<OffMarketGeoStatus, string> = {
  verrijkt: 'Verrijkt',
  niet_verrijkt: 'Niet verrijkt',
  geen_coordinaten: 'Geen coördinaten',
  geen_match: 'Geen match',
  fout: 'Fout',
};

export default function SignaalMobileGebiedsindeling({ signaal }: Props) {
  const qc = useQueryClient();
  const [bezig, setBezig] = useState(false);
  const s = signaal as any;
  const status = (s.geo_status ?? 'niet_verrijkt') as OffMarketGeoStatus;
  const heeftCoords = s.lat != null && s.lng != null;
  const isVerrijkt = status === 'verrijkt';

  const kopieer = async () => {
    const txt = [
      s.geo_gemeente_naam && `Gemeente: ${s.geo_gemeente_naam}`,
      s.geo_wijk_naam && `Wijk: ${s.geo_wijk_naam}`,
      s.geo_buurt_naam && `Buurt: ${s.geo_buurt_naam}`,
    ].filter(Boolean).join('\n');
    if (!txt) { toast.error('Geen gebiedsinfo om te kopiëren.'); return; }
    try { await navigator.clipboard.writeText(txt); toast.success('Gebiedsinfo gekopieerd.'); }
    catch { toast.error('Kopiëren mislukt.'); }
  };

  const verrijk = async () => {
    if (bezig || !heeftCoords) return;
    setBezig(true);
    const res = await verrijkSignaalGeo(signaal.id, { force: true });
    setBezig(false);
    if (!res.ok) { toast.error(res.error ?? 'Geo-verrijking mislukt.'); return; }
    if (res.status === 'verrijkt') toast.success('Gebiedsindeling bijgewerkt.');
    else if (res.status === 'geen_coordinaten') toast.warning('Geen coördinaten beschikbaar.');
    else if (res.status === 'geen_match') toast.warning('Geen wijk/buurt-match gevonden.');
    else if (res.status === 'fout') toast.error('Geo-verrijking gaf een fout.');
    qc.invalidateQueries({ queryKey: ['off-market-signaal', signaal.id] });
    qc.invalidateQueries({ queryKey: ['off-market-signalen'] });
  };

  return (
    <section
      data-testid="signaal-mobile-gebiedsindeling"
      className="section-card p-3.5 space-y-3"
    >
      <header className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Globe2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <h3 className="text-sm font-semibold text-foreground truncate">Gebiedsindeling</h3>
          <span
            data-testid="geo-status-badge"
            className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-full border text-[10.5px] font-medium ${STATUS_TINT[status]}`}
          >
            {STATUS_LABEL[status]}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={verrijk}
            disabled={bezig || !heeftCoords}
            aria-label="Opnieuw verrijken"
            className="inline-flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-accent hover:bg-accent/[0.08] disabled:opacity-40"
          >
            <RefreshCcw className={`h-3.5 w-3.5 ${bezig ? 'animate-spin' : ''}`} />
          </button>
          {isVerrijkt && (
            <button
              type="button"
              onClick={kopieer}
              aria-label="Kopieer gebiedsinfo"
              className="inline-flex items-center justify-center h-7 w-7 rounded-full text-muted-foreground hover:text-accent hover:bg-accent/[0.08]"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </header>

      {!heeftCoords && (
        <p className="text-xs text-muted-foreground">
          Geen coördinaten beschikbaar voor geo-verrijking.
        </p>
      )}

      {heeftCoords && !isVerrijkt && (
        <p className="text-xs text-muted-foreground">
          Nog geen gebiedsindeling vastgelegd.
        </p>
      )}

      {isVerrijkt && (
        <dl className="divide-y divide-border/40 -mx-0.5">
          <InfoRow label="Gemeente" value={s.geo_gemeente_naam} />
          <InfoRow label="Wijk" value={s.geo_wijk_naam} />
          <InfoRow label="Buurt" value={s.geo_buurt_naam} clamp />
          <InfoRow label="Bron" value={formatGeoBron(s.geo_bron)} />
          <InfoRow label="Laatst verrijkt" value={formatGeoDatum(s.geo_verrijkt_op)} />
        </dl>
      )}

      {status === 'fout' && s.geo_foutmelding && (
        <p className="text-[11px] text-destructive">Foutmelding: {s.geo_foutmelding}</p>
      )}
    </section>
  );
}

function InfoRow({
  label, value, clamp,
}: { label: string; value: string | null | undefined; clamp?: boolean }) {
  return (
    <div className="py-2 first:pt-0 last:pb-0">
      <dt className="text-[10.5px] uppercase tracking-wider text-muted-foreground font-medium">{label}</dt>
      <dd className={`text-[13px] text-foreground mt-0.5 ${clamp ? 'line-clamp-2' : 'break-words'}`}>
        {value || '—'}
      </dd>
    </div>
  );
}
