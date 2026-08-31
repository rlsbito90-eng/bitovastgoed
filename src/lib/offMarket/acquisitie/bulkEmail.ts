import type { OffMarketBrief } from '@/hooks/useOffMarketBrieven';
import type { OffMarketSignaal } from '@/lib/offMarket/types';
import {
  buildEmailTemplate,
  EMAIL_STAP_VOLGORDE,
  type EmailProfiel,
  type EmailStap,
} from '@/lib/offMarket/email/emailProfielen';
import { formatSignaalAdres } from '@/lib/offMarket/adresNormalisatie';

export type BulkEmailActie =
  | 'aanmaken'
  | 'hergebruiken'
  | 'geen_email'
  | 'reeks_compleet'
  | 'respons_geregistreerd';

export interface BulkEmailPlanItem {
  key: string;
  signaalIds: string[];
  primairSignaalId: string;
  email: string | null;
  naam: string | null;
  bedrijfsnaam: string | null;
  profiel: EmailProfiel;
  campagneStap: EmailStap | null;
  actie: BulkEmailActie;
  bestaandeBrief: OffMarketBrief | null;
  onderwerp: string | null;
  brieftekst: string | null;
  blokkade: string | null;
}

function normaal(value: unknown): string {
  return String(value ?? '').trim();
}

export function isBruikbaarEmailadres(value: unknown): value is string {
  const email = normaal(value);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function nieuwsteBrief(brieven: OffMarketBrief[]): OffMarketBrief | null {
  return [...brieven].sort((a, b) =>
    String(b.updated_at ?? b.created_at ?? '').localeCompare(String(a.updated_at ?? a.created_at ?? '')),
  )[0] ?? null;
}

function emailVoorSignaal(signaal: OffMarketSignaal, brieven: OffMarketBrief[]): string | null {
  const direct = normaal((signaal as any).eigenaar_email);
  if (isBruikbaarEmailadres(direct)) return direct;

  const bestaand = nieuwsteBrief(brieven.filter((brief) =>
    brief.signaal_id === signaal.id
    && !brief.archived_at
    && (brief.kanaal ?? 'post') === 'email'
    && isBruikbaarEmailadres(brief.verzendadres),
  ));
  return bestaand && isBruikbaarEmailadres(bestaand.verzendadres)
    ? bestaand.verzendadres.trim()
    : null;
}

function naamVoorSignaal(signaal: OffMarketSignaal): { naam: string | null; bedrijfsnaam: string | null } {
  const naam = normaal((signaal as any).eigenaar_naam) || null;
  const bedrijfsnaam = normaal((signaal as any).eigenaar_bedrijfsnaam) || null;
  return { naam, bedrijfsnaam };
}

function heeftBlokkerendeRespons(brieven: OffMarketBrief[]): boolean {
  return brieven.some((brief) => {
    if (brief.archived_at) return false;
    const respons = normaal(brief.responsstatus);
    return Boolean(respons && respons !== 'geen_reactie');
  });
}

function bepaalEmailStap(
  brieven: OffMarketBrief[],
): { stap: EmailStap | null; bestaandeBrief: OffMarketBrief | null; compleet: boolean } {
  const actief = brieven.filter((brief) =>
    !brief.archived_at && (brief.kanaal ?? 'post') === 'email',
  );

  for (const stap of EMAIL_STAP_VOLGORDE) {
    const voorStap = actief.filter((brief) => brief.campagne_stap === stap);
    const bestaand = nieuwsteBrief(voorStap);
    if (!bestaand) return { stap, bestaandeBrief: null, compleet: false };
    if (bestaand.status !== 'verstuurd') return { stap, bestaandeBrief: bestaand, compleet: false };
  }

  return { stap: null, bestaandeBrief: null, compleet: true };
}

const HANDTEKENING = [
  'Met vriendelijke groet,',
  '',
  'Ramysh Bito',
  'Eigenaar & Vastgoedadviseur',
  'Bito Vastgoed',
  'T: +31 6 16 98 76 06',
  'E: info@bitovastgoed.nl',
  'W: www.bitovastgoed.nl',
].join('\n');

function bouwOpvolgTemplate(
  stap: EmailStap,
  signaal: OffMarketSignaal,
  profiel: EmailProfiel,
  naam: string | null,
  bedrijfsnaam: string | null,
): { onderwerp: string; brieftekst: string } {
  const adres = formatSignaalAdres(signaal) || normaal(signaal.adres) || '[object]';
  const basis = buildEmailTemplate({
    profiel,
    adres,
    plaats: signaal.plaats ?? null,
    geadresseerdeNaam: naam,
    bedrijfsnaam,
  });
  if (stap === 'email_1') return basis;

  if (stap === 'email_2') {
    return {
      onderwerp: basis.onderwerp.startsWith('Re: ') ? basis.onderwerp : `Re: ${basis.onderwerp}`,
      brieftekst: [
        'Geachte heer/mevrouw,',
        '',
        `Onlangs stuurde ik u een e-mail over ${adres}. Ik kom daar graag nog even kort op terug.`,
        '',
        'Mocht verkoop van dit object, ander vastgoed of een bredere portefeuille nu of op termijn spelen, dan kom ik graag vrijblijvend met u in contact. Als dit niet aan de orde is, is dat uiteraard geen probleem.',
        '',
        'Een korte reactie per e-mail of telefoon is voldoende.',
        '',
        HANDTEKENING,
      ].join('\n'),
    };
  }

  return {
    onderwerp: basis.onderwerp.startsWith('Re: ') ? basis.onderwerp : `Re: ${basis.onderwerp}`,
    brieftekst: [
      'Geachte heer/mevrouw,',
      '',
      `Ik kom nog één keer kort terug op mijn eerdere berichten over ${adres}.`,
      '',
      'Als verkoop momenteel niet speelt, laat ik het hierbij. Mocht dit op termijn veranderen, of mocht er ander vastgoed in portefeuille zijn waarvoor een discrete marktbenadering interessant kan zijn, dan kom ik uiteraard graag met u in contact.',
      '',
      'Dank voor uw tijd.',
      '',
      HANDTEKENING,
    ].join('\n'),
  };
}

/**
 * Bouw een veilige centrale e-mailopvolgplanning voor een expliciete Radar-selectie.
 *
 * Hoofdregels:
 * - maximaal één e-mail per uniek e-mailadres/partij in dezelfde selectie;
 * - bestaande e-mailconcepten worden hergebruikt;
 * - een geregistreerde respons stopt de standaardsequence;
 * - na E-mail 3 wordt niets nieuws aangemaakt;
 * - ontbrekende e-mailadressen blijven zichtbaar als blokkade en worden nooit stil weggefilterd.
 */
export function bouwBulkEmailPlan(
  signalen: readonly OffMarketSignaal[],
  brieven: readonly OffMarketBrief[],
): BulkEmailPlanItem[] {
  const groepen = new Map<string, { email: string | null; signalen: OffMarketSignaal[] }>();

  for (const signaal of signalen) {
    const email = emailVoorSignaal(signaal, [...brieven]);
    const key = email ? `email:${email.toLowerCase()}` : `geen-email:${signaal.id}`;
    const bestaand = groepen.get(key) ?? { email, signalen: [] };
    bestaand.signalen.push(signaal);
    groepen.set(key, bestaand);
  }

  const plan: BulkEmailPlanItem[] = [];

  for (const [key, groep] of groepen.entries()) {
    const primair = groep.signalen[0];
    const signaalIds = groep.signalen.map((signaal) => signaal.id);
    const { naam, bedrijfsnaam } = naamVoorSignaal(primair);
    const profiel: EmailProfiel = groep.signalen.length > 1 ? 'portefeuille' : 'algemene_acquisitie';

    if (!groep.email) {
      plan.push({
        key,
        signaalIds,
        primairSignaalId: primair.id,
        email: null,
        naam,
        bedrijfsnaam,
        profiel,
        campagneStap: null,
        actie: 'geen_email',
        bestaandeBrief: null,
        onderwerp: null,
        brieftekst: null,
        blokkade: 'Geen bruikbaar e-mailadres bekend.',
      });
      continue;
    }

    const email = groep.email.toLowerCase();
    const partijBrieven = brieven.filter((brief) => {
      if (brief.archived_at) return false;
      if (signaalIds.includes(brief.signaal_id)) return true;
      return (brief.kanaal ?? 'post') === 'email'
        && isBruikbaarEmailadres(brief.verzendadres)
        && brief.verzendadres!.trim().toLowerCase() === email;
    });

    if (heeftBlokkerendeRespons(partijBrieven)) {
      plan.push({
        key,
        signaalIds,
        primairSignaalId: primair.id,
        email: groep.email,
        naam,
        bedrijfsnaam,
        profiel,
        campagneStap: null,
        actie: 'respons_geregistreerd',
        bestaandeBrief: null,
        onderwerp: null,
        brieftekst: null,
        blokkade: 'Er is een respons geregistreerd; de standaardopvolging is gestopt.',
      });
      continue;
    }

    const stapInfo = bepaalEmailStap(partijBrieven.filter((brief) =>
      (brief.kanaal ?? 'post') === 'email'
      && isBruikbaarEmailadres(brief.verzendadres)
      && brief.verzendadres!.trim().toLowerCase() === email,
    ));

    if (stapInfo.compleet || !stapInfo.stap) {
      plan.push({
        key,
        signaalIds,
        primairSignaalId: primair.id,
        email: groep.email,
        naam,
        bedrijfsnaam,
        profiel,
        campagneStap: null,
        actie: 'reeks_compleet',
        bestaandeBrief: null,
        onderwerp: null,
        brieftekst: null,
        blokkade: 'E-mailreeks compleet (E-mail 1 t/m 3 geregistreerd als verzonden).',
      });
      continue;
    }

    const template = stapInfo.bestaandeBrief
      ? {
          onderwerp: stapInfo.bestaandeBrief.onderwerp ?? '',
          brieftekst: stapInfo.bestaandeBrief.brieftekst,
        }
      : bouwOpvolgTemplate(stapInfo.stap, primair, profiel, naam, bedrijfsnaam);

    plan.push({
      key,
      signaalIds,
      primairSignaalId: primair.id,
      email: groep.email,
      naam,
      bedrijfsnaam,
      profiel,
      campagneStap: stapInfo.stap,
      actie: stapInfo.bestaandeBrief ? 'hergebruiken' : 'aanmaken',
      bestaandeBrief: stapInfo.bestaandeBrief,
      onderwerp: template.onderwerp,
      brieftekst: template.brieftekst,
      blokkade: null,
    });
  }

  return plan.sort((a, b) => a.key.localeCompare(b.key));
}
