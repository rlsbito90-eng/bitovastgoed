import type { LegacyAdresdelen, LegacyOffMarketBriefRij } from './legacyBriefCompatibiliteit';
import { mapLegacyBriefNaarProductiekern } from './legacyBriefCompatibiliteit';
import type { LegacyBriefEventRij, ProductieAuditReadmodel } from './legacyBriefEventCompatibiliteit';
import {
  legacyBriefEventNaarProductieAudit,
  sorteerProductieAuditChronologisch,
} from './legacyBriefEventCompatibiliteit';
import type {
  LegacyAcquisitieSelectieRij,
  LegacySelectieCompatibiliteitOpties,
} from './legacySelectieCompatibiliteit';
import { legacySelectieNaarProductiekern } from './legacySelectieCompatibiliteit';
import type {
  AcquisitiedossierContract,
  BriefContract,
  BriefversieContract,
} from './productiekernContract';

export interface LegacyBriefMetAdres {
  rij: LegacyOffMarketBriefRij;
  adres: LegacyAdresdelen;
}

export interface LegacyProductiedossierReadmodel {
  dossier: AcquisitiedossierContract;
  brieven: Array<{
    brief: BriefContract;
    versie: BriefversieContract;
    geadresseerdeKey: string | null;
    printdatum: string | null;
    postdatum: string | null;
    verzendstatus: string | null;
    audit: ProductieAuditReadmodel[];
    waarschuwingen: string[];
  }>;
  losgekoppeldeAudit: ProductieAuditReadmodel[];
  waarschuwingen: string[];
  bron: 'legacy_productie_export';
}

export interface BouwLegacyProductiedossierInput {
  selectie: LegacyAcquisitieSelectieRij;
  brieven: LegacyBriefMetAdres[];
  events: LegacyBriefEventRij[];
  selectieOpties?: LegacySelectieCompatibiliteitOpties;
}

/**
 * Combineert de drie via productie-export bevestigde legacybronnen tot één
 * read-only productiedossier. Het model schrijft niets terug, reserveert geen
 * nummers en vult ontbrekende koppelingen niet via heuristiek in.
 */
export function bouwLegacyProductiedossierReadmodel(
  input: BouwLegacyProductiedossierInput,
): LegacyProductiedossierReadmodel {
  const selectie = legacySelectieNaarProductiekern(
    input.selectie,
    input.selectieOpties,
  );

  const dossierWaarschuwingen = [...selectie.waarschuwingen];
  const events = input.events
    .filter(event => event.signaal_id === input.selectie.signaal_id)
    .map(legacyBriefEventNaarProductieAudit);

  const eventsPerBrief = new Map<string, ProductieAuditReadmodel[]>();
  const losgekoppeldeAudit: ProductieAuditReadmodel[] = [];

  for (const event of events) {
    if (!event.briefId) {
      losgekoppeldeAudit.push(event);
      continue;
    }
    const lijst = eventsPerBrief.get(event.briefId) ?? [];
    lijst.push(event);
    eventsPerBrief.set(event.briefId, lijst);
  }

  const brieven = input.brieven
    .filter(item => item.rij.signaal_id === input.selectie.signaal_id)
    .map(item => {
      const compat = mapLegacyBriefNaarProductiekern(item.rij, item.adres);
      const audit = sorteerProductieAuditChronologisch(
        eventsPerBrief.get(item.rij.id) ?? [],
      );
      const waarschuwingen = [
        ...compat.waarschuwingen,
        ...audit.flatMap(event => event.waarschuwingen),
      ];

      return {
        brief: {
          ...compat.brief,
          selectieId: input.selectie.id,
          objectId: selectie.dossier.objectId,
        },
        versie: compat.versie,
        geadresseerdeKey: compat.legacy.geadresseerdeKey,
        printdatum: compat.legacy.printdatum,
        postdatum: compat.legacy.postdatum,
        verzendstatus: compat.legacy.verzendstatus,
        audit,
        waarschuwingen,
      };
    });

  const bekendeBriefIds = new Set(brieven.map(item => item.brief.id));
  for (const [briefId, gekoppeldeEvents] of eventsPerBrief) {
    if (bekendeBriefIds.has(briefId)) continue;
    losgekoppeldeAudit.push(...gekoppeldeEvents);
    dossierWaarschuwingen.push(
      `Audit-events verwijzen naar ontbrekende legacybrief: ${briefId}`,
    );
  }

  if (losgekoppeldeAudit.length > 0) {
    dossierWaarschuwingen.push(
      `${losgekoppeldeAudit.length} audit-event(s) konden niet hard aan een aanwezige brief worden gekoppeld.`,
    );
  }

  return {
    dossier: selectie.dossier,
    brieven,
    losgekoppeldeAudit: sorteerProductieAuditChronologisch(losgekoppeldeAudit),
    waarschuwingen: dossierWaarschuwingen,
    bron: 'legacy_productie_export',
  };
}
