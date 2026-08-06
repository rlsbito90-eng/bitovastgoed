import type { BriefContract, BriefversieContract } from './productiekernContract';
import { valideerBriefcontract, valideerBriefversie } from './productiekernContract';

export interface BriefRenderInvoer {
  briefId: string;
  briefnummer: string;
  briefVersieId: string;
  versienummer: number;
  onderwerp: string | null;
  brieftekst: string;
  objectadres: string | null;
  objectomschrijving: string | null;
  aanhef: string | null;
  naam: string | null;
  bedrijfsnaam: string | null;
  straatHuisnummer: string;
  postcode: string;
  plaats: string;
  land: string;
}

/**
 * Bouwt een immutable renderpayload. De renderer krijgt uitsluitend de gekozen
 * definitieve brief en exact diens actieve versie; hij leest zelf niets bij.
 */
export function bouwBriefRenderInvoer(input: {
  brief: BriefContract;
  versie: BriefversieContract;
}): BriefRenderInvoer {
  const briefFouten = valideerBriefcontract(input.brief);
  if (briefFouten.length > 0) throw new Error(`Ongeldige brief: ${briefFouten.join(' ')}`);
  const versieFouten = valideerBriefversie(input.versie);
  if (versieFouten.length > 0) throw new Error(`Ongeldige briefversie: ${versieFouten.join(' ')}`);

  if (input.brief.status !== 'definitief') throw new Error('Alleen een definitieve brief mag worden gerenderd.');
  if (!input.brief.briefnummer) throw new Error('Definitieve brief mist een briefnummer.');
  if (input.versie.status !== 'actief') throw new Error('Alleen de actieve briefversie mag worden gerenderd.');
  if (input.versie.briefId !== input.brief.id) throw new Error('Briefversie hoort niet bij de opgegeven brief.');
  if (input.brief.actieveVersie !== input.versie.versienummer) {
    throw new Error('Briefversie is niet de actieve versie van de brief.');
  }

  return Object.freeze({
    briefId: input.brief.id,
    briefnummer: input.brief.briefnummer,
    briefVersieId: input.versie.id,
    versienummer: input.versie.versienummer,
    onderwerp: input.versie.inhoud.onderwerp,
    brieftekst: input.versie.inhoud.brieftekst,
    objectadres: input.versie.inhoud.objectadres,
    objectomschrijving: input.versie.inhoud.objectomschrijving,
    aanhef: input.versie.geadresseerde.aanhef,
    naam: input.versie.geadresseerde.naam,
    bedrijfsnaam: input.versie.geadresseerde.bedrijfsnaam,
    straatHuisnummer: input.versie.geadresseerde.straatHuisnummer,
    postcode: input.versie.geadresseerde.postcode,
    plaats: input.versie.geadresseerde.plaats,
    land: input.versie.geadresseerde.land,
  });
}
