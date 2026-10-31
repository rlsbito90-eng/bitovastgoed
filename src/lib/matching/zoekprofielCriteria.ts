/**
 * CRM zoekprofielen — invoerregels voor brede zoekprofielen.
 * Matchbare criteria zijn leidend; een vastgoedtype of mandaat is niet verplicht.
 * Alleen data die de huidige zoekprofielen-tabel reeds ondersteunt.
 */
export interface ZoekprofielCriteriaInput {
  typeVastgoed?: readonly string[] | null;
  propertyTypeIds?: readonly string[] | null;
  propertySubtypeIds?: readonly string[] | null;
  dealTypeIds?: readonly string[] | null;
  regio?: readonly string[] | null;
  steden?: readonly string[] | null;
  prijsMin?: number | null;
  prijsMax?: number | null;
}
type ValidatieUitkomst =
  | { ok: true }
  | { ok: false; fout: string; tab: 'basis' | 'kenmerken' };

const gevuld = (waarden?: readonly string[] | null) => Boolean(waarden?.some(x=>x.trim().length>0));

export function valideerZoekprofielCriteria(p: ZoekprofielCriteriaInput): ValidatieUitkomst {
  if (!gevuld(p.typeVastgoed) && !gevuld(p.propertyTypeIds) &&
      !gevuld(p.propertySubtypeIds) && !gevuld(p.dealTypeIds) &&
      !gevuld(p.regio) && !gevuld(p.steden) &&
      p.prijsMin == null && p.prijsMax == null) {
    return {ok:false, fout:'Vul minimaal één zoekcriterium in: type, regio, stad, budget of dealtype.', tab:'basis'};
  }
  for (const [naam, waarde] of [['Minimum',p.prijsMin], ['Maximum',p.prijsMax]] as const) {
    if (waarde != null && (!Number.isFinite(waarde) || waarde < 0)) {
      return {ok:false, fout:`${naam} budget moet een geldig bedrag van € 0 of hoger zijn.`, tab:'basis'};
    }
  }
  if (p.prijsMin != null && p.prijsMax != null && p.prijsMin > p.prijsMax) {
    return {ok:false, fout:'Minimumbudget mag niet hoger zijn dan maximumbudget.', tab:'basis'};
  }
  return {ok:true};
}
