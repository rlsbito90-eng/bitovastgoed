import { AlertCircle, Building2, FileSearch } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { AcquisitieBagContext } from '@/lib/acquisitieBagContext';
import { BAG_STATUS_LABEL } from '@/lib/offMarket/bag/types';

interface Props {
  context: AcquisitieBagContext;
  onOpenKadaster?: () => void;
  toonKadasterActie?: boolean;
}

function waarde(value: number | null, suffix = ''): string {
  return value == null ? '—' : `${value}${suffix}`;
}

export default function AcquisitieBagOverzicht({
  context,
  onOpenKadaster,
  toonKadasterActie = true,
}: Props) {
  return (
    <section className="section-card space-y-4 p-4 sm:p-5" data-testid="acquisitie-bag-overzicht">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Building2 className="h-4 w-4 text-accent" />
            <h2 className="font-medium">BAG-overzicht</h2>
            <Badge variant="outline">{BAG_STATUS_LABEL[context.status]}</Badge>
            {context.matchKwaliteit && <Badge variant="secondary">{context.matchKwaliteit}</Badge>}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Doelobject en pandcontext uit één gedeeld acquisitie-readmodel.
          </p>
        </div>
        {toonKadasterActie && (
          <Button
            size="sm"
            onClick={onOpenKadaster}
            disabled={!context.heeftGeldigeMatch || context.vereistMatchkeuze || !onOpenKadaster}
            title={context.vereistMatchkeuze ? 'Kies eerst de juiste BAG-match.' : undefined}
          >
            <FileSearch className="mr-1.5 h-4 w-4" />Kadaster ophalen
          </Button>
        )}
      </div>

      {context.foutmelding && (
        <div className="flex items-start gap-2 rounded-md bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{context.foutmelding}</span>
        </div>
      )}

      {context.vereistMatchkeuze && (
        <div className="rounded-md border border-amber-300/60 bg-amber-50/70 p-3 text-xs text-amber-900">
          Er zijn meerdere of onzekere BAG-matches. Selecteer eerst het juiste doelobject voordat Kadaster wordt geopend.
        </div>
      )}

      <div className="rounded-md border border-border bg-card/60 p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Doelobject</p>
        <p className="mt-1 text-sm font-medium">{context.doelAdres || 'Nog niet geselecteerd'}</p>
        <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
          <div><dt className="text-muted-foreground">Gebruiksdoel</dt><dd>{context.doelGebruiksdoelen.join(', ') || '—'}</dd></div>
          <div><dt className="text-muted-foreground">Oppervlakte</dt><dd>{waarde(context.doelOppervlakteM2, ' m²')}</dd></div>
          <div className="sm:col-span-2"><dt className="text-muted-foreground">Verblijfsobject-ID</dt><dd className="break-all font-mono-data">{context.doelVboId || '—'}</dd></div>
          <div><dt className="text-muted-foreground">Bouwjaar</dt><dd>{waarde(context.bouwjaar)}</dd></div>
          <div><dt className="text-muted-foreground">Pandstatus</dt><dd>{context.pandStatus || '—'}</dd></div>
        </dl>
      </div>

      <div>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">BAG-pandcontext</p>
        <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Totaal oppervlak" value={waarde(context.totaalOppervlakteM2, ' m²')} />
          <Stat label="Aantal VBO's" value={waarde(context.aantalVbos)} />
          <Stat label="Aantal panden" value={waarde(context.aantalPanden)} />
          <Stat label="Bouwjaar" value={waarde(context.bouwjaar)} />
        </div>
      </div>

      {context.vbos.length > 0 && (
        <div className="space-y-2 border-t border-border/60 pt-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Verblijfsobjecten ({context.vbos.length})
          </p>
          {context.vbos.map((vbo) => (
            <div key={`${vbo.vbo_id}-${vbo.nummeraanduiding_id}`} className="rounded-md border border-border p-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium">{vbo.adres}</p>
                {vbo.is_doelobject && <Badge variant="secondary">Doelobject</Badge>}
              </div>
              <p className="mt-1 text-muted-foreground">
                {vbo.opp_m2 == null ? 'Oppervlakte onbekend' : `${vbo.opp_m2} m²`}
                {vbo.gebruiksdoel.length ? ` · ${vbo.gebruiksdoel.join(', ')}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {context.pandcontextIncompleet && (
        <p className="rounded-md border border-amber-300/60 bg-amber-50/70 p-3 text-xs text-amber-900">
          De BAG-pandcontext is mogelijk incompleet.
        </p>
      )}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/15 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
