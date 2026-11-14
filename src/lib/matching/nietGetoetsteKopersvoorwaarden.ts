import type { Relatie, Zoekprofiel } from '@/data/mock-data';
import type { ProfielRoute } from './rolMandaatAdapter';

/**
 * Eén centrale, read-only inventarisatie van al geregistreerde kopersvoorwaarden
 * die de huidige R2-matchberekening niet aantoonbaar uitvoert.
 *
 * Dit is geen tekstinterpretatie en stelt de hardheid niet automatisch vast.
 * Het bestaande matchpercentage, de route, pipeline en objectdata blijven intact.
 */
export interface NietGetoetsteVoorwaarde {
  sleutel: string;
  label: string;
  toelichting: string;
  bron: 'relatie' | 'zoekprofiel';
}

export type RelatieVoorwaarden = Pick<Relatie,
  'uitsluitingen' | 'aankoopcriteria' | 'gewensteObjectomvang' | 'gewensteSituatie'
  | 'rendementseis' | 'rendementsdoelToelichting' | 'budgetVoorkeurToelichting'
  | 'zoekgebiedToelichting' | 'overigeToelichting'>;
export type ProfielVoorwaarden = Pick<Zoekprofiel,
  'id' | 'aanvullendeCriteria' | 'oppervlakteMin' | 'oppervlakteMax'
  | 'bouwjaarMin' | 'bouwjaarMax' | 'energielabelMin' | 'verhuurStatus'
  | 'rendementseis' | 'waltMin' | 'leegstandMaxPct' | 'ontwikkelPotentie'
  | 'transformatiePotentie' | 'transactietypeVoorkeur' | 'exclusiviteitVoorkeur'>;
export type RouteVoorwaarden = Pick<ProfielRoute, 'bron' | 'zoekprofielId'>;

const tekst = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const s=value.trim();
  return s.length ? s : null;
};
const nummer = (v: number | null | undefined): string | null =>
  typeof v === 'number' && Number.isFinite(v) ? String(v) : null;

export function inventariseerNietGetoetsteKopersvoorwaarden(
  relatie: RelatieVoorwaarden,
  route: RouteVoorwaarden,
  zoekprofielen: readonly ProfielVoorwaarden[],
): NietGetoetsteVoorwaarde[] {
  const items: NietGetoetsteVoorwaarde[]=[];
  const voegToe = (
    bron: NietGetoetsteVoorwaarde['bron'], sleutel: string,
    label: string, waarde: string | null | undefined,
  ) => {
    const s=tekst(waarde);
    if (s) items.push({bron,sleutel,label,toelichting:s});
  };

  // Uitsluitingen en uitgeschreven aankoopcriteria kunnen op relatieniveau
  // voor meerdere zoekrichtingen relevant zijn. Zonder aanvullende confirmatie
  // nooit als bewezen harde eis interpreteren of wegfilteren.
  voegToe('relatie','uitsluitingen','Uitsluitingen',relatie.uitsluitingen);
  voegToe('relatie','aankoopcriteria','Overige aankoopcriteria',relatie.aankoopcriteria);

  if (route.bron==='relatie_basis') {
    voegToe('relatie','gewensteObjectomvang','Gewenste objectomvang',relatie.gewensteObjectomvang);
    if (relatie.gewensteSituatie?.some(s=>tekst(s))) {
      voegToe('relatie','gewensteSituatie','Gewenste situatie',relatie.gewensteSituatie.filter(Boolean).join(', '));
    }
    voegToe('relatie','rendementseis','Rendementsdoel',nummer(relatie.rendementseis)!=null
      ? nummer(relatie.rendementseis)+'%' : null);
    voegToe('relatie','rendementsdoelToelichting','Rendementstoelichting',relatie.rendementsdoelToelichting);
    voegToe('relatie','budgetVoorkeurToelichting','Aanvullende budgetvoorwaarden',relatie.budgetVoorkeurToelichting);
    voegToe('relatie','zoekgebiedToelichting','Aanvullende locatievoorwaarden',relatie.zoekgebiedToelichting);
    voegToe('relatie','overigeToelichting','Overige voorkeuren',relatie.overigeToelichting);
    return items;
  }

  const profiel=zoekprofielen.find(p=>p.id===route.zoekprofielId);
  if (!profiel) {
    voegToe('zoekprofiel','ontbrekend','Aanvullend zoekprofiel','Bijbehorend zoekprofiel is niet beschikbaar; controleer de route.');
    return items;
  }

  voegToe('zoekprofiel','aanvullendeCriteria','Bijzondere kopersvoorwaarden',profiel.aanvullendeCriteria);
  const bereik=(min:number|undefined,max:number|undefined,eenheid:string)=>{
    const van=nummer(min),tot=nummer(max);
    return van!==null||tot!==null
      ? [van===null?'':`vanaf ${van}`,tot===null?'':`tot ${tot}`].filter(Boolean).join(' ') + ' '+eenheid
      : null;
  };
  voegToe('zoekprofiel','oppervlakte','Oppervlakte-eis',
    bereik(profiel.oppervlakteMin,profiel.oppervlakteMax,'m² (meetbasis nog vaststellen)'));
  voegToe('zoekprofiel','bouwjaar','Bouwjaar',
    bereik(profiel.bouwjaarMin,profiel.bouwjaarMax,''));
  voegToe('zoekprofiel','energielabel','Energielabel',profiel.energielabelMin??null);
  voegToe('zoekprofiel','verhuurStatus','Verhuursituatie',profiel.verhuurStatus??null);
  voegToe('zoekprofiel','rendement','Rendementseis',
    nummer(profiel.rendementseis)!=null?nummer(profiel.rendementseis)+'%':null);
  voegToe('zoekprofiel','walt','Minimale WALT',
    nummer(profiel.waltMin)!=null?nummer(profiel.waltMin)+' jaar':null);
  voegToe('zoekprofiel','leegstand','Maximale leegstand',
    nummer(profiel.leegstandMaxPct)!=null?nummer(profiel.leegstandMaxPct)+'%':null);
  if (profiel.ontwikkelPotentie) voegToe('zoekprofiel','ontwikkel','Ontwikkelpotentie','Gewenst');
  if (profiel.transformatiePotentie) voegToe('zoekprofiel','transformatie','Transformatiepotentie','Gewenst');
  if (profiel.transactietypeVoorkeur?.length)
    voegToe('zoekprofiel','transactietype','Transactievoorkeuren',profiel.transactietypeVoorkeur.join(', '));
  if (profiel.exclusiviteitVoorkeur && profiel.exclusiviteitVoorkeur!=='beide')
    voegToe('zoekprofiel','exclusiviteit','Exclusiviteitsvoorkeur',profiel.exclusiviteitVoorkeur);
  return items;
}
