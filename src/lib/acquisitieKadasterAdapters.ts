import {
  offMarketSignaalNaarDossierContext,
  vastgoedkansNaarDossierContext,
  type OffMarketDossierBron,
  type VastgoedkansDossierBron,
} from './acquisitieDossierAdapters';
import {
  bouwAcquisitieKadasterReadModel,
  type AcquisitieKadasterReadModel,
} from './acquisitieKadasterReadModel';

interface GedeeldeKadasterBron {
  adresControleGeslaagd?: boolean | null;
  adres_controle_geslaagd?: boolean | null;
  bagPandId?: string | null;
  bag_pand_id?: string | null;
  bagGeselecteerdPandId?: string | null;
  bag_geselecteerd_pand_id?: string | null;
  bagVerblijfsobjectId?: string | null;
  bag_verblijfsobject_id?: string | null;
  bagGeselecteerdVboId?: string | null;
  bag_geselecteerd_vbo_id?: string | null;
  kadasterStatus?: string | null;
  kadaster_status?: string | null;
  kadastraleAanduiding?: string | null;
  kadastrale_aanduiding?: string | null;
  eigenaarNaam?: string | null;
  eigenaar_naam?: string | null;
  eigenaarRelatieId?: string | null;
  eigenaar_relatie_id?: string | null;
  kadasterLaatstGecontroleerdOp?: string | null;
  kadaster_laatst_gecontroleerd_op?: string | null;
  eigenaarLaatstGecontroleerdOp?: string | null;
  eigenaar_laatst_gecontroleerd_op?: string | null;
}

export type VastgoedkansKadasterBron = VastgoedkansDossierBron & GedeeldeKadasterBron;
export type OffMarketKadasterBron = OffMarketDossierBron & GedeeldeKadasterBron;

const eersteTekst = (...waarden: Array<string | null | undefined>): string | null => {
  for (const waarde of waarden) {
    const schoon = waarde?.trim();
    if (schoon) return schoon;
  }
  return null;
};

const eersteBoolean = (...waarden: Array<boolean | null | undefined>): boolean | null => {
  for (const waarde of waarden) {
    if (typeof waarde === 'boolean') return waarde;
  }
  return null;
};

const naarBrongegevens = (bron: GedeeldeKadasterBron) => ({
  adresControleGeslaagd: eersteBoolean(bron.adresControleGeslaagd, bron.adres_controle_geslaagd),
  bagPandId: eersteTekst(
    bron.bagPandId,
    bron.bag_pand_id,
    bron.bagGeselecteerdPandId,
    bron.bag_geselecteerd_pand_id,
  ),
  bagVerblijfsobjectId: eersteTekst(
    bron.bagVerblijfsobjectId,
    bron.bag_verblijfsobject_id,
    bron.bagGeselecteerdVboId,
    bron.bag_geselecteerd_vbo_id,
  ),
  kadasterStatus: eersteTekst(bron.kadasterStatus, bron.kadaster_status),
  kadastraleAanduiding: eersteTekst(bron.kadastraleAanduiding, bron.kadastrale_aanduiding),
  eigenaarNaam: eersteTekst(bron.eigenaarNaam, bron.eigenaar_naam),
  eigenaarRelatieId: eersteTekst(bron.eigenaarRelatieId, bron.eigenaar_relatie_id),
  laatstGecontroleerdOp: eersteTekst(
    bron.kadasterLaatstGecontroleerdOp,
    bron.kadaster_laatst_gecontroleerd_op,
    bron.eigenaarLaatstGecontroleerdOp,
    bron.eigenaar_laatst_gecontroleerd_op,
  ),
});

export function vastgoedkansNaarKadasterReadModel(
  kans: VastgoedkansKadasterBron,
): AcquisitieKadasterReadModel {
  return bouwAcquisitieKadasterReadModel(
    vastgoedkansNaarDossierContext(kans),
    naarBrongegevens(kans),
  );
}

export function offMarketSignaalNaarKadasterReadModel(
  signaal: OffMarketKadasterBron,
): AcquisitieKadasterReadModel {
  return bouwAcquisitieKadasterReadModel(
    offMarketSignaalNaarDossierContext(signaal),
    naarBrongegevens(signaal),
  );
}
