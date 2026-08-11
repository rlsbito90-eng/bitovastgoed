export interface BagPandSearchIndexAdres {
  primairAdres: string | null;
  primairStraat: string | null;
  primairHuisnummer: string | null;
  primairPostcode: string | null;
  primairPlaats: string | null;
  adresCount: number;
}

export interface BagPandSearchIndexGebied {
  gemeenteCode: string;
  gemeenteNaam: string | null;
  cbsJaarversie: number | null;
  wijkCode: string | null;
  wijkNaam: string | null;
  buurtCode: string | null;
  buurtNaam: string | null;
  stadsdeelCode: string | null;
  stadsdeelNaam: string | null;
}

export interface BagPandSearchIndexRij {
  datasetversieId: string;
  scopeCode: string;
  pandIdentificatie: string;
  voorkomenSleutel: string;
  indexVersie: string;

  pandstatusHuidig: string | null;
  oorspronkelijkBouwjaar: number | null;

  heeftVbo: boolean;
  vboAantal: number;
  vboOppervlakteSom: number | null;
  vboOppervlakteMax: number | null;
  gebruiksdoelen: string[];
  isGemengd: boolean;

  adres: BagPandSearchIndexAdres;
  gebied: BagPandSearchIndexGebied;
}

export interface BagPandSearchIndexValidatie {
  geldig: boolean;
  fouten: string[];
}

const CODE = /^[A-Za-z0-9_-]{1,64}$/;

function nietNegatiefGetalOfNull(value: number | null): boolean {
  return value === null || (Number.isFinite(value) && value >= 0);
}

export function valideerBagPandSearchIndexRij(
  rij: BagPandSearchIndexRij,
): BagPandSearchIndexValidatie {
  const fouten: string[] = [];

  if (!rij.datasetversieId.trim()) fouten.push('datasetversieId is verplicht.');
  if (!CODE.test(rij.scopeCode)) fouten.push('scopeCode is ongeldig.');
  if (!rij.pandIdentificatie.trim()) fouten.push('pandIdentificatie is verplicht.');
  if (!rij.voorkomenSleutel.trim()) fouten.push('voorkomenSleutel is verplicht.');
  if (!rij.indexVersie.trim()) fouten.push('indexVersie is verplicht.');
  if (!rij.gebied.gemeenteCode.trim()) fouten.push('gemeenteCode is verplicht.');

  if (!Number.isInteger(rij.vboAantal) || rij.vboAantal < 0) {
    fouten.push('vboAantal moet een niet-negatief geheel getal zijn.');
  }
  if (!Number.isInteger(rij.adres.adresCount) || rij.adres.adresCount < 0) {
    fouten.push('adresCount moet een niet-negatief geheel getal zijn.');
  }
  if (!nietNegatiefGetalOfNull(rij.vboOppervlakteSom)) {
    fouten.push('vboOppervlakteSom moet NULL of een niet-negatief getal zijn.');
  }
  if (!nietNegatiefGetalOfNull(rij.vboOppervlakteMax)) {
    fouten.push('vboOppervlakteMax moet NULL of een niet-negatief getal zijn.');
  }

  if (rij.heeftVbo) {
    if (rij.vboAantal < 1) fouten.push('heeftVbo=true vereist vboAantal >= 1.');
    if (rij.vboOppervlakteSom === null) {
      fouten.push('heeftVbo=true vereist vboOppervlakteSom.');
    }
    if (rij.vboOppervlakteMax === null) {
      fouten.push('heeftVbo=true vereist vboOppervlakteMax.');
    }
  } else {
    if (rij.vboAantal !== 0) fouten.push('heeftVbo=false vereist vboAantal=0.');
    if (rij.vboOppervlakteSom !== null) {
      fouten.push('heeftVbo=false vereist vboOppervlakteSom=NULL.');
    }
    if (rij.vboOppervlakteMax !== null) {
      fouten.push('heeftVbo=false vereist vboOppervlakteMax=NULL.');
    }
    if (rij.gebruiksdoelen.length !== 0) {
      fouten.push('heeftVbo=false vereist lege gebruiksdoelen.');
    }
  }

  if (
    rij.vboOppervlakteSom !== null
    && rij.vboOppervlakteMax !== null
    && rij.vboOppervlakteMax > rij.vboOppervlakteSom
  ) {
    fouten.push('vboOppervlakteMax mag niet groter zijn dan vboOppervlakteSom.');
  }

  const uniekeDoelen = new Set(rij.gebruiksdoelen.map(doel => doel.trim()).filter(Boolean));
  if (uniekeDoelen.size !== rij.gebruiksdoelen.length) {
    fouten.push('gebruiksdoelen moeten uniek en niet leeg zijn.');
  }
  if (rij.isGemengd !== (uniekeDoelen.size > 1)) {
    fouten.push('isGemengd moet deterministisch volgen uit meerdere gebruiksdoelen.');
  }

  if (rij.adres.adresCount === 0 && rij.adres.primairAdres !== null) {
    fouten.push('adresCount=0 vereist primairAdres=NULL.');
  }
  if (rij.adres.adresCount > 0 && rij.adres.primairAdres === null) {
    fouten.push('adresCount>0 vereist een deterministisch primairAdres.');
  }

  return { geldig: fouten.length === 0, fouten };
}
