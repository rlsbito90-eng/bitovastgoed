// Rechtenbewuste eigenaarbepaling voor de Off-Market acquisitieflow.
// Volledig puur: geen DB, geen Kadaster-aanroep, geen React.
import type { KadasterRechtenBlok } from '@/lib/kadaster/rechtenBlokken';
import { isVolledigPostadres } from '@/lib/offMarket/acquisitie/postadres';
import {
  maakKadasterEigenaarVoorstel,
  type KadasterEigenaarVoorstel,
} from '@/lib/offMarket/acquisitie/kadasterEigenaarVoorstel';

export type Rechtssituatie =
  | 'volle_eigendom'
  | 'erfpacht'
  | 'opstal'
  | 'appartementsrecht'
  | 'vruchtgebruik'
  | 'overig'
  | 'onbekend';

export const RECHTSSITUATIE_LABEL: Record<Rechtssituatie, string> = {
  volle_eigendom: 'Volle eigendom',
  erfpacht: 'Erfpacht',
  opstal: 'Opstal',
  appartementsrecht: 'Appartementsrecht',
  vruchtgebruik: 'Vruchtgebruik',
  overig: 'Overig recht',
  onbekend: 'Onbekend',
};

export const RECHTSSITUATIES_MET_BLOOT_EIGENAAR: Rechtssituatie[] = ['erfpacht', 'opstal'];

export interface BlootEigenaar {
  naam: string | null;
  bedrijfsnaam: string | null;
  kvk?: string | null;
  aandeel: string | null;
  rechtssituatie: Rechtssituatie;
}

export interface PrimaireRechthebbende {
  naam: string | null;
  bedrijfsnaam: string | null;
  kvk: string | null;
  aandeel: string | null;
  rechtstype: string | null;
  straatHuisnummer: string | null;
  postcode: string | null;
  plaats: string | null;
  verzendadres: string | null;
  adresCompleet: boolean;
}

export interface RechtenbewusteEigenaarUitkomst {
  status: 'geen' | 'eenduidig' | 'meervoudig' | 'ambigu';
  rechtssituatie: Rechtssituatie;
  rechtstype: string | null;
  voorstel: KadasterEigenaarVoorstel;
  aandeel: string | null;
  straatHuisnummer: string | null;
  postcode: string | null;
  plaats: string | null;
  verzendadres: string | null;
  adresCompleet: boolean;
  primaireRechthebbenden: PrimaireRechthebbende[];
  blootEigenaar: BlootEigenaar | null;
  controleNodig: boolean;
  controleReden: string | null;
}

const schoon = (v: string | null | undefined): string => (v ?? '').trim();
const leeg = (v: unknown): boolean => v == null || (typeof v === 'string' && v.trim() === '');

export function classificeerRechtssituatie(rechtstype: string | null | undefined): Rechtssituatie {
  const v = schoon(rechtstype).toLowerCase();
  if (!v) return 'onbekend';
  if (v.includes('erfpacht')) return 'erfpacht';
  if (v.includes('opstal')) return 'opstal';
  if (v.includes('appartementsrecht')) return 'appartementsrecht';
  if (v.includes('vruchtgebruik')) return 'vruchtgebruik';
  if (v.includes('eigendom')) return 'volle_eigendom';
  return 'overig';
}

const PRIMAIR_RANG: Record<Rechtssituatie, number> = {
  erfpacht: 50,
  opstal: 45,
  appartementsrecht: 30,
  vruchtgebruik: 20,
  volle_eigendom: 10,
  overig: 5,
  onbekend: 1,
};

export function bouwVerzendadres(
  straatHuisnummer: string | null | undefined,
  postcode: string | null | undefined,
  plaats: string | null | undefined,
): string | null {
  const straat = schoon(straatHuisnummer);
  const pcCompact = schoon(postcode).toUpperCase().replace(/\s+/g, '');
  const pc = /^\d{4}[A-Z]{2}$/.test(pcCompact)
    ? `${pcCompact.slice(0, 4)} ${pcCompact.slice(4)}`
    : schoon(postcode).toUpperCase();
  const pl = schoon(plaats);
  if (!straat || !pc || !pl) return null;
  const samen = `${straat}\n${pc} ${pl}`;
  return isVolledigPostadres(samen) ? samen : null;
}

function blokLabel(blok: KadasterRechtenBlok): string {
  const naam = schoon(blok.naam);
  const bedrijf = schoon(blok.bedrijfsnaam);
  return blok.persoonType === 'natuurlijk' ? (naam || bedrijf) : (bedrijf || naam);
}

function naarPrimaireRechthebbende(blok: KadasterRechtenBlok): PrimaireRechthebbende {
  const straatHuisnummer = schoon(blok.adresRegels?.[0]) || null;
  const postcode = schoon(blok.postcode) || null;
  const plaats = schoon(blok.plaats) || null;
  const verzendadres = bouwVerzendadres(straatHuisnummer, postcode, plaats);
  return {
    naam: schoon(blok.naam) || null,
    bedrijfsnaam: schoon(blok.bedrijfsnaam) || null,
    kvk: schoon(blok.kvkNummer) || null,
    aandeel: schoon(blok.aandeel) || null,
    rechtstype: schoon(blok.rechtstype) || null,
    straatHuisnummer,
    postcode,
    plaats,
    verzendadres,
    adresCompleet: !!verzendadres,
  };
}

export function bepaalRechtenbewusteEigenaar(
  blokken: readonly KadasterRechtenBlok[],
): RechtenbewusteEigenaarUitkomst {
  const bruikbaar = blokken.filter((b) => !!blokLabel(b));
  if (bruikbaar.length === 0) {
    const reden = 'Geen bruikbare rechthebbende gevonden in het Kadasterrecord.';
    return {
      status: 'geen', rechtssituatie: 'onbekend', rechtstype: null,
      voorstel: { status: 'geen', controleNodig: true, controleReden: reden },
      aandeel: null, straatHuisnummer: null, postcode: null, plaats: null,
      verzendadres: null, adresCompleet: false, primaireRechthebbenden: [], blootEigenaar: null,
      controleNodig: true, controleReden: reden,
    };
  }

  let besteRang = -1;
  let besteSituatie: Rechtssituatie = 'onbekend';
  for (const blok of bruikbaar) {
    const s = classificeerRechtssituatie(blok.rechtstype);
    if (PRIMAIR_RANG[s] > besteRang) {
      besteRang = PRIMAIR_RANG[s];
      besteSituatie = s;
    }
  }

  const primaireBlokken = bruikbaar.filter(
    (b) => classificeerRechtssituatie(b.rechtstype) === besteSituatie,
  );
  const voorstel = maakKadasterEigenaarVoorstel(primaireBlokken);
  const primaireRechthebbenden = primaireBlokken.map(naarPrimaireRechthebbende);
  const meervoudig = primaireRechthebbenden.length > 1;

  let blootEigenaar: BlootEigenaar | null = null;
  if (RECHTSSITUATIES_MET_BLOOT_EIGENAAR.includes(besteSituatie)) {
    const eigendomBlokken = bruikbaar.filter(
      (b) => classificeerRechtssituatie(b.rechtstype) === 'volle_eigendom',
    );
    if (eigendomBlokken.length === 1) {
      const b = eigendomBlokken[0];
      blootEigenaar = {
        naam: schoon(b.naam) || null,
        bedrijfsnaam: schoon(b.bedrijfsnaam) || null,
        kvk: schoon(b.kvkNummer) || null,
        aandeel: schoon(b.aandeel) || null,
        rechtssituatie: 'volle_eigendom',
      };
    }
  }

  const primair = primaireRechthebbenden[0] ?? null;
  const alleAdressenCompleet = primaireRechthebbenden.length > 0
    && primaireRechthebbenden.every((r) => r.adresCompleet);

  if (meervoudig) {
    return {
      status: 'meervoudig',
      rechtssituatie: besteSituatie,
      rechtstype: primair?.rechtstype ?? null,
      voorstel,
      aandeel: null,
      straatHuisnummer: null,
      postcode: null,
      plaats: null,
      verzendadres: null,
      adresCompleet: alleAdressenCompleet,
      primaireRechthebbenden,
      blootEigenaar,
      controleNodig: !alleAdressenCompleet,
      controleReden: alleAdressenCompleet
        ? null
        : 'Van één of meer primaire rechthebbenden ontbreken volledige adresgegevens.',
    };
  }

  const eenduidig = voorstel.status === 'eenduidig' && !!primair;
  const controleNodig = !eenduidig || !alleAdressenCompleet || voorstel.controleNodig;
  let controleReden = voorstel.controleReden ?? null;
  if (voorstel.status === 'ambigu') {
    controleReden = 'De primaire rechthebbende kan niet veilig automatisch worden bepaald.';
  } else if (voorstel.status === 'geen') {
    controleReden = 'Geen bruikbare primaire rechthebbende gevonden in het Kadasterrecord.';
  } else if (!alleAdressenCompleet) {
    controleReden = 'Adresgegevens van de primaire rechthebbende zijn onvolledig.';
  }

  return {
    status: eenduidig ? 'eenduidig' : voorstel.status,
    rechtssituatie: besteSituatie,
    rechtstype: primair?.rechtstype ?? null,
    voorstel,
    aandeel: primair?.aandeel ?? null,
    straatHuisnummer: primair?.straatHuisnummer ?? null,
    postcode: primair?.postcode ?? null,
    plaats: primair?.plaats ?? null,
    verzendadres: primair?.verzendadres ?? null,
    adresCompleet: !!primair?.adresCompleet,
    primaireRechthebbenden,
    blootEigenaar,
    controleNodig,
    controleReden,
  };
}

export interface HuidigeEigenaarVelden {
  eigenaar_naam?: string | null;
  eigenaar_bedrijfsnaam?: string | null;
  eigenaar_type?: string | null;
  eigenaar_kvk?: string | null;
  eigenaar_straat_huisnummer?: string | null;
  eigenaar_postcode?: string | null;
  eigenaar_plaats?: string | null;
  eigenaar_verzendadres?: string | null;
  eigenaar_rechtstype?: string | null;
  eigenaar_rechtssituatie?: string | null;
  eigenaar_aandeel?: string | null;
  bloot_eigenaar?: Record<string, unknown> | BlootEigenaar | null;
  kadastrale_aanduiding?: string | null;
  eigenaarbron?: string | null;
  eigenaarstatus?: string | null;
  eigenaar_bekend?: boolean | null;
  eigenaar_controle_nodig?: boolean | null;
  eigenaar_controle_reden?: string | null;
  status?: string | null;
}

export function formatteerBlootEigenaar(
  b: Record<string, unknown> | BlootEigenaar | null | undefined,
): string | null {
  if (!b) return null;
  const bedrijf = typeof b.bedrijfsnaam === 'string' ? b.bedrijfsnaam : null;
  const persoon = typeof b.naam === 'string' ? b.naam : null;
  const naam = schoon(bedrijf) || schoon(persoon);
  if (!naam) return null;
  const aandeel = typeof b.aandeel === 'string' ? schoon(b.aandeel) : '';
  return aandeel ? `${naam} · ${aandeel}` : naam;
}

function patchMeervoudigeRechthebbenden(
  huidig: HuidigeEigenaarVelden,
  uitkomst: RechtenbewusteEigenaarUitkomst,
): Record<string, unknown> | null {
  const bron = schoon(huidig.eigenaarbron).toLowerCase();
  const heeftBestaandeEnkelePartij = !leeg(huidig.eigenaar_naam) || !leeg(huidig.eigenaar_bedrijfsnaam);
  if (heeftBestaandeEnkelePartij && bron && bron !== 'kadaster') {
    return {
      eigenaar_controle_nodig: true,
      eigenaar_controle_reden: 'Kadasterrechten wijken af van bestaande handmatige eigenaargegevens.',
    };
  }

  const patch: Record<string, unknown> = {
    eigenaarstatus: 'gevonden',
    eigenaar_bekend: true,
    eigenaarbron: 'kadaster',
    eigenaar_type: null,
    eigenaar_naam: null,
    eigenaar_bedrijfsnaam: null,
    eigenaar_kvk: null,
    eigenaar_straat_huisnummer: null,
    eigenaar_postcode: null,
    eigenaar_plaats: null,
    eigenaar_verzendadres: null,
    eigenaar_rechtstype: uitkomst.rechtstype,
    eigenaar_rechtssituatie: uitkomst.rechtssituatie,
    eigenaar_aandeel: null,
    bloot_eigenaar: uitkomst.blootEigenaar,
    eigenaar_controle_nodig: uitkomst.controleNodig,
    eigenaar_controle_reden: uitkomst.controleReden,
  };
  if (['', 'nieuw_signaal', 'te_onderzoeken', 'twijfel', 'eigenaar_achterhalen'].includes(huidig.status ?? '')) {
    patch.status = 'eigenaar_gevonden';
  }
  return patch;
}

export function bouwAutomatischeEigenaarPatch(
  huidig: HuidigeEigenaarVelden,
  uitkomst: RechtenbewusteEigenaarUitkomst,
): Record<string, unknown> | null {
  if (uitkomst.status === 'meervoudig') {
    return patchMeervoudigeRechthebbenden(huidig, uitkomst);
  }

  const patch: Record<string, unknown> = {};
  if (uitkomst.status !== 'eenduidig' || uitkomst.controleNodig) {
    if (!uitkomst.controleNodig) return null;
    if (huidig.eigenaar_controle_nodig !== true) patch.eigenaar_controle_nodig = true;
    if (schoon(huidig.eigenaar_controle_reden) !== schoon(uitkomst.controleReden)) {
      patch.eigenaar_controle_reden = uitkomst.controleReden;
    }
    return Object.keys(patch).length > 0 ? patch : null;
  }

  const v = uitkomst.voorstel;
  if (leeg(huidig.eigenaar_naam) && v.eigenaar_naam) patch.eigenaar_naam = v.eigenaar_naam;
  if (leeg(huidig.eigenaar_bedrijfsnaam) && v.eigenaar_bedrijfsnaam) patch.eigenaar_bedrijfsnaam = v.eigenaar_bedrijfsnaam;
  if (leeg(huidig.eigenaar_type) && v.eigenaar_type) patch.eigenaar_type = v.eigenaar_type;
  if (leeg(huidig.eigenaar_kvk) && v.eigenaar_kvk) patch.eigenaar_kvk = v.eigenaar_kvk;
  if (leeg(huidig.kadastrale_aanduiding) && v.kadastrale_aanduiding) patch.kadastrale_aanduiding = v.kadastrale_aanduiding;
  if (leeg(huidig.eigenaar_straat_huisnummer) && uitkomst.straatHuisnummer) {
    patch.eigenaar_straat_huisnummer = uitkomst.straatHuisnummer;
  }
  if (leeg(huidig.eigenaar_postcode) && uitkomst.postcode) patch.eigenaar_postcode = uitkomst.postcode;
  if (leeg(huidig.eigenaar_plaats) && uitkomst.plaats) patch.eigenaar_plaats = uitkomst.plaats;
  if (leeg(huidig.eigenaar_verzendadres) && uitkomst.verzendadres) patch.eigenaar_verzendadres = uitkomst.verzendadres;
  if (leeg(huidig.eigenaar_rechtstype) && uitkomst.rechtstype) patch.eigenaar_rechtstype = uitkomst.rechtstype;
  if (leeg(huidig.eigenaar_rechtssituatie) && uitkomst.rechtssituatie !== 'onbekend') {
    patch.eigenaar_rechtssituatie = uitkomst.rechtssituatie;
  }
  if (leeg(huidig.eigenaar_aandeel) && uitkomst.aandeel) patch.eigenaar_aandeel = uitkomst.aandeel;
  if (!huidig.bloot_eigenaar && uitkomst.blootEigenaar) patch.bloot_eigenaar = uitkomst.blootEigenaar;
  if (leeg(huidig.eigenaarbron) && v.eigenaarbron) patch.eigenaarbron = v.eigenaarbron;

  const krijgtEigenaar = !!(
    !leeg(huidig.eigenaar_naam) || !leeg(huidig.eigenaar_bedrijfsnaam)
    || patch.eigenaar_naam || patch.eigenaar_bedrijfsnaam
  );
  if (krijgtEigenaar && huidig.eigenaarstatus !== 'gevonden' && huidig.eigenaarstatus !== 'benaderd') {
    patch.eigenaarstatus = 'gevonden';
  }
  if (krijgtEigenaar && huidig.eigenaar_bekend !== true) patch.eigenaar_bekend = true;
  if (huidig.eigenaar_controle_nodig === true) {
    patch.eigenaar_controle_nodig = false;
    patch.eigenaar_controle_reden = null;
  }
  if (['', 'nieuw_signaal', 'te_onderzoeken', 'twijfel', 'eigenaar_achterhalen'].includes(huidig.status ?? '')) {
    patch.status = 'eigenaar_gevonden';
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export type EigenaarProcesStatus = 'gevonden' | 'controleren' | 'ontbreekt';
export const EIGENAAR_PROCES_LABEL: Record<EigenaarProcesStatus, string> = {
  gevonden: 'Eigenaar gevonden',
  controleren: 'Eigenaar controleren',
  ontbreekt: 'Eigenaar ontbreekt',
};

export function bepaalEigenaarProcesStatus(signaal: HuidigeEigenaarVelden): EigenaarProcesStatus {
  if (signaal.eigenaar_controle_nodig === true) return 'controleren';
  if (signaal.eigenaar_bekend === true && signaal.eigenaarstatus === 'gevonden') return 'gevonden';
  const heeftNaam = !leeg(signaal.eigenaar_naam) || !leeg(signaal.eigenaar_bedrijfsnaam);
  return heeftNaam ? 'gevonden' : 'ontbreekt';
}

export function toonErfpachtChip(signaal: HuidigeEigenaarVelden): boolean {
  return schoon(signaal.eigenaar_rechtssituatie) === 'erfpacht';
}
