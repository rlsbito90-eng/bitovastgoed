// V2.3 — Lijst met BAG-verblijfsobjecten (VBO's).
import type { BagVbo } from '@/lib/offMarket/bag/types';

interface Props {
  vbos: BagVbo[] | null | undefined;
}

export default function BagVboLijst({ vbos }: Props) {
  if (!vbos || vbos.length === 0) {
    return (
      <p data-testid="bag-vbo-lijst-leeg" className="text-[11px] text-muted-foreground italic">
        Geen verblijfsobjecten gevonden.
      </p>
    );
  }
  return (
    <ul data-testid="bag-vbo-lijst" className="space-y-1.5">
      {vbos.map((v) => (
        <li
          key={v.vbo_id || v.nummeraanduiding_id}
          data-testid="bag-vbo-item"
          className="rounded-md border border-border/70 bg-card/60 px-3 py-2 text-xs flex items-start justify-between gap-3"
        >
          <div className="min-w-0">
            <p className="text-foreground truncate">{v.adres || '—'}</p>
            <p className="text-[10px] text-muted-foreground">
              {v.gebruiksdoel?.length ? v.gebruiksdoel.join(', ') : 'Onbekend gebruik'}
              {v.status ? ` · ${v.status}` : ''}
            </p>
          </div>
          <span className="font-mono-data text-foreground whitespace-nowrap">
            {v.opp_m2 != null ? `${v.opp_m2} m²` : '—'}
          </span>
        </li>
      ))}
    </ul>
  );
}
