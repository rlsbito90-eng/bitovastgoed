/** Nauwkeurige semantiek: ontbrekende informatie is nooit een bevestigde risicovoorkeur. */
export const RISICO_CATEGORIEEN = [
  {waarde:'leegstand',label:'Leegstand',uitleg:'(Tijdelijk) onverhuurd vastgoed'},
  {waarde:'renovatie',label:'Renovatie',uitleg:'Achterstallig onderhoud of een opknapopgave'},
  {waarde:'huurachterstand',label:'Huurachterstand',uitleg:'Achterstanden of een problematische huursituatie'},
  {waarde:'vergunning',label:'Vergunningstraject',uitleg:'Onzekerheid over een benodigde vergunning'},
  {waarde:'transformatie',label:'Transformatie',uitleg:'Wijzigen van gebruik of indeling'},
  {waarde:'korte_huur',label:'Korte huurlooptijd',uitleg:'Huurcontract met beperkte resterende looptijd'},
  {waarde:'verduurzaming',label:'Verduurzaming',uitleg:'Investeringen in energieprestatie en labels'},
] as const;

export type Risicotype = typeof RISICO_CATEGORIEEN[number]['waarde'];
export type Risicobereidheid = 'accepteert'|'onder_voorwaarden'|'sluit_uit';
export const RISICO_BEREIDHEID:Record<Risicobereidheid,string> = {
  accepteert:'Accepteert',
  onder_voorwaarden:'Onder voorwaarden',
  sluit_uit:'Sluit uit',
};
export type Risicovoorkeur = {
  id:string;
  relatieId:string;
  risicotype:Risicotype;
  bereidheid:Risicobereidheid;
  bevestigd:boolean;
  bron:string|null;
  bronDatum:string|null;
  toelichting:string|null;
  updatedAt:string|null;
};

/**
 * Alleen een expliciete, bevestigde uitsluiting EN een geverifieerde objectfeit
 * kunnen ooit een automatische knock-out rechtvaardigen. De huidige CRM-matcher
 * gebruikt deze voorkeuren nog niet als automatische afwijzing.
 */
export function isBevestigdeRisicoUitsluiting(
  voorkeur:Pick<Risicovoorkeur,'bereidheid'|'bevestigd'>|null|undefined,
  objectRisicoGeverifieerd:boolean
):boolean{
  return !!voorkeur && voorkeur.bereidheid==='sluit_uit' &&
    voorkeur.bevestigd && objectRisicoGeverifieerd;
}

export function valideerRisicoInvoer(
  type:Risicotype,bereidheid:Risicobereidheid,bevestigd:boolean,bron:string|null
):string|null {
  if(!RISICO_CATEGORIEEN.some(x=>x.waarde===type))return 'Onbekend risicotype';
  if(!Object.hasOwn(RISICO_BEREIDHEID,bereidheid))return 'Ongeldige bereidheid';
  if(bevestigd && !bron?.trim())return 'Vermeld het gesprek of de bron voordat je iets bevestigt';
  return null;
}
