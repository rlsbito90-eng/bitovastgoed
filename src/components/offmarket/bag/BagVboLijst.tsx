// V2.3 + V2.4 — Lijst met BAG-verblijfsobjecten in de BAG-pandcontext.
// V2.4: toont MATCH/Doelobject-badge, "Zelfde BAG-pand"-badge en per VBO
// gebruiksdoel, oppervlakte, VBO-ID, pand-ID, bouwjaar en pandstatus.
// V2.4 fix: VBO-ID en Pand-ID worden volledig getoond (geen ellipsis) + kopieerknop.
import { Check } from 'lucide-react';
import type { BagVbo } from '@/lib/offMarket/bag/types';
import BagIdCopy from './BagIdCopy';

interface Props {
  vbos: BagVbo[] | null | undefined;
  geselecteerdVboId?: string | null;
  geselecteerdNummeraanduidingId?: string | null;
  maxItems?: number;
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
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
            ? 'bg-emerald-500/15 text-emerald-900 border-emerald-500/40 dark:bg-emerald-400/15 dark:text-emerald-100 dark:border-emerald-300/40'
            : 'bg-sky-500/10 text-sky-900 border-sky-400/40 dark:bg-sky-400/10 dark:text-sky-100 dark:border-sky-300/40';
          const gebruik = v.gebruiksdoel?.length ? v.gebruiksdoel.map(cap).join(', ') : 'Onbekend gebruik';
          return (
            <li
              key={v.vbo_id || v.nummeraanduiding_id}
              data-testid="bag-vbo-item"
              data-gekozen={doelobject ? 'true' : 'false'}
              data-doelobject={doelobject ? 'true' : 'false'}
              data-variant={doelobject ? 'doelobject' : 'context'}
              data-theme-safe="true"
              className={`rounded-md border px-3 py-2 text-xs transition-colors ${
                doelobject
                  ? 'border-emerald-500/40 bg-emerald-500/5 ring-1 ring-emerald-500/20 dark:bg-emerald-400/[0.06] dark:border-emerald-300/40 dark:ring-emerald-300/15 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]'
                  : 'border-border/70 bg-card/60'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
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
                    <p className="text-foreground truncate" data-testid="bag-vbo-adres">{v.adres || '—'}</p>
                  </div>
                </div>
                <span className="font-mono-data text-foreground whitespace-nowrap" data-testid="bag-vbo-opp">
                  {v.opp_m2 != null ? `${v.opp_m2} m²` : '—'}
                </span>
              </div>

              <dl
                data-testid="bag-vbo-details"
                className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-0.5 pl-5 text-[11px] text-muted-foreground"
              >
                <div className="flex gap-1.5">
                  <dt className="text-foreground/70">Gebruiksdoel:</dt>
                  <dd className="text-foreground" data-testid="bag-vbo-gebruik">{gebruik}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-foreground/70">Oppervlakte:</dt>
                  <dd className="text-foreground">{v.opp_m2 != null ? `${v.opp_m2} m²` : '—'}</dd>
                </div>
                <div className="flex gap-1.5 min-w-0 sm:col-span-2">
                  <dt className="text-foreground/70 shrink-0">Verblijfsobject:</dt>
                  <dd className="min-w-0 flex-1">
                    <BagIdCopy value={v.vbo_id} testId="bag-vbo-vboid" ariaLabel="Kopieer VBO-ID" />
                  </dd>
                </div>
                <div className="flex gap-1.5 min-w-0 sm:col-span-2">
                  <dt className="text-foreground/70 shrink-0">Pand:</dt>
                  <dd className="min-w-0 flex-1">
                    <BagIdCopy value={v.pandid ?? null} testId="bag-vbo-pandid" ariaLabel="Kopieer Pand-ID" />
                  </dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-foreground/70">Bouwjaar:</dt>
                  <dd className="text-foreground" data-testid="bag-vbo-bouwjaar">{v.pand_bouwjaar ?? '—'}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt className="text-foreground/70">Pandstatus:</dt>
                  <dd className="text-foreground" data-testid="bag-vbo-pandstatus">{v.pand_status || '—'}</dd>
                </div>
              </dl>
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
