// Foutvertaling en resultaatverwerking voor het toevoegen van pipelinekandidaten.
// Doel: databasefouten niet meer stilzwijgend verliezen, zonder SQL of
// technische details in de UI te tonen.

export type KandidaatFoutInfo = {
  /** Postgres-/PostgREST-code indien bekend, bv. '23505'. */
  code?: string;
  /** Veilige, korte reden voor de gebruiker. */
  reden: string;
  /** True bij unique/duplicate-conflict. */
  duplicaat: boolean;
};

type AnyErr = { message?: string; code?: string; details?: string; hint?: string } | null | undefined;

/** Haal de databasecode uit een Error-achtig object (ook als die is doorgegeven via een gewrapte Error). */
export function haalFoutcode(err: unknown): string | undefined {
  const e = err as AnyErr;
  if (!e) return undefined;
  if (typeof e.code === 'string' && e.code.trim()) return e.code.trim();
  const msg = `${e.message ?? ''} ${e.details ?? ''}`;
  if (/duplicate key value|unique constraint/i.test(msg)) return '23505';
  return undefined;
}

const CODE_REDEN: Record<string, string> = {
  '23505': 'deze relatie is al gekoppeld of was eerder gekoppeld aan dit object',
  '23503': 'een gerelateerd record ontbreekt (relatie, object of zoekprofiel)',
  '23502': 'een verplicht veld ontbreekt',
  '23514': 'een gekozen waarde is niet toegestaan',
  '22P02': 'een waarde heeft een ongeldig formaat',
  '42501': 'je hebt geen rechten om deze kandidaat toe te voegen',
  'PGRST301': 'je hebt geen rechten om deze kandidaat toe te voegen',
  'PGRST205': 'het databaseonderdeel is niet beschikbaar',
};

/** Vertaal een fout naar een veilige, concrete reden voor de gebruiker. */
export function beschrijfKandidaatFout(err: unknown): KandidaatFoutInfo {
  const code = haalFoutcode(err);
  if (code && CODE_REDEN[code]) {
    return { code, reden: CODE_REDEN[code], duplicaat: code === '23505' };
  }
  return {
    code,
    reden: 'de database gaf een onbekende fout terug (zie console voor technisch detail)',
    duplicaat: false,
  };
}

export type KandidaatResultaat = {
  relatieId: string;
  naam: string;
  fout?: KandidaatFoutInfo;
};

export type KandidaatSamenvatting = {
  ok: number;
  fout: number;
  /** Relaties die opnieuw geprobeerd kunnen worden; blijven geselecteerd. */
  mislukteIds: string[];
  successTekst?: string;
  foutTekst?: string;
  /** Dialog mag alleen sluiten als alles is gelukt. */
  magSluiten: boolean;
};

/** Bouw toastteksten en vervolgstatus uit de losse resultaten. */
export function vatKandidaatResultatenSamen(resultaten: KandidaatResultaat[]): KandidaatSamenvatting {
  const gelukt = resultaten.filter(r => !r.fout);
  const mislukt = resultaten.filter(r => r.fout);

  const successTekst = gelukt.length > 0
    ? `${gelukt.length} kandida${gelukt.length === 1 ? 'at' : 'ten'} toegevoegd`
    : undefined;

  let foutTekst: string | undefined;
  if (mislukt.length === 1) {
    const m = mislukt[0];
    foutTekst = `${m.naam} niet toegevoegd: ${m.fout!.reden}.`;
  } else if (mislukt.length > 1) {
    const namen = mislukt.map(m => `${m.naam} (${m.fout!.reden})`).join('; ');
    foutTekst = `${mislukt.length} kandidaten niet toegevoegd: ${namen}.`;
  }

  return {
    ok: gelukt.length,
    fout: mislukt.length,
    mislukteIds: mislukt.map(m => m.relatieId),
    successTekst,
    foutTekst,
    magSluiten: mislukt.length === 0 && gelukt.length > 0,
  };
}
