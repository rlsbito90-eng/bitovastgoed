// Gebiedsindeling-blok voor tab Onderzoek op signaaldetailpagina.
// Toont officiële gemeente/wijk/buurt incl. status, bron en datum, met
// acties voor opnieuw verrijken en kopiëren.
import { useState } from 'react';
import { toast } from 'sonner';
import { Globe2, RefreshCcw, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useQueryClient } from '@tanstack/react-query';
import {
  formatGebiedsindeling, formatGeoBron, formatGeoDatum, formatGeoStatus,
  verrijkSignaalGeo, type OffMarketGeoStatus,
} from '@/lib/offMarket/geo';
import type { OffMarketSignaal } from '@/lib/offMarket/types';

interface Props { signaal: OffMarketSignaal; }

export default function SignaalGebiedsindeling({ signaal }: Props) {
  const qc = useQueryClient();
  const [bezig, setBezig] = useState(false);
  const s = signaal as any;
  const status = (s.geo_status ?? 'niet_verrijkt') as OffMarketGeoStatus;
  const heeftCoords = s.lat != null && s.lng != null;

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
    if (bezig) return;
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
    <section className="section-card p-4 space-y-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Globe2 className="h-4 w-4 text-muted-foreground" /> Gebiedsindeling
        </h3>
        <div className="flex items-center gap-1.5">
          <Button size="sm" variant="outline" onClick={verrijk} disabled={bezig || !heeftCoords}>
            <RefreshCcw className={`h-3.5 w-3.5 mr-1.5 ${bezig ? 'animate-spin' : ''}`} />
            {status === 'verrijkt' ? 'Opnieuw verrijken' : 'Geo verrijken'}
          </Button>
          {status === 'verrijkt' && (
            <Button size="sm" variant="outline" onClick={kopieer}>
              <Copy className="h-3.5 w-3.5 mr-1.5" /> Kopieer
            </Button>
          )}
        </div>
      </div>

      {!heeftCoords && (
        <p className="text-xs text-muted-foreground">
          Geen coördinaten beschikbaar voor geo-verrijking.
        </p>
      )}

      {status !== 'verrijkt' && heeftCoords && (
        <p className="text-sm text-muted-foreground">{formatGebiedsindeling(s)}</p>
      )}

      {status === 'verrijkt' && (
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
          <Row label="Gemeente" value={s.geo_gemeente_naam} />
          <Row label="Wijk" value={s.geo_wijk_naam} />
          <Row label="Buurt" value={s.geo_buurt_naam} />
          <Row label="Status" value={formatGeoStatus(status)} />
          <Row label="Bron" value={formatGeoBron(s.geo_bron)} />
          <Row label="Laatst verrijkt" value={formatGeoDatum(s.geo_verrijkt_op)} />
        </dl>
      )}

      {status === 'fout' && s.geo_foutmelding && (
        <p className="text-xs text-destructive">Foutmelding: {s.geo_foutmelding}</p>
      )}
    </section>
  );
}

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-baseline gap-2 min-w-0">
      <dt className="text-xs text-muted-foreground shrink-0 w-28">{label}</dt>
      <dd className="text-sm text-foreground truncate">{value || '—'}</dd>
    </div>
  );
}
