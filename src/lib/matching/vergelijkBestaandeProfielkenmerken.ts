import type { ObjectVastgoed, Zoekprofiel } from '@/data/mock-data';
import type { ProfielRoute } from './rolMandaatAdapter';
import {
  beoordeelKoperscriteria,
  type Koperscriterium,
  type CriteriumOverzicht,
} from './criteriumMotor';

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

/**
 * Hergebruik uitsluitend gestructureerde, bestaande profielvelden. Omdat de
 * sterkte historisch NIET apart is geregistreerd, gelden deze criteria in de
 * aanvullende leesweergave als voorkeuren. Geen nieuwe invulvelden.
 */
export function maakGeregistreerdeProfielcriteria(
  route: RouteBron,
  profielen: readonly ProfielBron[],
): Koperscriterium[] {
  if (route.bron !== 'zoekprofiel' || !route.zoekprofielId) return [];
  const p = profielen.find(x => x.id === route.zoekprofielId);
  if (!p) return [];
  const regels: Koperscriterium[]=[];
  if (p.bouwjaarMin != null || p.bouwjaarMax != null) {
    regels.push({id:'bouwjaar',label:'Bouwjaar',soort:'getal',veld:'bouwjaar',
      min:p.bouwjaarMin,max:p.bouwjaarMax,sterkte:'voorkeur'});
  }
  if (p.energielabelMin && p.energielabelMin !== 'onbekend') {
    regels.push({id:'energielabel',label:'Energielabel',soort:'energielabel',
      minimaal:p.energielabelMin,sterkte:'voorkeur'});
  }
  if (p.verhuurStatus) {
    regels.push({id:'verhuurStatus',label:'Verhuursituatie',soort:'keuze',
      veld:'verhuurStatus',waarde:p.verhuurStatus,sterkte:'voorkeur'});
  }
  if (p.leegstandMaxPct != null) {
    regels.push({id:'leegstand',label:'Leegstand',soort:'getal',veld:'leegstandPct',
      max:p.leegstandMaxPct,sterkte:'voorkeur'});
  }
  return regels;
}

/** Nieuwe generieke onderlaag, zonder de bestaande R2-matching te wijzigen. */
export function toetsBestaandeProfielcriteria(
  object: ObjectBron,
  route: RouteBron,
  profielen: readonly ProfielBron[],
): CriteriumOverzicht {
  const regels=maakGeregistreerdeProfielcriteria(route,profielen);
  return beoordeelKoperscriteria(regels,{
    isPortefeuille:object.isPortefeuille,
    bouwjaar:object.bouwjaar,
    leegstandPct:object.leegstandPct,
    verhuurStatus:object.verhuurStatus,
    energielabel:object.energielabelV2 && object.energielabelV2!=='onbekend'
      ? object.energielabelV2 : object.energielabel,
  });
}

/** Compatibele read-only uitvoer voor de huidige relatie-detailpagina. */
export function vergelijkBestaandeProfielkenmerken(
  object: ObjectBron,
  route: RouteBron,
  profielen: readonly ProfielBron[],
): VergelijkingProfielkenmerk[] {
  return toetsBestaandeProfielcriteria(object,route,profielen).beoordelingen.map(x=>({
    sleutel:x.id as VergelijkingProfielkenmerk['sleutel'],
    label:x.label,
    uitkomst:x.status==='voldoet'?'overeenkomst':
      x.status==='wijkt_af'?'afwijking':'controle_nodig',
    reden:x.toelichting,
  }));
}
