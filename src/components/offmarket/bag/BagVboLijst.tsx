// V2.3 + V2.4 — Lijst met BAG-verblijfsobjecten in de BAG-pandcontext.
// V2.4: toont MATCH/Doelobject-badge en "Zelfde BAG-pand"-badge per VBO.
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
  // Doelobject eerst.
  const isDoelobjectVbo = (v: BagVbo) => {
    if (v.is_doelobject === true) return true;
    if (geselecteerdVboId && v.vbo_id === geselecteerdVboId) return true;
    if (geselecteerdNummeraanduidingId && v.nummeraanduiding_id === geselecteerdNummeraanduidingId) return true;
    return false;
  };
  const sorted = [...vbos].sort((a, b) => Number(isDoelobjectVbo(b)) - Number(isDoelobjectVbo(a)));
  const zichtbaar = sorted.slice(0, maxItems);
  const rest = totaal - zichtbaar.length;

  return (
    <div className="space-y-1.5">
      <ul data-testid="bag-vbo-lijst" className="space-y-1.5">
        {zichtbaar.map((v) => {
          const doelobject = isDoelobjectVbo(v);
          const badgeLabel = doelobject
            ? (v.match_badge || 'MATCH · Doelobject')
            : (v.match_badge || 'Zelfde BAG-pand');
          const badgeClass = doelobject
            ? 'bg-emerald-100 text-emerald-900 border-emerald-300/70'
            : 'bg-sky-100 text-sky-900 border-sky-300/70';
          return (
            <li
              key={v.vbo_id || v.nummeraanduiding_id}
              data-testid="bag-vbo-item"
              data-gekozen={doelobject ? 'true' : 'false'}
              data-doelobject={doelobject ? 'true' : 'false'}
              className={`rounded-md border px-3 py-2 text-xs flex items-start justify-between gap-3 ${
                doelobject
                  ? 'border-emerald-400/70 bg-emerald-50/60'
                  : 'border-border/70 bg-card/60'
              }`}
            >
              <div className="min-w-0 flex items-start gap-2">
                {doelobject ? (
                  <Check className="h-3.5 w-3.5 text-emerald-700 mt-0.5 shrink-0" data-testid="bag-vbo-gekozen-icoon" />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0" />
                )}
                <div className="min-w-0 space-y-0.5">
                  <span
                    data-testid={doelobject ? 'bag-vbo-badge-doelobject' : 'bag-vbo-badge-pand'}
                    className={`inline-flex items-center text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded-full border ${badgeClass}`}
                  >
                    {badgeLabel}
                  </span>
                  <p className="text-foreground truncate">{v.adres || '—'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {v.gebruiksdoel?.length ? v.gebruiksdoel.join(', ') : 'Onbekend gebruik'}
                    {v.status ? ` · ${v.status}` : ''}
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
