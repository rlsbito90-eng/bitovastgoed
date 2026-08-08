import type { GeadresseerdeSnapshot } from './productiekernContract';
import { valideerGeadresseerdeSnapshot } from './productiekernContract';

export interface BatchAdreslabelInvoer {
  briefnummer: string;
  briefVersieId: string;
  geadresseerde: GeadresseerdeSnapshot;
}

export interface BatchAdreslabelRij {
  volgnummer: number;
  briefnummer: string;
  briefVersieId: string;
  naamregel: string;
  adresregel: string;
  postcode: string;
  plaats: string;
  landregel: string | null;
}

function veiligeCel(waarde: string): string {
  const getrimd = waarde.trim();
  return /^[=+\-@]/.test(getrimd) ? `'${getrimd}` : getrimd;
}

export function bouwBatchAdreslabelRijen(
  invoer: readonly BatchAdreslabelInvoer[],
): BatchAdreslabelRij[] {
  if (invoer.length === 0) throw new Error('Adreslabels vereisen minimaal één geadresseerde.');
  if (invoer.length > 1_000) throw new Error('Adreslabelbatch mag maximaal 1000 geadresseerden bevatten.');

  const briefnummers = new Set<string>();
  const versieIds = new Set<string>();
  const gesorteerd = [...invoer].sort((a, b) =>
    a.briefnummer.localeCompare(b.briefnummer) || a.briefVersieId.localeCompare(b.briefVersieId));

  return gesorteerd.map((item, index) => {
    const fouten = valideerGeadresseerdeSnapshot(item.geadresseerde);
    if (fouten.length > 0) {
      throw new Error(`Ongeldige geadresseerde voor ${item.briefVersieId}: ${fouten.join(' ')}`);
    }
    if (!item.briefnummer.trim()) throw new Error(`Briefnummer ontbreekt voor ${item.briefVersieId}.`);
    if (briefnummers.has(item.briefnummer)) throw new Error(`Briefnummer dubbel in adreslabels: ${item.briefnummer}.`);
    if (versieIds.has(item.briefVersieId)) throw new Error(`Briefversie dubbel in adreslabels: ${item.briefVersieId}.`);
    briefnummers.add(item.briefnummer);
    versieIds.add(item.briefVersieId);

    const naamregel = item.geadresseerde.bedrijfsnaam?.trim()
      || item.geadresseerde.naam?.trim()
      || '';
    const land = item.geadresseerde.land.trim();

    return {
      volgnummer: index + 1,
      briefnummer: veiligeCel(item.briefnummer),
      briefVersieId: veiligeCel(item.briefVersieId),
      naamregel: veiligeCel(naamregel),
      adresregel: veiligeCel(item.geadresseerde.straatHuisnummer),
      postcode: veiligeCel(item.geadresseerde.postcode.replace(/\s+/g, '').toUpperCase()),
      plaats: veiligeCel(item.geadresseerde.plaats),
      landregel: /^nederland$/i.test(land) ? null : veiligeCel(land.toUpperCase()),
    };
  });
}
