import type { ObjectVastgoed, Zoekprofiel } from '@/data/mock-data';
import type { ProfielRoute } from './rolMandaatAdapter';

/**
 * Read-only vergelijking tussen bestaande gestructureerde zoekprofielvelden
 * en hetzelfde fysieke object. Dit stelt GEEN harde eis vast, verandert
 * GEEN R2-kwalificatie, matchscore, aanbieding of pipeline en schrijft niets.
 * Alle positieve/negatieve conclusies zijn uitsluitend 'volgens registratie'.
 */
export interface VergelijkingProfielkenmerk {
  sleutel: 'bouwjaar' | 'energielabel' | 'verhuurStatus' | 'leegstand';
  label: string;
  uitkomst: 'overeenkomst' | 'afwijking' | 'controle_nodig';
  reden: string;
}

type ProfielBron = Pick<Zoekprofiel, 'id' | 'bouwjaarMin' | 'bouwjaarMax' |
  'energielabelMin' | 'verhuurStatus' | 'leegstandMaxPct'>;
type ObjectBron = Pick<ObjectVastgoed, 'isPortefeuille' | 'bouwjaar' |
  'energielabelV2' | 'energielabel' | 'verhuurStatus' | 'leegstandPct'>;
type RouteBron = Pick<ProfielRoute, 'bron' | 'zoekprofielId'>;

const labelVolgorde = ['A++++', 'A+++', 'A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;
const verhuurLabel: Record<'verhuurd' | 'leeg' | 'gedeeltelijk', string> = {
  verhuurd: 'Verhuurd', leeg: 'Leeg', gedeeltelijk: 'Gedeeltelijk verhuurd',
};
const geldigGetal = (n: number | null | undefined): n is number =>
  typeof n === 'number' && Number.isFinite(n);

export function vergelijkBestaandeProfielkenmerken(
  object: ObjectBron,
  route: RouteBron,
  profielen: readonly ProfielBron[],
): VergelijkingProfielkenmerk[] {
  if (route.bron !== 'zoekprofiel' || !route.zoekprofielId) return [];
  const profiel = profielen.find(p => p.id === route.zoekprofielId);
  if (!profiel) return [];

  const regels: VergelijkingProfielkenmerk[] = [];
  const voegToe = (sleutel: VergelijkingProfielkenmerk['sleutel'],
    label: string, uitkomst: VergelijkingProfielkenmerk['uitkomst'], reden: string) =>
    regels.push({ sleutel, label, uitkomst, reden });

  // Eén objectveld vertegenwoordigt niet automatisch alle panden in een pakket.
  const pakket = object.isPortefeuille;

  if (profiel.bouwjaarMin != null || profiel.bouwjaarMax != null) {
    const min = profiel.bouwjaarMin;
    const max = profiel.bouwjaarMax;
    const jaar = object.bouwjaar;
    if (pakket) {
      voegToe('bouwjaar', 'Bouwjaar', 'controle_nodig',
        'Portefeuille: bouwjaar per afzonderlijk pand beoordelen.');
    } else if (!geldigGetal(jaar) || !Number.isInteger(jaar) || jaar <= 0) {
      voegToe('bouwjaar', 'Bouwjaar', 'controle_nodig', 'Bouwjaar object ontbreekt.');
    } else if ((min != null && jaar < min) || (max != null && jaar > max)) {
      voegToe('bouwjaar', 'Bouwjaar', 'afwijking',
        `Geregistreerd bouwjaar ${jaar} valt buiten het opgegeven bereik.`);
    } else {
      voegToe('bouwjaar', 'Bouwjaar', 'overeenkomst',
        `Geregistreerd bouwjaar ${jaar} valt binnen het opgegeven bereik.`);
    }
  }

  if (profiel.energielabelMin && profiel.energielabelMin !== 'onbekend') {
    const minimaal = labelVolgorde.indexOf(profiel.energielabelMin as typeof labelVolgorde[number]);
    const v2 = object.energielabelV2 && object.energielabelV2 !== 'onbekend'
      ? object.energielabelV2 : null;
    const label = v2 ?? object.energielabel?.trim() ?? '';
    const werkelijk = labelVolgorde.indexOf(label as typeof labelVolgorde[number]);
    if (pakket) {
      voegToe('energielabel', 'Energielabel', 'controle_nodig',
        'Portefeuille: energielabel per pand of verblijfsobject controleren.');
    } else if (minimaal < 0 || werkelijk < 0) {
      voegToe('energielabel', 'Energielabel', 'controle_nodig',
        'Geen vergelijkbaar energielabel in het objectdossier.');
    } else {
      const bron = v2 ? 'energielabelveld' : 'oud energielabelveld';
      const uitkomst = werkelijk <= minimaal ? 'overeenkomst' : 'afwijking';
      voegToe('energielabel', 'Energielabel', uitkomst,
        `Geregistreerd ${label} (${bron}); gevraagd minimaal ${profiel.energielabelMin}. Geldigheid nog niet geverifieerd.`);
    }
  }

  if (profiel.verhuurStatus) {
    const waarde = object.verhuurStatus;
    if (pakket) {
      voegToe('verhuurStatus', 'Verhuursituatie', 'controle_nodig',
        'Portefeuille: verhuurstatus van alle relevante onderdelen controleren.');
    } else if (!(waarde in verhuurLabel)) {
      voegToe('verhuurStatus', 'Verhuursituatie', 'controle_nodig',
        'Verhuursituatie object ontbreekt of is onbekend.');
    } else {
      const akkoord = waarde === profiel.verhuurStatus;
      voegToe('verhuurStatus', 'Verhuursituatie', akkoord ? 'overeenkomst' : 'afwijking',
        `Geregistreerd: ${verhuurLabel[waarde]}; gewenst: ${verhuurLabel[profiel.verhuurStatus]}.`);
    }
  }

  if (profiel.leegstandMaxPct != null) {
    const leegstand = object.leegstandPct;
    if (pakket) {
      voegToe('leegstand', 'Leegstand', 'controle_nodig',
        'Portefeuille: leegstandspercentage op dezelfde scope controleren.');
    } else if (!geldigGetal(leegstand) || leegstand < 0 || leegstand > 100) {
      voegToe('leegstand', 'Leegstand', 'controle_nodig',
        'Geen bruikbaar leegstandspercentage in het objectdossier.');
    } else {
      const akkoord = leegstand <= profiel.leegstandMaxPct;
      voegToe('leegstand', 'Leegstand', akkoord ? 'overeenkomst' : 'afwijking',
        `Geregistreerd ${leegstand}%; gewenst maximaal ${profiel.leegstandMaxPct}%. Registratie nog niet onafhankelijk geverifieerd.`);
    }
  }

  return regels;
}
