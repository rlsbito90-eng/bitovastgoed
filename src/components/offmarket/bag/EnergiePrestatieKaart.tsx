import { BatteryCharging, RefreshCw, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  useVastgoedEnergieSnapshot,
  useVastgoedEnergieVerrijken,
} from '@/hooks/useVastgoedEnergie';

interface Props {
  bagVboId: string | null;
  bagNummeraanduidingId?: string | null;
  bagPandId?: string | null;
  adres?: string | null;
  postcode?: string | null;
  plaats?: string | null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('nl-NL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function labelTone(label: string | null | undefined) {
  const normalized = (label ?? '').toUpperCase();
  if (/^A/.test(normalized)) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
  if (normalized === 'B') return 'bg-lime-100 text-lime-800 border-lime-200';
  if (normalized === 'C') return 'bg-yellow-100 text-yellow-800 border-yellow-200';
  if (['D', 'E'].includes(normalized)) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (['F', 'G'].includes(normalized)) return 'bg-red-100 text-red-800 border-red-200';
  return 'bg-muted text-muted-foreground border-border';
}

export default function EnergiePrestatieKaart({
  bagVboId,
  bagNummeraanduidingId,
  bagPandId,
  adres,
  postcode,
  plaats,
}: Props) {
  const snapshot = useVastgoedEnergieSnapshot(bagVboId);
  const verrijk = useVastgoedEnergieVerrijken();

  const ophalen = async () => {
    if (!bagVboId) return;
    try {
      const result = await verrijk.mutateAsync({
        bag_vbo_id: bagVboId,
        bag_nummeraanduiding_id: bagNummeraanduidingId,
        bag_pand_id: bagPandId,
        adres,
        postcode,
        plaats,
        force: true,
      });
      if (result.found === false) {
        toast.info('EP-Online heeft voor dit BAG-object geen energielabel gevonden.');
      } else {
        toast.success('Energielabel opgehaald via EP-Online.');
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Energielabel ophalen mislukt');
    }
  };

  const data = snapshot.data;

  return (
    <div
      data-testid="energieprestatie-kaart"
      className="rounded-md border border-border bg-card/60 p-3 space-y-3"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <BatteryCharging className="h-4 w-4 text-accent" />
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Energieprestatie</p>
            <p className="text-xs text-muted-foreground">Bron: EP-Online · gekoppeld via BAG-VBO</p>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={ophalen}
          disabled={!bagVboId || verrijk.isPending}
          data-testid="energielabel-ophalen-knop"
          title={!bagVboId ? 'Kies eerst een geldige BAG-match.' : undefined}
        >
          <RefreshCw className={`h-3.5 w-3.5 ${verrijk.isPending ? 'animate-spin' : ''}`} />
          {data ? 'Energielabel vernieuwen' : 'Energielabel ophalen'}
        </Button>
      </div>

      {!bagVboId && (
        <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/40 rounded-md p-2.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Eerst een BAG-doelobject kiezen; daarna kan het energielabel exact via het VBO-ID worden opgehaald.</span>
        </div>
      )}

      {bagVboId && snapshot.isLoading && (
        <p className="text-xs text-muted-foreground">Opgeslagen energielabel controleren…</p>
      )}

      {bagVboId && snapshot.isError && (
        <div className="flex items-start gap-2 text-xs text-destructive bg-destructive/10 rounded-md p-2.5">
          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>Opgeslagen energielabel kon niet worden geladen.</span>
        </div>
      )}

      {bagVboId && !snapshot.isLoading && !data && !snapshot.isError && (
        <p className="text-xs text-muted-foreground">
          Nog geen energielabel opgeslagen voor dit BAG-object. Ophalen gebeurt alleen na een expliciete klik.
        </p>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Label</p>
              <span
                data-testid="energielabel-waarde"
                className={`mt-1 inline-flex min-w-9 justify-center rounded border px-2 py-1 text-sm font-semibold ${labelTone(data.energielabel)}`}
              >
                {data.energielabel ?? '—'}
              </span>
            </div>
            <EnergyStat label="Gebruiksfunctie" value={data.gebruiksfunctie ?? '—'} />
            <EnergyStat label="Registratie" value={formatDate(data.registratiedatum)} />
            <EnergyStat label="Geldig tot" value={formatDate(data.geldig_tot)} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs border-t border-border/60 pt-3">
            <EnergyStat label="Energie-index" value={data.energie_index != null ? String(data.energie_index) : '—'} />
            <EnergyStat
              label="Primair fossiel gebruik"
              value={data.primair_fossiel_energiegebruik != null ? String(data.primair_fossiel_energiegebruik) : '—'}
            />
            <EnergyStat label="Matchkwaliteit" value={data.match_kwaliteit} />
          </div>

          <div className="text-[11px] text-muted-foreground border-t border-border/60 pt-2">
            Laatst opgehaald: {formatDate(data.opgehaald_op)}
            {data.bron_referentie ? ` · referentie ${data.bron_referentie}` : ''}
          </div>
        </>
      )}
    </div>
  );
}

function EnergyStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-xs text-foreground mt-0.5">{value}</p>
    </div>
  );
}
