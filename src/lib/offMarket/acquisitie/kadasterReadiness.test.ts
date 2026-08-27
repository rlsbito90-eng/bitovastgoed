import { describe, expect, it } from 'vitest';
import { faseInfo, type SignaalReadiness } from '@/lib/offMarket/acquisitie/readiness';
import { pasKadasterAanwezigheidToeOpReadiness } from './kadasterReadiness';

function readiness(fase: SignaalReadiness['fase'], geadresseerden: SignaalReadiness['geadresseerden'] = []): SignaalReadiness {
  return {
    fase,
    info: faseInfo(fase),
    geadresseerden,
    telling: { totaal: geadresseerden.length, metVolledigAdres: 0, metActiefConcept: 0, gereedVoorPrint: 0, geprintOfGepost: 0, geblokkeerd: 0 },
    waarschuwingen: [],
    blokkadeReden: null,
  };
}

describe('Kadaster-readinessprojectie', () => {
  it('verplaatst een generiek onderzoeksdossier met Rechten + intern bericht naar Eigenaar controleren', () => {
    const result = pasKadasterAanwezigheidToeOpReadiness(readiness('onderzoek_nodig'), {
      rechtenAanwezig: true,
      internBerichtAanwezig: true,
    });
    expect(result.fase).toBe('eigenaar_controleren');
    expect(result.blokkadeReden).toContain('geen nieuwe betaalde Kadasteraanvraag nodig');
  });

  it('doet niets wanneer alleen Rechten of alleen een document aanwezig is', () => {
    expect(pasKadasterAanwezigheidToeOpReadiness(readiness('onderzoek_nodig'), {
      rechtenAanwezig: true,
      internBerichtAanwezig: false,
    }).fase).toBe('onderzoek_nodig');
    expect(pasKadasterAanwezigheidToeOpReadiness(readiness('onderzoek_nodig'), {
      rechtenAanwezig: false,
      internBerichtAanwezig: true,
    }).fase).toBe('onderzoek_nodig');
  });

  it('overschrijft geen verder gevorderde fase', () => {
    expect(pasKadasterAanwezigheidToeOpReadiness(readiness('brief_voorbereiden'), {
      rechtenAanwezig: true,
      internBerichtAanwezig: true,
    }).fase).toBe('brief_voorbereiden');
  });
});
