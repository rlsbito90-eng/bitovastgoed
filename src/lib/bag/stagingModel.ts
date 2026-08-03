import type { BagVoorkomenKern } from './relationeleNormalisatie';

export interface BagStagingObject {
  objecttype: string;
  identificatie: string;
  actueleVoorkomenidentificatie: number | null;
  status: string | null;
}

export interface BagStagingVoorkomen extends BagVoorkomenKern {
  isActueel: boolean;
}

export interface BagStagingRelatie {
  bronObjecttype: string;
  bronIdentificatie: string;
  relatietype: string;
  doelIdentificatie: string;
}

export interface BagStagingGeometrie {
  objecttype: string;
  identificatie: string;
  voorkomenidentificatie: number | null;
  crs: 'EPSG:28992';
  dimensie: 2 | 3;
  coordinaten: number[];
}

export interface BagStagingModel {
  objecten: BagStagingObject[];
  voorkomens: BagStagingVoorkomen[];
  relaties: BagStagingRelatie[];
  geometrieen: BagStagingGeometrie[];
  fouten: Array<{ code: string; identificatie: string; reden: string }>;
}

function uniekGesorteerd(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort();
}

export function bouwBagStagingModel(
  voorkomens: Array<BagVoorkomenKern & { geometrie?: { crs: 'EPSG:28992'; dimensie: 2 | 3; coordinaten: number[] } | null }>,
): BagStagingModel {
  const fouten: BagStagingModel['fouten'] = [];
  const perObject = new Map<string, typeof voorkomens>();

  for (const voorkomen of voorkomens) {
    const key = `${voorkomen.objecttype}|${voorkomen.identificatie}`;
    const groep = perObject.get(key) ?? [];
    groep.push(voorkomen);
    perObject.set(key, groep);
  }

  const objecten: BagStagingObject[] = [];
  const stagingVoorkomens: BagStagingVoorkomen[] = [];
  const relaties: BagStagingRelatie[] = [];
  const geometrieen: BagStagingGeometrie[] = [];

  for (const groep of perObject.values()) {
    const actueel = groep
      .filter(item => !item.eindGeldigheid && !item.eindRegistratie && !item.tijdstipInactief)
      .sort((a, b) => (b.voorkomenidentificatie ?? -1) - (a.voorkomenidentificatie ?? -1))[0] ?? null;

    if (groep.filter(item => !item.eindGeldigheid && !item.eindRegistratie && !item.tijdstipInactief).length > 1) {
      fouten.push({ code: 'meerdere_actuele_voorkomens', identificatie: groep[0].identificatie, reden: 'Meer dan één actueel voorkomen; hoogste voorkomenidentificatie geselecteerd.' });
    }

    objecten.push({
      objecttype: groep[0].objecttype,
      identificatie: groep[0].identificatie,
      actueleVoorkomenidentificatie: actueel?.voorkomenidentificatie ?? null,
      status: actueel?.status ?? null,
    });

    for (const voorkomen of groep) {
      stagingVoorkomens.push({ ...voorkomen, isActueel: voorkomen === actueel });
      for (const [relatietype, doelen] of Object.entries(voorkomen.relaties)) {
        for (const doelIdentificatie of uniekGesorteerd(doelen)) {
          relaties.push({ bronObjecttype: voorkomen.objecttype, bronIdentificatie: voorkomen.identificatie, relatietype, doelIdentificatie });
        }
      }
      if (voorkomen.geometrie) {
        const geldig = voorkomen.geometrie.coordinaten.length > 0
          && voorkomen.geometrie.coordinaten.every(Number.isFinite)
          && voorkomen.geometrie.coordinaten.length % voorkomen.geometrie.dimensie === 0;
        if (!geldig) {
          fouten.push({ code: 'ongeldige_geometrie', identificatie: voorkomen.identificatie, reden: 'Coördinaten passen niet bij de opgegeven dimensie.' });
        } else {
          geometrieen.push({
            objecttype: voorkomen.objecttype,
            identificatie: voorkomen.identificatie,
            voorkomenidentificatie: voorkomen.voorkomenidentificatie,
            ...voorkomen.geometrie,
          });
        }
      }
    }
  }

  const sleutel = (item: { objecttype: string; identificatie: string }) => `${item.objecttype}|${item.identificatie}`;
  objecten.sort((a, b) => sleutel(a).localeCompare(sleutel(b)));
  stagingVoorkomens.sort((a, b) => `${sleutel(a)}|${a.voorkomenidentificatie ?? ''}`.localeCompare(`${sleutel(b)}|${b.voorkomenidentificatie ?? ''}`));
  relaties.sort((a, b) => `${a.bronObjecttype}|${a.bronIdentificatie}|${a.relatietype}|${a.doelIdentificatie}`.localeCompare(`${b.bronObjecttype}|${b.bronIdentificatie}|${b.relatietype}|${b.doelIdentificatie}`));
  geometrieen.sort((a, b) => `${sleutel(a)}|${a.voorkomenidentificatie ?? ''}`.localeCompare(`${sleutel(b)}|${b.voorkomenidentificatie ?? ''}`));
  fouten.sort((a, b) => `${a.code}|${a.identificatie}`.localeCompare(`${b.code}|${b.identificatie}`));

  return { objecten, voorkomens: stagingVoorkomens, relaties, geometrieen, fouten };
}

export function stagingFingerprint(model: BagStagingModel): string {
  return JSON.stringify(model);
}
