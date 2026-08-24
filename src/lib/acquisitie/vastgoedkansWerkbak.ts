import type { Vastgoedkans } from '@/lib/vastgoedkansen';
import type {
  ActieSubfilter,
  WerkbakContext,
  WerkbakView,
} from '@/lib/offMarket/acquisitie/werkbak';
import type { PrintPostFilter } from '@/lib/offMarket/acquisitie/printPostFilter';
import type { SorteerbareRij } from '@/lib/offMarket/acquisitie/sortering';

export type AcquisitieBronFilter = 'alles' | 'radar' | 'pandenverkenner';

function datumLabel(iso: string | null | undefined, prefix: string): WerkbakContext['procesDatum'] {
  if (!iso) return { iso: null, label: prefix, a11yLabel: prefix };
  const dag = iso.slice(0, 10);
  return { iso: dag, label: `${prefix} ${dag}`, a11yLabel: `${prefix} ${dag}` };
}

function vandaagIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Vertaalt een Vastgoedkans naar dezelfde operationele werkbaktaal als Radar.
 * Kadaster/eigenaar is hier bewust niet verplicht: algemene eigenaarspost naar
 * een volledig objectadres is een geldige Pandenverkenner-route.
 */
export function bepaalVastgoedkansWerkbakContext(kans: Vastgoedkans): WerkbakContext {
  if (kans.archivedAt || kans.status === 'afgevallen' || kans.status === 'gepromoveerd') {
    return {
      werkbak: 'afgehandeld',
      actieCategorie: null,
      actieSubfilter: null,
      procesDatum: datumLabel(kans.archivedAt ?? kans.updatedAt, 'Afgehandeld'),
    };
  }

  if (kans.status === 'wachten') {
    return {
      werkbak: 'wachten',
      actieCategorie: null,
      actieSubfilter: null,
      procesDatum: datumLabel(kans.volgendeActieDatum ?? kans.opvolgdatum, 'Wachten tot'),
    };
  }

  const opvolgdatum = (kans.volgendeActieDatum ?? kans.opvolgdatum)?.slice(0, 10) ?? null;
  const reactieActief = kans.reactieStatus !== 'geen_reactie' || kans.status === 'positieve_reactie';
  const isVerzonden = kans.briefStatus === 'verzonden' || kans.briefStatus === 'reactie_ontvangen';
  if (kans.status === 'opvolgen' || reactieActief || isVerzonden) {
    const vandaag = vandaagIso();
    const categorie = opvolgdatum
      ? opvolgdatum < vandaag
        ? 'opvolging_verlopen'
        : opvolgdatum === vandaag
          ? 'opvolging_vandaag'
          : 'opvolging_plannen'
      : 'opvolging_plannen';
    if (opvolgdatum && opvolgdatum > vandaag && !reactieActief) {
      return {
        werkbak: 'wachten',
        actieCategorie: null,
        actieSubfilter: null,
        procesDatum: datumLabel(opvolgdatum, 'Wachten tot'),
      };
    }
    return {
      werkbak: 'actie',
      actieCategorie: categorie,
      actieSubfilter: 'opvolgen',
      procesDatum: datumLabel(opvolgdatum ?? kans.briefVerzondenOp, 'Opvolgen'),
    };
  }

  if (kans.briefStatus === 'klaar') {
    return {
      werkbak: 'actie',
      actieCategorie: 'gereed_voor_print',
      actieSubfilter: 'printen_posten',
      procesDatum: datumLabel(kans.updatedAt, 'Klaar voor print'),
    };
  }

  if (kans.status === 'brief_voorbereiden' || kans.briefStatus === 'voorbereiden') {
    return {
      werkbak: 'actie',
      actieCategorie: kans.briefStatus === 'voorbereiden' ? 'concept_controleren' : 'brief_voorbereiden',
      actieSubfilter: 'brief_voorbereiden',
      procesDatum: datumLabel(kans.updatedAt, kans.briefStatus === 'voorbereiden' ? 'Concept controleren' : 'Brief voorbereiden'),
    };
  }

  return {
    werkbak: 'actie',
    actieCategorie: 'onderzoek',
    actieSubfilter: 'onderzoeken',
    procesDatum: datumLabel(kans.updatedAt, kans.status === 'onderzoek' ? 'Onderzoek' : 'Te beoordelen'),
  };
}

export function vastgoedkansPastInView(
  ctx: WerkbakContext,
  werkbak: WerkbakView,
  subfilter: ActieSubfilter,
  printPost: PrintPostFilter,
): boolean {
  if (werkbak !== 'alles' && ctx.werkbak !== werkbak) return false;
  if (werkbak !== 'actie') return true;
  if (subfilter !== 'alle' && ctx.actieSubfilter !== subfilter) return false;
  if (subfilter !== 'printen_posten' || printPost === 'alles') return true;
  if (printPost === 'te_printen') return ctx.actieCategorie === 'gereed_voor_print' || ctx.actieCategorie === 'concept_controleren';
  return ctx.actieCategorie === 'geprint_nog_posten';
}

export function vastgoedkansZoektekst(kans: Vastgoedkans): string {
  return [
    kans.kansnummer,
    kans.adres,
    kans.postcode,
    kans.plaats,
    kans.typeVastgoed,
    kans.korteOmschrijving,
    kans.eigenaarNaam,
    kans.briefGeadresseerde,
    kans.briefKenmerk,
    'Pandenverkenner',
    'Vastgoedkansen',
  ].filter(Boolean).join(' ');
}

function prioriteitVoorSortering(prioriteit: number): string {
  if (prioriteit <= 1) return 'urgent';
  if (prioriteit === 2) return 'hoog';
  if (prioriteit === 3) return 'midden';
  return 'laag';
}

export function vastgoedkansNaarSorteerbareRij(
  kans: Vastgoedkans,
  toegevoegdOp: string | null,
  ctx: WerkbakContext,
): SorteerbareRij {
  return {
    signaalId: `vastgoedkans:${kans.id}`,
    toegevoegdOp,
    ctx,
    procesDatumIsoWachten: ctx.werkbak === 'wachten' ? (ctx.procesDatum?.iso ?? null) : null,
    prioriteit: prioriteitVoorSortering(kans.prioriteit),
    aiScore: typeof kans.algoritmeScore === 'number' ? kans.algoritmeScore : null,
    plaats: kans.plaats,
  };
}
