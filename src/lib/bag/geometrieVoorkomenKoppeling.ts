export interface BagVoorkomenKoppelMetadata {
  objecttype: string;
  identificatie: string;
  voorkomenidentificatie: number | null;
  beginGeldigheid: string | null;
  eindGeldigheid: string | null;
  tijdstipRegistratie: string | null;
  eindRegistratie: string | null;
  tijdstipInactief: string | null;
}

export interface BagVoorkomenKandidaat extends BagVoorkomenKoppelMetadata {
  voorkomenSleutel: string;
  status: string | null;
}

export type BagGeometrieVoorkomenKoppeling =
  | {
      status: 'gekoppeld';
      voorkomenSleutel: string;
      kandidaten: BagVoorkomenKandidaat[];
    }
  | {
      status: 'ontbrekende_voorkomenkoppeling' | 'ambigue_voorkomenkoppeling';
      voorkomenSleutel: null;
      kandidaten: BagVoorkomenKandidaat[];
    };

function waarde(value: string | number | null): string {
  return value == null ? '' : String(value).trim();
}

function datumtijd(value: string | null): string {
  const bronwaarde = waarde(value);
  const lokaal = bronwaarde.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?$/);
  if (!lokaal) return bronwaarde;
  return `${lokaal[1]}T${lokaal[2]}.${(lokaal[3] ?? '').padEnd(3, '0')}`;
}

export function maakVoorkomenSleutel(metadata: BagVoorkomenKoppelMetadata): string {
  return [
    waarde(metadata.voorkomenidentificatie),
    waarde(metadata.beginGeldigheid),
    waarde(metadata.eindGeldigheid),
    datumtijd(metadata.tijdstipRegistratie),
    datumtijd(metadata.eindRegistratie),
    datumtijd(metadata.tijdstipInactief),
  ].join('|');
}

export function maakVoorkomenBrongroepSleutel(metadata: BagVoorkomenKoppelMetadata): string {
  return [metadata.objecttype, metadata.identificatie, waarde(metadata.voorkomenidentificatie)].join('\u0000');
}

function sorteerKandidaten(kandidaten: readonly BagVoorkomenKandidaat[]): BagVoorkomenKandidaat[] {
  return [...kandidaten].sort((a, b) => (
    a.voorkomenSleutel.localeCompare(b.voorkomenSleutel)
    || (a.status ?? '').localeCompare(b.status ?? '')
  ));
}

export function koppelGeometrieAanVoorkomen(
  geometrie: BagVoorkomenKoppelMetadata,
  bronGroepKandidaten: readonly BagVoorkomenKandidaat[],
): BagGeometrieVoorkomenKoppeling {
  const kandidaten = sorteerKandidaten(bronGroepKandidaten);
  if (geometrie.voorkomenidentificatie == null) {
    return { status: 'ontbrekende_voorkomenkoppeling', voorkomenSleutel: null, kandidaten };
  }

  const verwachteSleutel = maakVoorkomenSleutel(geometrie);
  const matches = kandidaten.filter(kandidaat => kandidaat.voorkomenSleutel === verwachteSleutel);
  if (matches.length === 1) {
    return { status: 'gekoppeld', voorkomenSleutel: matches[0].voorkomenSleutel, kandidaten };
  }
  return {
    status: matches.length === 0 ? 'ontbrekende_voorkomenkoppeling' : 'ambigue_voorkomenkoppeling',
    voorkomenSleutel: null,
    kandidaten,
  };
}
