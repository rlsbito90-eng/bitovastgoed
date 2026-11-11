/**
 * Bito CRM — één registratie van werkelijk gedeeld aanbod, toegankelijk
 * vanuit een object of een relatie. Er wordt nooit een bericht verstuurd.
 *
 * Opslag gebruikt uitsluitend de bestaande object_pipeline en contact_moments.
 * Pipeline eerst: als de tijdlijn faalt, blijft de bewezen aanbieding
 * op de kandidaat zichtbaar; de tijdlijn kan daarna opnieuw worden gelogd.
 */
import type { PipelineKandidaat } from '@/data/mock-data';
import type { ContactMoment } from '@/lib/contactMoments';

export const AANBIED_KANALEN = {
  email: 'E-mail',
  whatsapp: 'WhatsApp',
  telefoon: 'Telefoon',
  linkedin: 'LinkedIn',
  persoonlijk: 'Persoonlijk',
  anders: 'Anders',
} as const;
export type AanbiedKanaal = keyof typeof AANBIED_KANALEN;
export type AanbiedSoort = 'teaser' | 'informatie';

export type AanbiedingInvoer = {
  objectId: string;
  relatieId: string;
  objectTitel: string;
  soort: AanbiedSoort;
  kanaal: AanbiedKanaal;
  datum: string;
  notitie?: string;
};

type NieuwKandidaat = Omit<PipelineKandidaat, 'id' | 'createdAt' | 'updatedAt'>;
type NieuwMoment = Omit<ContactMoment, 'id' | 'createdAt' | 'updatedAt' | 'isSystem'>;

export interface AanbiedingOpslag {
  bestaandeKandidaat?: PipelineKandidaat;
  bestaandeMomenten: readonly ContactMoment[];
  voegKandidaatToe: (k: NieuwKandidaat) => Promise<PipelineKandidaat | null>;
  werkKandidaatBij: (id: string, patch: Partial<PipelineKandidaat>) => Promise<void>;
  voegMomentToe: (m: NieuwMoment) => Promise<ContactMoment | null>;
}

export class GedeeltelijkeAanbiedingRegistratie extends Error {
  constructor() {
    super('De aanbieding is bij de kandidaat vastgelegd, maar het contactmoment niet. Probeer opnieuw om de tijdlijn aan te vullen.');
    this.name = 'GedeeltelijkeAanbiedingRegistratie';
  }
}

export const datumVandaagNL = (): string => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Amsterdam', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return [get('year'), get('month'), get('day')].join('-');
};

export function controleerAanbieding(invoer: AanbiedingInvoer): string | null {
  if (!invoer.objectId || !invoer.relatieId)
    return 'Kies een object en een relatie.';
  if (!invoer.objectTitel.trim()) return 'Het object heeft geen naam.';
  if (!Object.prototype.hasOwnProperty.call(AANBIED_KANALEN, invoer.kanaal))
    return 'Selecteer een geldig contactkanaal.';
  if (invoer.soort !== 'teaser' && invoer.soort !== 'informatie')
    return 'Selecteer wat je daadwerkelijk hebt gedeeld.';
  const d = invoer.datum;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) ||
      Number.isNaN(new Date(d+'T12:00:00').getTime()) ||
      new Date(d+'T12:00:00').toISOString().slice(0,10) !== d)
    return 'Vul een geldige aanbiedingsdatum in.';
  if (d > datumVandaagNL())
    return 'Een aanbieding kan pas worden geregistreerd nadat deze is verstuurd.';
  return null;
}

const momentType = (soort: AanbiedSoort): ContactMoment['type'] =>
  soort === 'teaser' ? 'teaser_verstuurd' : 'informatie_gedeeld';

export function heeftZelfdeAanbieding(
  momenten: readonly ContactMoment[], invoer: AanbiedingInvoer,
): boolean {
  return momenten.some(m => m.relatieId === invoer.relatieId &&
    m.objectId === invoer.objectId &&
    m.direction === 'uitgaand' &&
    m.type === momentType(invoer.soort) && m.momentDate === invoer.datum);
}

export function kandidaatAanbiedingPatch(
  kandidaat: PipelineKandidaat, invoer: AanbiedingInvoer,
): Partial<PipelineKandidaat> {
  const patch: Partial<PipelineKandidaat> = {};
  if (invoer.soort === 'teaser') {
    if (!kandidaat.teaserVerstuurd) patch.teaserVerstuurd = true;
    if (!kandidaat.teaserVerstuurdOp || invoer.datum < kandidaat.teaserVerstuurdOp)
      patch.teaserVerstuurdOp = invoer.datum;
    if (kandidaat.pipelineFase === 'match_gevonden') patch.pipelineFase = 'teaser_verstuurd';
  } else {
    if (!kandidaat.informatieGedeeld) patch.informatieGedeeld = true;
    if (!kandidaat.informatieGedeeldOp || invoer.datum < kandidaat.informatieGedeeldOp)
      patch.informatieGedeeldOp = invoer.datum;
    if (kandidaat.pipelineFase === 'match_gevonden' || kandidaat.pipelineFase === 'teaser_verstuurd')
      patch.pipelineFase = 'informatie_gedeeld';
  }
  if (!kandidaat.laatsteContactdatum || invoer.datum > kandidaat.laatsteContactdatum)
    patch.laatsteContactdatum = invoer.datum;
  return patch;
}

function nieuwKandidaat(invoer: AanbiedingInvoer): NieuwKandidaat {
  return {
    objectId: invoer.objectId,
    relatieId: invoer.relatieId,
    pipelineFase: invoer.soort === 'teaser' ? 'teaser_verstuurd' : 'informatie_gedeeld',
    interesseNiveau: 'lauw',
    teaserVerstuurd: invoer.soort === 'teaser',
    teaserVerstuurdOp: invoer.soort === 'teaser' ? invoer.datum : undefined,
    ndaVerstuurd: false, ndaGetekend: false,
    informatieGedeeld: invoer.soort === 'informatie',
    informatieGedeeldOp: invoer.soort === 'informatie' ? invoer.datum : undefined,
    feeAkkoord: false,
    laatsteContactdatum: invoer.datum,
  };
}

/** Verzamelt een volledige, brongetrouwe CRM-registratie. De omschrijving
 * meldt het kanaal; er vindt geen koppeling met Gmail/WhatsApp plaats.
 */
export function maakAanbiedingsMoment(invoer: AanbiedingInvoer): NieuwMoment {
  const naam = invoer.soort === 'teaser' ? 'Teaser aangeboden' : 'Propositie/informatie gedeeld';
  const toelichting = invoer.notitie?.trim();
  return {
    type: momentType(invoer.soort),
    momentDate: invoer.datum,
    title: naam+' — '+invoer.objectTitel,
    description: 'Kanaal: '+AANBIED_KANALEN[invoer.kanaal]+(toelichting?'\n'+toelichting:''),
    direction: 'uitgaand',
    relatieId: invoer.relatieId,
    objectId: invoer.objectId,
    followUpRequired: false,
  };
}

export async function registreerAanbieding(
  invoer: AanbiedingInvoer, opslag: AanbiedingOpslag,
): Promise<void> {
  const fout = controleerAanbieding(invoer);
  if (fout) throw new Error(fout);
  if (heeftZelfdeAanbieding(opslag.bestaandeMomenten, invoer))
    throw new Error('Deze aanbieding is op deze datum al als contactmoment vastgelegd.');

  if (opslag.bestaandeKandidaat) {
    const patch = kandidaatAanbiedingPatch(opslag.bestaandeKandidaat, invoer);
    if (Object.keys(patch).length > 0)
      await opslag.werkKandidaatBij(opslag.bestaandeKandidaat.id, patch);
  } else {
    const toegevoegd = await opslag.voegKandidaatToe(nieuwKandidaat(invoer));
    if (!toegevoegd)
      throw new Error('Kandidaat kon niet aan het object worden gekoppeld.');
  }

  try {
    const toegevoegd = await opslag.voegMomentToe(maakAanbiedingsMoment(invoer));
    if (!toegevoegd)
      throw new Error('Tijdlijnitem kon niet worden opgeslagen.');
  } catch {
    throw new GedeeltelijkeAanbiedingRegistratie();
  }
}
