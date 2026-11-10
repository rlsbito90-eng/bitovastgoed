import type { PartijType, Partijprofiel } from '@/data/mock-data';

/** Alleen expliciete functietitels of een ondubbelzinnige bedrijfsomschrijving.
 * Een beleggerprofiel bewijst geen actieve koopintentie of concrete criteria.
 */
export interface HerkendLinkedInPartijtype {
  type:Extract<PartijType,'makelaar'|'ontwikkelaar'|'belegger'>;
  partijprofiel:Extract<Partijprofiel,'makelaar'|'ontwikkelaar'|'belegger'>;
  bron:'functie'|'bedrijfsomschrijving';
}
const rolVanFunctie=(functie:string)=>{
  const text=functie.trim().toLocaleLowerCase('nl-NL');
  const categorieen=[
    {type:'makelaar',match:/(makelaar|makelaardij|real estate broker|real estate agent|property broker)/i.test(text)},
    {type:'ontwikkelaar',match:/(projectontwikkelaar|vastgoedontwikkelaar|gebiedsontwikkelaar|property developer|real estate developer|eigenaar-ontwikkelaar|vastgoed- en gebiedsontwikkelaar)/i.test(text)},
    {type:'belegger',match:/(vastgoedbelegger|vastgoedinvesteerder|vastgoed investeerder|real estate investor|property investor|uk property investor)/i.test(text)},
  ] as const;
  const gevonden=categorieen.filter(x=>x.match);
  return gevonden.length===1?gevonden[0].type:null;
};

export function herkenLinkedInPartijtype(functie:string,bedrijf:string):HerkendLinkedInPartijtype|null{
  const uitFunctie=rolVanFunctie(functie);
  if(uitFunctie)return{type:uitFunctie,partijprofiel:uitFunctie,bron:'functie'};
  // Bij een hybride functietitel niet via een bedrijfsnaam één rol gokken.
  const titel=functie.toLowerCase();
  const rolMatches=[
    /(makelaar|makelaardij|real estate broker|real estate agent|property broker)/.test(titel),
    /(projectontwikkelaar|vastgoedontwikkelaar|gebiedsontwikkelaar|property developer|real estate developer|eigenaar-ontwikkelaar|vastgoed- en gebiedsontwikkelaar)/.test(titel),
    /(vastgoedbelegger|vastgoedinvesteerder|vastgoed investeerder|real estate investor|property investor|uk property investor)/.test(titel),
  ].filter(Boolean).length;
  if(rolMatches>1)return null;

  const bedrijfLower=bedrijf.trim().toLowerCase();
  const makelaar=/(makelaar|makelaardij)/i.test(bedrijfLower)&&!/voorheen/.test(bedrijfLower);
  const ontwikkelaar=/(projectontwikkeling|vastgoedontwikkeling|real estate development)/i.test(bedrijfLower);
  if(makelaar===ontwikkelaar)return null;
  const type=makelaar?'makelaar':'ontwikkelaar';
  return {type,partijprofiel:type,bron:'bedrijfsomschrijving'};
}
