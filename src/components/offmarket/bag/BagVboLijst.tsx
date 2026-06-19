// V2.3 + V2.4 — Lijst met BAG-verblijfsobjecten in de BAG-pandcontext.
// Markeert gekozen doelobject; toont +N meer wanneer >50 VBO's.
import { Check } from 'lucide-react';
import type { BagVbo } from '@/lib/offMarket/bag/types';

interface Props {
  vbos: BagVbo[] | null | undefined;
  geselecteerdVboId?: string | null;
  geselecteerdNummeraanduidingId?: string | null;
  maxItems?: number;
}

export default function BagVboLijst({
  vbos,
  geselecteerdVboId,
  geselecteerdNummeraanduidingId,
  maxItems = 50,
}: Props) {
  if (!vbos || vbos.length === 0) {
    return (
      <p data-testid="bag-vbo-lijst-leeg" className="text-[11px] text-muted-foreground italic">
        Geen verblijfsobjecten gevonden.
      </p>
    );
  }
  const totaal = vbos.length;
  const zichtbaar = vbos.slice(0, maxItems);
  const rest = totaal - zichtbaar.length;

  return (
    <div className="space-y-1.5">
      <ul data-testid="bag-vbo-lijst" className="space-y-1.5">
        {zichtbaar.map((v) => {
          const isGekozen =
            (!!geselecteerdVboId && v.vbo_id === geselecteerdVboId) ||
            (!!geselecteerdNummeraanduidingId && v.nummeraanduiding_id === geselecteerdNummeraanduidingId);
          return (
            <li
              key={v.vbo_id || v.nummeraanduiding_id}
              data-testid="bag-vbo-item"
              data-gekozen={isGekozen ? 'true' : 'false'}
              className={`rounded-md border px-3 py-2 text-xs flex items-start justify-between gap-3 ${
                isGekozen
                  ? 'border-accent/60 bg-accent/10'
                  : 'border-border/70 bg-card/60'
              }`}
            >
              <div className="min-w-0 flex items-start gap-2">
                {isGekozen ? (
                  <Check className="h-3.5 w-3.5 text-accent mt-0.5 shrink-0" data-testid="bag-vbo-gekozen-icoon" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <p className="text-foreground truncate">{v.adres || '—'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {v.gebruiksdoel?.length ? v.gebruiksdoel.join(', ') : 'Onbekend gebruik'}
                    {v.status ? ` · ${v.status}` : ''}
                    {isGekozen ? ' · zelfde BAG-pand' : ''}
                  </p>
                </div>
              </div>
              <span className="font-mono-data text-foreground whitespace-nowrap">
                {v.opp_m2 != null ? `${v.opp_m2} m²` : '—'}
              </span>
            </li>
          );
        })}
      </ul>
      {rest > 0 && (
        <p data-testid="bag-vbo-meer-indicator" className="text-[11px] text-muted-foreground italic">
          + {rest} meer VBO{rest === 1 ? '' : "'s"} in dezelfde BAG-pandcontext
        </p>
      )}
    </div>
  );
}
