// Defensieve mapper voor Kadaster `rechten` / eigendomsinformatie.
//
// Kadaster's exacte response-shape voor rechten is niet vooraf 1:1 vastgelegd
// in onze codebase. Deze mapper probeert meerdere veelvoorkomende namen
// (rechthebbenden / tenaamstellingen / gerechtigden / eigenaren / rechten)
// en pakt per regel veilig naam, bedrijfsnaam, type, aandeel en rechtsoort.
// Bij onbekende of geneste structuren crasht hij niet; de PreviewDialog
// valt dan terug op de technische details.

export interface KadasterRechthebbende {
  naam: string | null;
  bedrijfsnaam: string | null;
  type: string | null;
  aandeel: string | null;
  rechtsoort: string | null;
}

export interface KadasterRechtenView {
  rechthebbenden: KadasterRechthebbende[];
  kadastraleAanduiding: string | null;
  appartementsrecht: string | null;
}

function leesString(obj: unknown, ...keys: string[]): string | null {
  if (!obj || typeof obj !== 'object') return null;
  const o = obj as Record<string, unknown>;
  for (const k of keys) {
    const v = o[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return null;
}

function leesAandeel(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const t = o.teller, n = o.noemer;
    if (typeof t === 'number' && typeof n === 'number' && n !== 0) {
      return `${t}/${n}`;
    }
    return leesString(o, 'omschrijving', 'tekst', 'value');
  }
  return null;
}

function mapRechthebbendeRegel(r: unknown): KadasterRechthebbende | null {
  if (!r || typeof r !== 'object') return null;
  const rr = r as Record<string, unknown>;

  const persoon = (rr.persoon ?? rr.natuurlijkPersoon ?? rr.naturalPerson) as unknown;
  const ond = (rr.onderneming ?? rr.nietNatuurlijkPersoon
    ?? rr.rechtspersoon ?? rr.organisatie ?? rr.legalEntity) as unknown;

  const naam =
    leesString(persoon, 'volledigeNaam', 'naam', 'achternaam', 'geslachtsnaam')
    ?? leesString(rr, 'naam', 'volledigeNaam', 'achternaam');
  const bedrijfsnaam =
    leesString(ond, 'statutaireNaam', 'naam', 'handelsnaam', 'organisatieNaam')
    ?? leesString(rr, 'bedrijfsnaam', 'statutaireNaam', 'handelsnaam');
  const type =
    leesString(rr, 'soortRechthebbende', 'typeRechthebbende', 'type', 'soort')
    ?? (persoon ? 'natuurlijk persoon' : (ond ? 'rechtspersoon' : null));
  const aandeel = leesAandeel(rr.aandeel) ?? leesAandeel((rr as Record<string, unknown>).share);
  const rechtsoort = leesString(
    rr, 'rechtsoort', 'aardRecht', 'aardRechtVerkort', 'soortRecht', 'rightType',
  );

  if (!naam && !bedrijfsnaam && !rechtsoort && !aandeel) return null;
  return { naam, bedrijfsnaam, type, aandeel, rechtsoort };
}

export function mapRechten(data: unknown): KadasterRechtenView {
  const result: KadasterRechtenView = {
    rechthebbenden: [],
    kadastraleAanduiding: null,
    appartementsrecht: null,
  };
  if (!data || typeof data !== 'object') return result;
  const d = data as Record<string, unknown>;

  const kandidaten = [
    d.rechthebbenden, d.tenaamstellingen, d.gerechtigden,
    d.eigenaren, d.rechten, d.rightHolders,
  ];
  for (const lijst of kandidaten) {
    if (!Array.isArray(lijst)) continue;
    const regels = lijst
      .map(mapRechthebbendeRegel)
      .filter((r): r is KadasterRechthebbende => r !== null);
    if (regels.length > 0) {
      result.rechthebbenden = regels;
      break;
    }
  }

  result.kadastraleAanduiding = leesString(
    d, 'kadastraleAanduiding', 'aanduiding', 'kadastraleObjectIdentificatie',
  );
  result.appartementsrecht = leesString(
    d, 'appartementsrecht', 'appartementsrechtsplitsing', 'appartement',
  );

  return result;
}

export function heeftRechtenInhoud(v: KadasterRechtenView): boolean {
  return v.rechthebbenden.length > 0
    || !!v.kadastraleAanduiding
    || !!v.appartementsrecht;
}
