import { buildBriefViewModel, type BriefViewModel } from '@/lib/offMarket/brief';

import type { BriefRenderInvoer } from './briefRenderInvoer';

/**
 * Verbindt de immutable productiekern-renderpayload met de bestaande,
 * productiebewezen briefopmaak. Deze adapter doet uitsluitend mapping:
 * geen database-read, Storage-write, statuswijziging of auditmutatie.
 */
export function mapProductiekernBriefNaarViewModel(
  invoer: BriefRenderInvoer,
): BriefViewModel {
  const geadresseerde = invoer.bedrijfsnaam?.trim()
    || invoer.naam?.trim()
    || '';
  const verzendadres = [
    geadresseerde,
    invoer.straatHuisnummer.trim(),
    `${invoer.postcode.trim()} ${invoer.plaats.trim()}`.trim(),
    invoer.land.trim() && invoer.land.trim().toLowerCase() !== 'nederland'
      ? invoer.land.trim()
      : '',
  ].filter(Boolean).join('\n');

  return buildBriefViewModel({
    eigenaarNaam: invoer.naam ?? '',
    eigenaarBedrijfsnaam: invoer.bedrijfsnaam ?? '',
    verzendadres,
    objectomschrijving: invoer.objectomschrijving ?? invoer.objectadres ?? '',
    onderwerp: invoer.onderwerp ?? '',
    brieftekst: invoer.brieftekst,
  });
}

export interface ProductiekernBriefRenderItem {
  key: string;
  briefnummer: string;
  briefVersieId: string;
  viewModel: BriefViewModel;
}

/**
 * Bouwt een deterministische lijst voor de bestaande gecombineerde PDF.
 * De volgorde van de aangeleverde renderpayloads blijft exact behouden.
 */
export function bouwProductiekernBriefRenderItems(
  invoer: readonly BriefRenderInvoer[],
): ProductiekernBriefRenderItem[] {
  const gezien = new Set<string>();

  return invoer.map((brief) => {
    if (gezien.has(brief.briefVersieId)) {
      throw new Error(`Briefversie dubbel in renderbatch: ${brief.briefVersieId}.`);
    }
    gezien.add(brief.briefVersieId);

    return Object.freeze({
      key: brief.briefVersieId,
      briefnummer: brief.briefnummer,
      briefVersieId: brief.briefVersieId,
      viewModel: mapProductiekernBriefNaarViewModel(brief),
    });
  });
}
