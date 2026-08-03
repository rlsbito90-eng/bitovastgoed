export interface BagVoorkomenKern {
  objecttype: string;
  identificatie: string;
  voorkomenidentificatie: number | null;
  beginGeldigheid: string | null;
  eindGeldigheid: string | null;
  tijdstipRegistratie: string | null;
  eindRegistratie: string | null;
  tijdstipInactief: string | null;
  status: string | null;
  relaties: Record<string, string[]>;
  velden: Record<string, string | number | boolean | string[] | null>;
}

export interface BagActueelObject<T extends BagVoorkomenKern = BagVoorkomenKern> {
  identificatie: string;
  actueel: T | null;
  historie: T[];
}

export interface BagGenormaliseerdAdres {
  nummeraanduidingId: string;
  openbareRuimteId: string | null;
  woonplaatsId: string | null;
  straatnaam: string | null;
  woonplaatsnaam: string | null;
  huisnummer: number | null;
  huisletter: string | null;
  huisnummertoevoeging: string | null;
  postcode: string | null;
  adresregel: string | null;
}

export interface BagAdresseerbaarObjectRelaties {
  objecttype: 'Verblijfsobject' | 'Standplaats' | 'Ligplaats';
  identificatie: string;
  hoofdadres: BagGenormaliseerdAdres | null;
  nevenadressen: BagGenormaliseerdAdres[];
  pandIds: string[];
}

export interface BagRelationeleNormalisatieFout {
  code:
    | 'meerdere_actuele_voorkomens'
    | 'ontbrekende_nummeraanduiding'
    | 'ontbrekende_openbare_ruimte'
    | 'ontbrekende_woonplaats';
  objecttype: string;
  identificatie: string;
  referentieId: string | null;
  reden: string;
}

export interface BagRelationeleNormalisatieResultaat {
  objecten: BagActueelObject[];
  adressen: BagGenormaliseerdAdres[];
  adresseerbareObjecten: BagAdresseerbaarObjectRelaties[];
  fouten: BagRelationeleNormalisatieFout[];
}

function tekst(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function teksten(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(tekst).filter((item): item is string => Boolean(item)))].sort();
}

function datumWaarde(value: string | null): number {
  if (!value) return Number.NEGATIVE_INFINITY;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

export function isActueelVoorkomen(voorkomen: BagVoorkomenKern): boolean {
  return !voorkomen.eindGeldigheid && !voorkomen.eindRegistratie && !voorkomen.tijdstipInactief;
}

function vergelijkVoorkomens(a: BagVoorkomenKern, b: BagVoorkomenKern): number {
  return (
    datumWaarde(b.beginGeldigheid) - datumWaarde(a.beginGeldigheid)
    || datumWaarde(b.tijdstipRegistratie) - datumWaarde(a.tijdstipRegistratie)
    || (b.voorkomenidentificatie ?? -1) - (a.voorkomenidentificatie ?? -1)
  );
}

export function groepeerVoorkomens(voorkomens: BagVoorkomenKern[]): {
  objecten: BagActueelObject[];
  fouten: BagRelationeleNormalisatieFout[];
} {
  const groepen = new Map<string, BagVoorkomenKern[]>();
  for (const voorkomen of voorkomens) {
    const sleutel = `${voorkomen.objecttype}|${voorkomen.identificatie}`;
    const groep = groepen.get(sleutel) ?? [];
    groep.push(voorkomen);
    groepen.set(sleutel, groep);
  }

  const objecten: BagActueelObject[] = [];
  const fouten: BagRelationeleNormalisatieFout[] = [];

  for (const groep of groepen.values()) {
    const gesorteerd = [...groep].sort(vergelijkVoorkomens);
    const actuele = gesorteerd.filter(isActueelVoorkomen);
    if (actuele.length > 1) {
      fouten.push({
        code: 'meerdere_actuele_voorkomens',
        objecttype: groep[0].objecttype,
        identificatie: groep[0].identificatie,
        referentieId: null,
        reden: 'Meer dan één voorkomen voldoet aan de regels voor een actueel voorkomen; het meest recente wordt geselecteerd.',
      });
    }
    const actueel = actuele[0] ?? null;
    objecten.push({
      identificatie: groep[0].identificatie,
      actueel,
      historie: gesorteerd.filter(item => item !== actueel),
    });
  }

  objecten.sort((a, b) => a.identificatie.localeCompare(b.identificatie));
  return { objecten, fouten };
}

function objectIndex(objecten: BagActueelObject[]): Map<string, BagVoorkomenKern> {
  const index = new Map<string, BagVoorkomenKern>();
  for (const item of objecten) {
    if (item.actueel) index.set(`${item.actueel.objecttype}|${item.identificatie}`, item.actueel);
  }
  return index;
}

function bouwAdres(
  nummeraanduiding: BagVoorkomenKern,
  index: Map<string, BagVoorkomenKern>,
  fouten: BagRelationeleNormalisatieFout[],
): BagGenormaliseerdAdres {
  const openbareRuimteId = nummeraanduiding.relaties.ligtAan?.[0] ?? null;
  const openbareRuimte = openbareRuimteId ? index.get(`OpenbareRuimte|${openbareRuimteId}`) ?? null : null;
  if (openbareRuimteId && !openbareRuimte) {
    fouten.push({ code: 'ontbrekende_openbare_ruimte', objecttype: 'Nummeraanduiding', identificatie: nummeraanduiding.identificatie, referentieId: openbareRuimteId, reden: 'De gekoppelde openbare ruimte ontbreekt als actueel object.' });
  }

  const woonplaatsId = openbareRuimte?.relaties.ligtIn?.[0] ?? null;
  const woonplaats = woonplaatsId ? index.get(`Woonplaats|${woonplaatsId}`) ?? null : null;
  if (woonplaatsId && !woonplaats) {
    fouten.push({ code: 'ontbrekende_woonplaats', objecttype: 'OpenbareRuimte', identificatie: openbareRuimte?.identificatie ?? openbareRuimteId ?? '', referentieId: woonplaatsId, reden: 'De gekoppelde woonplaats ontbreekt als actueel object.' });
  }

  const straatnaam = tekst(openbareRuimte?.velden.naam);
  const woonplaatsnaam = tekst(woonplaats?.velden.naam);
  const huisnummer = typeof nummeraanduiding.velden.huisnummer === 'number' ? nummeraanduiding.velden.huisnummer : null;
  const huisletter = tekst(nummeraanduiding.velden.huisletter);
  const toevoeging = tekst(nummeraanduiding.velden.huisnummertoevoeging);
  const postcode = tekst(nummeraanduiding.velden.postcode)?.replace(/\s+/g, '').toUpperCase() ?? null;
  const nummerdeel = huisnummer == null ? null : `${huisnummer}${huisletter ?? ''}${toevoeging ? `-${toevoeging}` : ''}`;

  return {
    nummeraanduidingId: nummeraanduiding.identificatie,
    openbareRuimteId,
    woonplaatsId,
    straatnaam,
    woonplaatsnaam,
    huisnummer,
    huisletter,
    huisnummertoevoeging: toevoeging,
    postcode,
    adresregel: straatnaam && nummerdeel ? `${straatnaam} ${nummerdeel}` : null,
  };
}

export function normaliseerBagRelaties(voorkomens: BagVoorkomenKern[]): BagRelationeleNormalisatieResultaat {
  const gegroepeerd = groepeerVoorkomens(voorkomens);
  const fouten = [...gegroepeerd.fouten];
  const index = objectIndex(gegroepeerd.objecten);

  const adressen = gegroepeerd.objecten
    .map(item => item.actueel)
    .filter((item): item is BagVoorkomenKern => item?.objecttype === 'Nummeraanduiding')
    .map(item => bouwAdres(item, index, fouten))
    .sort((a, b) => a.nummeraanduidingId.localeCompare(b.nummeraanduidingId));
  const adresIndex = new Map(adressen.map(adres => [adres.nummeraanduidingId, adres]));

  const adresseerbareObjecten: BagAdresseerbaarObjectRelaties[] = [];
  for (const item of gegroepeerd.objecten) {
    const actueel = item.actueel;
    if (!actueel || !['Verblijfsobject', 'Standplaats', 'Ligplaats'].includes(actueel.objecttype)) continue;
    const hoofdadresId = actueel.relaties.hoofdadres?.[0] ?? null;
    const hoofdadres = hoofdadresId ? adresIndex.get(hoofdadresId) ?? null : null;
    if (hoofdadresId && !hoofdadres) {
      fouten.push({ code: 'ontbrekende_nummeraanduiding', objecttype: actueel.objecttype, identificatie: actueel.identificatie, referentieId: hoofdadresId, reden: 'De gekoppelde hoofdnummeraanduiding ontbreekt als actueel object.' });
    }
    const nevenadressen = teksten(actueel.relaties.nevenadres)
      .map(id => {
        const adres = adresIndex.get(id) ?? null;
        if (!adres) fouten.push({ code: 'ontbrekende_nummeraanduiding', objecttype: actueel.objecttype, identificatie: actueel.identificatie, referentieId: id, reden: 'Een gekoppelde nevennummeraanduiding ontbreekt als actueel object.' });
        return adres;
      })
      .filter((adres): adres is BagGenormaliseerdAdres => Boolean(adres));

    adresseerbareObjecten.push({
      objecttype: actueel.objecttype as BagAdresseerbaarObjectRelaties['objecttype'],
      identificatie: actueel.identificatie,
      hoofdadres,
      nevenadressen,
      pandIds: teksten(actueel.relaties.maaktDeelUitVan),
    });
  }

  adresseerbareObjecten.sort((a, b) => a.identificatie.localeCompare(b.identificatie));
  fouten.sort((a, b) => `${a.code}|${a.identificatie}|${a.referentieId ?? ''}`.localeCompare(`${b.code}|${b.identificatie}|${b.referentieId ?? ''}`));
  return { objecten: gegroepeerd.objecten, adressen, adresseerbareObjecten, fouten };
}
