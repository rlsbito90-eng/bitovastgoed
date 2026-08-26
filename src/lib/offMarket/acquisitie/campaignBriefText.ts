import type { CampagneStap } from '@/lib/offMarket/brieven/groepering';

export interface CampaignBriefTextContext {
  campagneStap: CampagneStap;
  eerderObject: string | null;
  huidigObject: string | null;
  heeftEerderContact: boolean;
  portefeuille: boolean;
}

function normaliseer(v: string | null | undefined): string {
  return (v ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * Vervangt uitsluitend de eerste inhoudelijke alinea na de aanhef. De gekozen
 * A/B-template, onderwerpregel, CTA en handtekening blijven uit de bestaande
 * template-engine komen. Zo blijft er één templatebron, met campagnecontext als
 * dunne laag erbovenop.
 */
export function pasCampagneContextToeAanBrieftekst(
  brieftekst: string,
  context: CampaignBriefTextContext,
): string {
  if (!context.heeftEerderContact || context.campagneStap === 'brief_1') return brieftekst;

  const eerder = normaliseer(context.eerderObject);
  const huidig = normaliseer(context.huidigObject);
  let intro: string;

  if (eerder && huidig && eerder.toLowerCase() !== huidig.toLowerCase()) {
    intro = context.campagneStap === 'brief_3'
      ? `Ik kom nog één keer kort bij u terug. Eerder schreef ik u over het vastgoed aan ${eerder}. Inmiddels kwam ook ${huidig} onder mijn aandacht. Dat vormt voor mij een concrete aanleiding om mijn eerdere bericht nog eenmaal op te volgen.`
      : `Enige tijd geleden schreef ik u over het vastgoed aan ${eerder}. Inmiddels kwam ook ${huidig} onder mijn aandacht. Dat was voor mij aanleiding om mijn eerdere bericht graag kort op te volgen.`;
  } else if (eerder) {
    intro = context.campagneStap === 'brief_3'
      ? `Ik kom nog één keer kort bij u terug over het vastgoed aan ${eerder}, waarover ik u eerder schreef.`
      : `Enige tijd geleden schreef ik u over het vastgoed aan ${eerder}. Ik kom daar graag nogmaals kort bij u op terug.`;
  } else if (context.portefeuille && huidig) {
    intro = `Enige tijd geleden nam ik contact met u op over vastgoed binnen uw portefeuille. Inmiddels kwam ook ${huidig} onder mijn aandacht. Dat was voor mij aanleiding om mijn eerdere bericht kort op te volgen.`;
  } else {
    intro = context.campagneStap === 'brief_3'
      ? 'Ik kom nog één keer kort bij u terug op mijn eerdere brief.'
      : 'Enige tijd geleden schreef ik u al. Ik kom daar graag nogmaals kort bij u op terug.';
  }

  const blokken = brieftekst.split(/\n\s*\n/);
  if (blokken.length < 2) return brieftekst;
  blokken[1] = intro;
  return blokken.join('\n\n');
}

export function campagnebewustePayload<T extends { brieftekst: string; objectomschrijving?: string }>(
  payload: T,
  context: Omit<CampaignBriefTextContext, 'huidigObject'> & { huidigObject?: string | null },
): T {
  return {
    ...payload,
    brieftekst: pasCampagneContextToeAanBrieftekst(payload.brieftekst, {
      ...context,
      huidigObject: context.huidigObject ?? payload.objectomschrijving ?? null,
    }),
  };
}
