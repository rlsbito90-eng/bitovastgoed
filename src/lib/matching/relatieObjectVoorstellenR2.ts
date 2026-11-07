import type { ObjectVastgoed, Relatie, Zoekprofiel } from '@/data/mock-data';
import { maakKandidaatVoorstellen, type CrmObjectInput, type KandidaatVoorstel } from './rolMandaatAdapter';

/** Eén R2-beoordeling in beide richtingen: kandidaat bij object en object bij relatie.
 * Geen klant- of objectgegevens worden opgeslagen of gemuteerd.
 * De CRM-objecten hebben nog geen verifieerbaar bestuurlijk-gemeenteveld:
 * kadastraleGemeente of plaats is hiervoor nadrukkelijk GEEN vervanging.
 */
export function maakObjectVoorstellenVoorRelatie(
  relatie: Relatie, objecten: readonly ObjectVastgoed[], zoekprofielen: readonly Zoekprofiel[],
): { object: ObjectVastgoed; voorstel: KandidaatVoorstel }[] {
  const rang = { passend: 4, te_verifieren: 3, onvoldoende: 2, afwijkend: 1 } as const;
  return objecten.flatMap(object => {
    const input: CrmObjectInput = {
      id: object.id,
      status: object.status,
      isArchived: object.isArchived,
      softDeletedAt: object.softDeletedAt,
      type: object.type,
      propertyTypeId: object.propertyTypeId,
      propertySubtypeIds: object.propertySubtypeIds,
      dealTypeIds: object.dealTypeIds,
      vraagprijs: object.vraagprijs,
      plaats: object.plaats,
      provincie: object.provincie,
      // gemeente is pas beschikbaar na bestuurlijke validatie.
    };
    const voorstel=maakKandidaatVoorstellen(input,[relatie],zoekprofielen)
      .find(v=>v.relatieId===relatie.id);
    return voorstel ? [{ object, voorstel }] : [];
  }).sort((a,b)=>rang[b.voorstel.besteRoute.kwalificatie]-rang[a.voorstel.besteRoute.kwalificatie] ||
    a.object.titel.localeCompare(b.object.titel,'nl'));
}
