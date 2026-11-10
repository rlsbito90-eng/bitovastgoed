/** Paginering op het gefilterde en gesorteerde geheel — zonder dat filters
 * of kandidaatnavigatie beperkt worden tot slechts één zichtbare pagina.
 */
export function berekenRelatiePagina(totaal:number,gevraagd:number,paginaGrootte=25){
  const aantal=Math.max(1,Math.ceil(Math.max(0,totaal)/paginaGrootte));
  const geldig=Number.isFinite(gevraagd)?Math.trunc(gevraagd):1;
  const pagina=Math.min(aantal,Math.max(1,geldig));
  const startIndex=(pagina-1)*paginaGrootte;
  const eindeIndex=Math.min(totaal,startIndex+paginaGrootte);
  const beginNummer=totaal===0?0:startIndex+1;
  const aantalKnoppen=Math.min(5,aantal);
  const eersteKnop=Math.max(1,Math.min(pagina-2,aantal-aantalKnoppen+1));
  const nummers=Array.from({length:aantalKnoppen},(_,i)=>eersteKnop+i);
  return {pagina,aantal,startIndex,eindeIndex,beginNummer,nummers};
}
