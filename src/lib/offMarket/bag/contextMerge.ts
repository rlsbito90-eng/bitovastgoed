// V2.4 — Merge BAG-pandcontext (via pandid) en BAG-huisnummercontext
// (via exact postcode + basis-huisnummer) tot één gededupliceerde VBO-lijst,
// inclusief MATCH-, "Zelfde BAG-pand"- en "Zelfde huisnummercontext"-badges.
//
// Pure helper — geen netwerk, geen Supabase. Wordt door tests gebruikt
// en door de edge function gespiegeld.

import type { BagVbo } from './types';

export type BagContextBron = 'pandid' | 'huisnummer' | 'gemengd' | 'leeg';

export interface MergeInput {
  /** VBO's gevonden via hetzelfde BAG-pandid als het doelobject. */
  pandidVbos: Array<BagVbo & { pandid?: string | null }>;
  /** VBO's gevonden via exact postcode + basis-huisnummer (zelfde adrescluster). */
  huisnummerVbos: Array<BagVbo & { pandid?: string | null }>;
  /** Doelobject (gekozen door gebruiker of via toevoeging-match). */
  selected: {
    vbo_id?: string | null;
    nummeraanduiding_id?: string | null;
    pandid?: string | null;
    adres?: string | null;
  };
}

export interface MergeResult {
  vbos: BagVbo[];
  totaalOpp: number;
  aantal: number;
  bron: BagContextBron;
  gebruiksdoelen: string[];
}

function normalizeAdres(a: string | null | undefined): string {
  if (!a) return '';
  return a.toLowerCase().replace(/\s+/g, ' ').trim();
}

function dedupeKey(v: BagVbo): string {
  if (v.vbo_id) return `vbo:${v.vbo_id}`;
  if (v.nummeraanduiding_id) return `na:${v.nummeraanduiding_id}`;
  return `adr:${normalizeAdres(v.adres)}`;
}

export function mergeBagContext(input: MergeInput): MergeResult {
  const { pandidVbos, huisnummerVbos, selected } = input;
  const seen = new Map<string, BagVbo & { pandid?: string | null; _bron: 'pandid' | 'huisnummer' }>();

  const isSelected = (v: BagVbo): boolean =>
    (!!selected.vbo_id && v.vbo_id === selected.vbo_id) ||
    (!!selected.nummeraanduiding_id && v.nummeraanduiding_id === selected.nummeraanduiding_id);

  const samePandidAsSelected = (v: BagVbo & { pandid?: string | null }): boolean =>
    !!selected.pandid && !!v.pandid && v.pandid === selected.pandid;

  for (const v of pandidVbos) {
    seen.set(dedupeKey(v), { ...v, _bron: 'pandid' });
  }
  for (const v of huisnummerVbos) {
    const k = dedupeKey(v);
    const ex = seen.get(k);
    if (!ex) {
      seen.set(k, { ...v, _bron: 'huisnummer' });
    } else {
      // Vul ontbrekende velden aan vanuit huisnummer-bron.
      seen.set(k, {
        ...ex,
        opp_m2: ex.opp_m2 ?? v.opp_m2 ?? null,
        gebruiksdoel: ex.gebruiksdoel?.length ? ex.gebruiksdoel : (v.gebruiksdoel ?? []),
        status: ex.status ?? v.status ?? null,
        pandid: ex.pandid ?? v.pandid ?? null,
        adres: ex.adres || v.adres,
      });
    }
  }

  const merged = Array.from(seen.values());
  const totaalOpp = merged.reduce((sum, v) => sum + (typeof v.opp_m2 === 'number' ? v.opp_m2 : 0), 0);
  const gebruiksdoelen = Array.from(
    new Set(merged.flatMap((v) => v.gebruiksdoel ?? [])),
  );

  // Bronbepaling
  const heeftPandid = merged.some((v) => v._bron === 'pandid');
  const heeftHuisnummer = merged.some((v) => v._bron === 'huisnummer');
  let bron: BagContextBron = 'leeg';
  if (heeftPandid && heeftHuisnummer) bron = 'gemengd';
  else if (heeftPandid) bron = 'pandid';
  else if (heeftHuisnummer) bron = 'huisnummer';

  // Badges + doelobject; sorteer doelobject eerst.
  const vbos: BagVbo[] = merged.map((v) => {
    const sel = isSelected(v);
    let badge: string;
    if (sel) badge = 'MATCH · Doelobject';
    else if (samePandidAsSelected(v)) badge = 'Zelfde BAG-pand';
    else badge = 'Zelfde huisnummercontext';
    const { _bron, pandid, ...rest } = v;
    void _bron; void pandid;
    return { ...rest, is_doelobject: sel, match_badge: badge };
  });
  vbos.sort((a, b) => Number(!!b.is_doelobject) - Number(!!a.is_doelobject));

  return { vbos, totaalOpp, aantal: vbos.length, bron, gebruiksdoelen };
}
