// Persist Kadaster-records direct na succesvolle Kadaster-response.
//
// Doel: zodra een Kadaster-aanvraag succesvol is, mogen de opgehaalde
// gegevens niet meer verloren gaan wanneer de gebruiker de preview sluit,
// terugnavigeert of de browser ververst. Per product schrijven we één
// `kadaster_data_records` rij — ook voor producten met status
// `niet_geleverd`, zodat zichtbaar blijft dat het product is geprobeerd.
//
// Strikte regels:
//   - Geen API-key, headers of volledige raw response opslaan.
//   - `raw_limited` is whitelistbased per productcode.
//   - Geen automatische overname naar objectvelden of relaties.
//   - Geen fallback Kadaster-call bij persist-fout.

// @ts-nocheck — Deno runtime
import type { KadasterDeliverStatus, KadasterProductCode, KadasterProductResult } from './_types.ts';

type SupabaseClient = ReturnType<typeof import('npm:@supabase/supabase-js@2').createClient>;

function asObj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>) : null;
}
function asStr(v: unknown): string | null {
  if (typeof v === 'string' && v.trim()) return v.trim();
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  return null;
}
function asInt(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'string' && v.trim()) {
    const n = parseFloat(v.replace(/\./g, '').replace(',', '.'));
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}
function asBool(v: unknown): boolean | null {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    if (s === 'ja' || s === 'true' || s === '1') return true;
    if (s === 'nee' || s === 'false' || s === '0') return false;
  }
  return null;
}
function asBig(v: unknown): number | null {
  return asInt(v);
}

/** Filter object to keep only whitelisted top-level keys. */
function whitelist(obj: unknown, keys: string[]): Record<string, unknown> {
  const o = asObj(obj);
  if (!o) return {};
  const out: Record<string, unknown> = {};
  for (const k of keys) {
    if (o[k] !== undefined) out[k] = o[k];
  }
  return out;
}

interface BaseRow {
  object_id: string | null;
  signaal_id: string | null;
  source: string;
  mode: string;
  product_code: KadasterProductCode;
  status: KadasterDeliverStatus | 'fout';
  zoekadres: Record<string, unknown>;
  fetched_at: string;
  raw_limited: Record<string, unknown>;
  created_by: string | null;
}

function mapStatusVoorDb(s: KadasterDeliverStatus | undefined): KadasterDeliverStatus {
  if (s === 'geleverd' || s === 'gedeeltelijk'
      || s === 'niet_geleverd' || s === 'niet_beschikbaar') return s;
  return 'niet_geleverd';
}

function buildRow(
  base: BaseRow,
  product: KadasterProductResult,
): Record<string, unknown> {
  const row: Record<string, unknown> = { ...base, status: mapStatusVoorDb(product.status) };
  const data = asObj(product.data) ?? {};

  if (product.code === 'object') {
    const bag = asObj(data.bagObjectData) ?? {};
    const wozLijst = Array.isArray(data.wozObjecten) ? data.wozObjecten : [];
    const w0 = asObj(wozLijst[0]) ?? {};

    row.bag_bouwjaar = asInt(bag.bouwjaar);
    row.bag_oppervlakte = asInt(bag.oppervlakteBag);
    row.bag_object_status = asStr(bag.objectStatus);
    row.bag_gebruiksdoel = asStr(bag.omschrijvingVergundeGebruik);

    row.woz_objectnummer = asStr(w0.wozObjectNummer);
    row.woz_oppervlakte = asInt(w0.oppervlakteWoz);
    row.woz_oppervlakte_wonen = asInt(w0.oppervlakteWozWonen);
    row.woz_oppervlakte_niet_wonen = asInt(w0.oppervlakteWozNietWonen);
    row.woz_inhoud = asInt(w0.inhoud);
    row.woz_gebruiksklasse = asStr(w0.gebruiksklasse);
    row.feitelijk_gebruik = asStr(w0.feitelijkGebruik);
    row.monumentaanduiding = asStr(w0.monumentaanduiding);
    row.actualiteit = asStr(data.actualiteit);

    row.raw_limited = {
      bagObjectData: whitelist(bag, [
        'objectStatus', 'bouwjaar', 'oppervlakteBag',
        'omschrijvingVergundeGebruik', 'complexrelatie', 'oppervlakteWijziging',
      ]),
      wozObjecten: wozLijst.map((w) => whitelist(w, [
        'wozObjectNummer', 'gebruiksklasse', 'feitelijkGebruik',
        'monumentaanduiding', 'oppervlakteWoz', 'oppervlakteWozWonen',
        'oppervlakteWozNietWonen', 'inhoud', 'bouwlaag',
      ])),
      actualiteit: data.actualiteit ?? null,
      titel: data.titel ?? null,
      doelbinding: data.doelbinding ?? null,
    };
  } else if (product.code === 'waarde') {
    // Koopsom-blok kan onder verschillende namen voorkomen.
    const k = asObj(data.koopsom) ?? asObj(data.transactie) ?? data;
    row.koopsom = asBig(k.koopsom ?? k.bedrag ?? k.koopprijs ?? k.value);
    row.koopjaar = asInt(k.koopJaar ?? k.koopjaar ?? k.jaar ?? k.year);
    row.koopsom_valuta = asStr(k.koopsomValuta ?? k.valuta ?? k.currency) ?? 'EUR';
    row.meer_onroerend_goed = asBool(k.meerOnroerendGoed ?? k.multipleProperty);
    row.doelbinding = asBool(data.doelbinding ?? k.doelbinding);

    row.raw_limited = {
      waarde: whitelist(k, [
        'koopsom', 'koopJaar', 'koopjaar', 'koopsomValuta', 'valuta',
        'meerOnroerendGoed', 'bedrag', 'koopprijs',
      ]),
      doelbinding: data.doelbinding ?? null,
    };
  } else if (product.code === 'rechten') {
    // Brede zoektocht naar rechthebbenden + diagnostische shape.
    // We slaan geen volledige raw response op; alleen keys/lengtes.
    const lijstKeys = [
      'rechthebbenden', 'tenaamstellingen', 'gerechtigden',
      'eigenaren', 'rechten', 'rightHolders', 'personen',
      'rechtspersonen', 'natuurlijkePersonen', 'nietNatuurlijkePersonen',
      // Kadaster Objectinformatie API: 'persons' / 'entities' per rechten-item.
      'persons', 'entities',
    ];
    let lijst: unknown[] | undefined;
    let lijstNaam: string | null = null;
    for (const k of lijstKeys) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v) && v.length > 0) { lijst = v; lijstNaam = k; break; }
    }
    // Als 'rechten' een array is met items die persons/entities bevatten,
    // gebruik die geneste lijst voor de rechthebbende-extractie.
    if (lijstNaam === 'rechten' && lijst && lijst.length > 0) {
      const r0c = asObj(lijst[0]) ?? {};
      for (const nk of ['persons', 'entities', 'rechthebbenden', 'personen']) {
        const nv = (r0c as Record<string, unknown>)[nk];
        if (Array.isArray(nv) && nv.length > 0) { lijst = nv; lijstNaam = `rechten[0].${nk}`; break; }
      }
    }
    const r0 = asObj(lijst?.[0]) ?? {};
    const persoon = asObj(r0.persoon) ?? asObj(r0.natuurlijkPersoon)
      ?? asObj((r0 as Record<string, unknown>).naturalPerson)
      ?? asObj((r0 as Record<string, unknown>).naamNatuurlijkPersoon) ?? {};
    const ond = asObj(r0.onderneming) ?? asObj(r0.nietNatuurlijkPersoon)
      ?? asObj(r0.rechtspersoon) ?? asObj((r0 as Record<string, unknown>).organisatie)
      ?? asObj((r0 as Record<string, unknown>).legalEntity)
      ?? asObj((r0 as Record<string, unknown>).naamNietNatuurlijkPersoon) ?? {};

    row.rechthebbende_naam =
      asStr(persoon.volledigeNaam) ?? asStr(persoon.naam)
      ?? asStr((persoon as Record<string, unknown>).achternaam)
      ?? asStr((persoon as Record<string, unknown>).geslachtsnaam)
      ?? asStr(ond.statutaireNaam) ?? asStr(ond.naam)
      ?? asStr((ond as Record<string, unknown>).handelsnaam)
      ?? asStr((ond as Record<string, unknown>).organisatieNaam)
      ?? asStr(r0.naam) ?? asStr((r0 as Record<string, unknown>).volledigeNaam)
      ?? asStr((r0 as Record<string, unknown>).naamRechthebbende)
      ?? asStr((r0 as Record<string, unknown>).bedrijfsnaam) ?? null;
    row.rechthebbende_type = asStr(r0.soortRechthebbende)
      ?? asStr(r0.typeRechthebbende) ?? asStr((r0 as Record<string, unknown>).type)
      ?? asStr((r0 as Record<string, unknown>).soort)
      ?? asStr((r0 as Record<string, unknown>).rechtsvorm)
      ?? (Object.keys(persoon).length > 0
        ? 'natuurlijk persoon'
        : (Object.keys(ond).length > 0 ? 'rechtspersoon' : null));
    row.rechtsoort = asStr(r0.rechtsoort) ?? asStr(r0.aardRecht)
      ?? asStr(r0.aardRechtVerkort)
      ?? asStr((r0 as Record<string, unknown>).soortRecht)
      ?? asStr((r0 as Record<string, unknown>).zakelijkRecht)
      ?? asStr((r0 as Record<string, unknown>).omschrijvingRecht)
      ?? asStr((r0 as Record<string, unknown>).recht) ?? null;
    const aandeelV = r0.aandeel
      ?? (r0 as Record<string, unknown>).aandeelInRecht
      ?? (r0 as Record<string, unknown>).breukdeel
      ?? (r0 as Record<string, unknown>).gerechtigdAandeel
      ?? (r0 as Record<string, unknown>).share;
    row.aandeel = typeof aandeelV === 'string' ? aandeelV
      : (asObj(aandeelV) && typeof (aandeelV as Record<string, unknown>).teller === 'number'
          && typeof (aandeelV as Record<string, unknown>).noemer === 'number'
            ? `${(aandeelV as Record<string, unknown>).teller}/${(aandeelV as Record<string, unknown>).noemer}`
            : asStr(aandeelV));
    row.kadastrale_aanduiding = asStr(data.kadastraleAanduiding)
      ?? asStr(data.aanduiding)
      ?? asStr((data as Record<string, unknown>).kadastraalObject)
      ?? asStr((data as Record<string, unknown>).kadastraleObjectIdentificatie)
      ?? null;

    // Diagnostische shape (geen vrije inhoud, alleen keys/lengtes).
    const dataKeys = Object.keys(data).slice(0, 32);
    const arrays: Record<string, { lengte: number; first_item_keys: string[] }> = {};
    for (const k of dataKeys) {
      const v = (data as Record<string, unknown>)[k];
      if (Array.isArray(v) && v.length > 0) {
        const first = asObj(v[0]) ?? {};
        arrays[k] = { lengte: v.length, first_item_keys: Object.keys(first).slice(0, 24) };
      }
    }

    row.rechten_samenvatting = {
      aantal_rechthebbenden: Array.isArray(lijst) ? lijst.length : 0,
      gebruikte_array: lijstNaam,
      eerste: row.rechthebbende_naam
        ? {
            naam: row.rechthebbende_naam,
            type: row.rechthebbende_type,
            rechtsoort: row.rechtsoort,
            aandeel: row.aandeel,
          }
        : null,
    };
    // Whitelist structurele blokken voor weergave (geen vrije velden).
    const rechtenBlokKeys = [
      'rechtsoort', 'soortRecht', 'aardRecht', 'aardRechtVerkort',
      'omschrijvingRecht', 'zakelijkRecht', 'recht', 'omschrijving',
      'aandeel', 'aandeelInRecht', 'breukdeel', 'gerechtigdAandeel',
      'persoon', 'natuurlijkPersoon', 'naamNatuurlijkPersoon',
      'onderneming', 'nietNatuurlijkPersoon', 'rechtspersoon',
      'organisatie', 'naamNietNatuurlijkPersoon',
      // Kadaster Objectinformatie API: 'persons' / 'entities' per rechten-item.
      'persons', 'entities', 'rechthebbenden',
      'naam', 'voornamen', 'geslachtsnaam', 'volledigeNaam', 'naamRechthebbende',
      'bedrijfsnaam', 'statutaireNaam', 'handelsnaam',
      'kvkNummer', 'kvk', 'zetel', 'statutaireZetel',
      'geboortedatum', 'geboorteplaats',
      'adres', 'woonadres', 'vestigingsadres', 'correspondentieadres',
      'postcode', 'plaats', 'woonplaats', 'straat', 'huisnummer',
      'huisletter', 'huisnummertoevoeging', 'toevoeging', 'postbus',
      'gebaseerdOp', 'documentGebaseerdOp', 'documentVermeldIn',
      'stukMelding', 'registerverwijzing',
      'register', 'registerHyp4', 'deel', 'nummer', 'identifier',
      'kadastraleAanduiding', 'aanduiding', 'kadastraalObject',
    ];

    const blokkenSrc: unknown[] = [];
    const containerKeys = ['rechten', 'overigeRechten', 'zakelijkeRechten',
      'rechtenLijst', 'eigendom', 'eigendommen', 'beperkteRechten'];
    for (const ck of containerKeys) {
      const v = (data as Record<string, unknown>)[ck];
      if (Array.isArray(v)) blokkenSrc.push(...v);
      else if (asObj(v)) blokkenSrc.push(v);
    }
    if (blokkenSrc.length === 0 && Array.isArray(lijst)) blokkenSrc.push(...lijst);

    function whitelistDiep(v: unknown, diepte = 0): unknown {
      if (diepte > 3) return null;
      if (Array.isArray(v)) return v.slice(0, 10).map((x) => whitelistDiep(x, diepte + 1));
      const o = asObj(v); if (!o) return typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean' ? v : null;
      const out: Record<string, unknown> = {};
      for (const k of rechtenBlokKeys) {
        if (o[k] !== undefined) out[k] = whitelistDiep(o[k], diepte + 1);
      }
      return out;
    }
    const blokkenWhitelist = blokkenSrc.slice(0, 20).map((b) => whitelistDiep(b));

    row.raw_limited = {
      rechten: {
        aantal: Array.isArray(lijst) ? lijst.length : 0,
        gebruikte_array: lijstNaam,
        top_level_keys: dataKeys,
        arrays,
        kadastraleAanduiding: asStr(data.kadastraleAanduiding)
          ?? asStr(data.aanduiding) ?? null,
        appartementsrecht: asStr((data as Record<string, unknown>).appartementsrecht)
          ?? asStr((data as Record<string, unknown>).appartementsrechtsplitsing) ?? null,
        blokken: blokkenWhitelist,
      },
    };
  } else {
    // lasten / buurt — alleen markering opslaan.
    row.raw_limited = {};
  }
  return row;
}

/**
 * Schrijf per gevraagd product één record. Producten zonder data worden
 * ook bewaard met passende status zodat zichtbaar blijft dat het product
 * voor dit adres is geprobeerd. Faalt persist, dan gooien we — caller
 * kan dit doorgeven aan de UI zonder een nieuwe Kadaster-call te doen.
 */
export async function persistKadasterRecords(
  client: SupabaseClient,
  args: {
    objectId: string | null;
    signaalId: string | null;
    mode: string;
    fetchedAt: string;
    zoekadres: Record<string, unknown>;
    producten: KadasterProductResult[];
    userId: string | null;
  },
): Promise<{ inserted: number; ids: string[] }> {
  const base: BaseRow = {
    object_id: args.objectId,
    signaal_id: args.signaalId,
    source: 'kadaster_objectinformatie_api',
    mode: args.mode,
    product_code: 'object',
    status: 'niet_geleverd',
    zoekadres: args.zoekadres,
    fetched_at: args.fetchedAt,
    raw_limited: {},
    created_by: args.userId,
  };
  const rows = args.producten.map((p) => buildRow({ ...base, product_code: p.code }, p));
  if (rows.length === 0) return { inserted: 0, ids: [] };

  const { data, error } = await client
    .from('kadaster_data_records')
    .insert(rows)
    .select('id');
  if (error) throw new Error(error.message);
  return { inserted: data?.length ?? 0, ids: (data ?? []).map((r: { id: string }) => r.id) };
}
