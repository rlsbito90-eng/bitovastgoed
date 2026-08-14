import type { Responsstatus } from '@/lib/offMarket/brieven/respons';
import type { VastgoedkansStatus } from '@/lib/vastgoedkansen';

export interface VastgoedkansReactieVervolgadvies {
  status: VastgoedkansStatus;
  werkbakLabel: string;
  actie: string;
  datumVereist: boolean;
  toelichting: string;
}

const ADVIES: Record<Responsstatus, VastgoedkansReactieVervolgadvies> = {
  interesse: {
    status: 'positieve_reactie',
    werkbakLabel: 'Positieve reactie',
    actie: 'Neem persoonlijk contact op en kwalificeer de verkoopbereidheid',
    datumVereist: false,
    toelichting: 'Interesse is een commercieel signaal, maar maakt nog geen deal of CRM-relatie aan.',
  },
  wil_meer_informatie: {
    status: 'positieve_reactie',
    werkbakLabel: 'Positieve reactie',
    actie: 'Stuur de gevraagde informatie en plan het vervolgcontact',
    datumVereist: false,
    toelichting: 'De eigenaar vraagt om vervolg; de Vastgoedkans blijft actief.',
  },
  gesprek_gepland: {
    status: 'positieve_reactie',
    werkbakLabel: 'Positieve reactie',
    actie: 'Voer het geplande gesprek en leg de uitkomst vast',
    datumVereist: true,
    toelichting: 'Leg de gespreksdatum bewust vast; de respons zelf bepaalt die datum niet.',
  },
  later_opnieuw_benaderen: {
    status: 'wachten',
    werkbakLabel: 'Wachten',
    actie: 'Neem op de afgesproken datum opnieuw contact op',
    datumVereist: true,
    toelichting: 'Zonder concrete datum hoort deze reactie nog niet automatisch in Wachten.',
  },
  niet_geinteresseerd: {
    status: 'afgevallen',
    werkbakLabel: 'Afgevallen',
    actie: 'Sluit deze acquisitieroute af of leg bewust een andere aanleiding vast',
    datumVereist: false,
    toelichting: 'Afvallen is een expliciete commerciële keuze en wordt daarom nooit automatisch toegepast.',
  },
  verkocht_of_niet_relevant: {
    status: 'afgevallen',
    werkbakLabel: 'Afgevallen',
    actie: 'Sluit de Vastgoedkans af als verkocht of niet relevant',
    datumVereist: false,
    toelichting: 'De bronreactie blijft in de briefhistorie bewaard.',
  },
  afgevallen: {
    status: 'afgevallen',
    werkbakLabel: 'Afgevallen',
    actie: 'Bevestig dat deze Vastgoedkans niet verder wordt opgevolgd',
    datumVereist: false,
    toelichting: 'Deze status wordt alleen na een expliciete bevestiging toegepast.',
  },
  verkeerd_adres: {
    status: 'onderzoek',
    werkbakLabel: 'Onderzoek',
    actie: 'Controleer de rechthebbende en het correspondentieadres',
    datumVereist: false,
    toelichting: 'Een fout adres zegt niets over verkoopbereidheid; de kans valt daarom niet af.',
  },
  retour_post: {
    status: 'onderzoek',
    werkbakLabel: 'Onderzoek',
    actie: 'Onderzoek een actueel correspondentieadres voordat je opnieuw benadert',
    datumVereist: false,
    toelichting: 'Retourpost is een datakwaliteitsprobleem, geen negatieve commerciële reactie.',
  },
  reactie_ontvangen: {
    status: 'opvolgen',
    werkbakLabel: 'Opvolgen',
    actie: 'Beoordeel de inhoud van de reactie en bepaal de concrete vervolgstap',
    datumVereist: false,
    toelichting: 'De reactie is nog niet inhoudelijk geclassificeerd.',
  },
  geen_reactie: {
    status: 'opvolgen',
    werkbakLabel: 'Opvolgen',
    actie: 'Voer de geplande opvolging uit',
    datumVereist: false,
    toelichting: 'Geen reactie sluit de Vastgoedkans niet af.',
  },
};

export function bepaalVastgoedkansReactieVervolgadvies(
  responsstatus: Responsstatus | null | undefined,
): VastgoedkansReactieVervolgadvies | null {
  return responsstatus ? ADVIES[responsstatus] ?? null : null;
}
