import { describe, expect, it } from 'vitest';
import { actueleBiedpositie, bodKarakterLabel } from './actuelePositie';
import type { BiedboekTraject } from './offerBook';
import type { Bieding } from './types';

const bod = (status: Bieding['status'], offerType: Bieding['offerType'] = 'indicatief') =>
  ({ status, offerType, richting: 'van_koper' } as Bieding);
const positie = (fase: BiedboekTraject['fase'], laatste: Bieding) => ({ fase, laatste });

describe('actuele biedpositie', () => {
  it('onderscheidt ontvangen van daadwerkelijk in behandeling', () => {
    expect(actueleBiedpositie(positie('wacht_op_verkoper', bod('ontvangen'))).titel)
      .toBe('Kopersbod ontvangen');
    expect(actueleBiedpositie(positie('wacht_op_verkoper', bod('in_behandeling'))).titel)
      .toBe('Bij verkoper in behandeling');
  });
  it('verwart verzoek aangepast bod niet met nieuw bod', () => {
    const p = actueleBiedpositie(positie('wacht_op_koper', bod('aangepast_bod_gevraagd')));
    expect(p.titel).toContain('gevraagd');
    expect(p.toelichting).toContain('nog geen nieuw bod');
  });
  it('beschouwt verkopersvoorstel niet automatisch als verzonden', () => {
    const p = actueleBiedpositie(positie('wacht_op_koper',
      { ...bod('tegenvoorstel_gedaan'), richting: 'van_verkoper' }));
    expect(p.toelichting).toContain('niet automatisch');
  });
  it('toont bij afgeronde onderhandelingen geen verzoek op reactie verkoper', () => {
    expect(actueleBiedpositie(positie('afgewezen', bod('afgewezen'))).titel).toContain('afgewezen');
    expect(actueleBiedpositie(positie('geaccepteerd', bod('geaccepteerd'))).vervolgstap).toContain('Transactie');
  });
});

describe('biedkarakter', () => {
  it('toont expliciet gekozen formeel karakter', () => {
    expect(bodKarakterLabel({ ...bod('ontvangen'), bodKarakter: 'formeel' })).toBe('Formeel');
  });
  it('gebruikt alleen expliciete historische indicatief-categorie als fallback', () => {
    expect(bodKarakterLabel(bod('ontvangen', 'indicatief'))).toBe('Indicatief');
    expect(bodKarakterLabel(bod('ontvangen', 'schriftelijk'))).toBe('Niet vastgelegd');
    expect(bodKarakterLabel(bod('ontvangen', 'onvoorwaardelijk'))).toBe('Niet vastgelegd');
  });
});
