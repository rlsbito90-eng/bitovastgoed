// V29 — Tests voor kaartbadges (popup + sidepanel) en BAG-detailregel.
// Generieke fixtures, geen echte adressen of relatiegegevens.
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  AiScoreBadge,
  BagKaartBadge,
  BagPopupDetailRegel,
  type SignaalKaartBadgeData,
} from '@/components/offmarket/kaart/KaartSignaalBadges';

function maakBadgeFixture(over: Partial<SignaalKaartBadgeData> = {}): SignaalKaartBadgeData {
  return {
    ai_score: null,
    ai_status: 'niet_verrijkt',
    bag_status: 'niet_verrijkt',
    kadasteradvies: null,
    bag_geselecteerd_opp_m2: null,
    bag_pandcontext_totaal_opp_m2: null,
    bag_totaal_oppervlakte_m2: null,
    bag_pandcontext_aantal_vbo: null,
    bag_aantal_vbo: null,
    bag_bouwjaar: null,
    bag_pandcontext_bron: null,
    ...over,
  } as SignaalKaartBadgeData;
}

describe('AiScoreBadge', () => {
  it('hoog (>=80) krijgt emerald-tone', () => {
    const { getByTestId } = render(<AiScoreBadge score={82} />);
    const el = getByTestId('ai-score-badge');
    expect(el.getAttribute('data-ai-tone')).toBe('emerald');
    expect(el.textContent).toMatch(/AI\s*82/);
  });
  it('midden (60–79) krijgt amber-tone', () => {
    const { getByTestId } = render(<AiScoreBadge score={65} />);
    expect(getByTestId('ai-score-badge').getAttribute('data-ai-tone')).toBe('amber');
  });
  it('laag (<60) krijgt muted-tone', () => {
    const { getByTestId } = render(<AiScoreBadge score={40} />);
    expect(getByTestId('ai-score-badge').getAttribute('data-ai-tone')).toBe('muted');
  });
  it('ontbrekende score → subtiel "AI niet verrijkt"', () => {
    const { getByTestId } = render(<AiScoreBadge score={null} />);
    const el = getByTestId('ai-score-badge');
    expect(el.textContent).toMatch(/niet verrijkt/i);
    expect(el.getAttribute('data-ai-tone')).toBe('empty');
  });
});

describe('BagKaartBadge — statussen', () => {
  it('verrijkt + kadasteradvies → KadasteradviesBadge', () => {
    const sig = maakBadgeFixture({ bag_status: 'verrijkt', kadasteradvies: 'aanbevolen' });
    const { getByTestId } = render(<BagKaartBadge signaal={sig} />);
    const el = getByTestId('kadasteradvies-badge');
    expect(el.getAttribute('data-niveau')).toBe('aanbevolen');
  });
  it('verrijkt zonder advies → fallback "BAG verrijkt"', () => {
    const sig = maakBadgeFixture({ bag_status: 'verrijkt', kadasteradvies: null });
    const { getByTestId } = render(<BagKaartBadge signaal={sig} />);
    expect(getByTestId('bag-kaart-badge').textContent).toMatch(/BAG verrijkt/);
  });
  it('meerdere_matches → "BAG-keuze nodig"', () => {
    const sig = maakBadgeFixture({ bag_status: 'meerdere_matches' });
    expect(render(<BagKaartBadge signaal={sig} />).getByTestId('bag-kaart-badge').textContent)
      .toMatch(/BAG-keuze nodig/);
  });
  it('geen_match → "Geen BAG-match"', () => {
    const sig = maakBadgeFixture({ bag_status: 'geen_match' });
    expect(render(<BagKaartBadge signaal={sig} />).getByTestId('bag-kaart-badge').textContent)
      .toMatch(/Geen BAG-match/);
  });
  it('fout → "BAG-fout"', () => {
    const sig = maakBadgeFixture({ bag_status: 'fout' });
    expect(render(<BagKaartBadge signaal={sig} />).getByTestId('bag-kaart-badge').textContent)
      .toMatch(/BAG-fout/);
  });
  it('niet_verrijkt / null → "BAG niet verrijkt"', () => {
    const sig = maakBadgeFixture({ bag_status: 'niet_verrijkt' });
    const r1 = render(<BagKaartBadge signaal={sig} />);
    expect(r1.getByTestId('bag-kaart-badge').textContent).toMatch(/BAG niet verrijkt/);
    r1.unmount();
    const sig2 = maakBadgeFixture({ bag_status: null as unknown as SignaalKaartBadgeData['bag_status'] });
    const r2 = render(<BagKaartBadge signaal={sig2} />);
    expect(r2.getByTestId('bag-kaart-badge').textContent).toMatch(/BAG niet verrijkt/);
  });
});

describe('BagPopupDetailRegel', () => {
  it('rendert niets als bag_status !== verrijkt', () => {
    const sig = maakBadgeFixture({ bag_status: 'geen_match' });
    const { queryByTestId } = render(<BagPopupDetailRegel signaal={sig} />);
    expect(queryByTestId('bag-popup-detail')).toBeNull();
  });
  it('volledige detailregel met alle velden + contextbron pandid', () => {
    const sig = maakBadgeFixture({
      bag_status: 'verrijkt',
      bag_geselecteerd_opp_m2: 47,
      bag_pandcontext_totaal_opp_m2: 103,
      bag_pandcontext_aantal_vbo: 2,
      bag_bouwjaar: 1881,
      bag_pandcontext_bron: 'pandid',
    });
    const { getByTestId } = render(<BagPopupDetailRegel signaal={sig} />);
    const cijfers = getByTestId('bag-popup-detail-cijfers').textContent ?? '';
    expect(cijfers).toMatch(/47 m²/);
    expect(cijfers).toMatch(/103 m² totaal/);
    expect(cijfers).toMatch(/2 VBO/);
    expect(cijfers).toMatch(/1881/);
    expect(getByTestId('bag-popup-detail-bron').textContent).toBe('BAG-pand');
  });
  it('fallback context naar bag_totaal_oppervlakte_m2 en bag_aantal_vbo', () => {
    const sig = maakBadgeFixture({
      bag_status: 'verrijkt',
      bag_geselecteerd_opp_m2: 60,
      bag_pandcontext_totaal_opp_m2: null,
      bag_totaal_oppervlakte_m2: 200,
      bag_pandcontext_aantal_vbo: null,
      bag_aantal_vbo: 4,
    });
    const cijfers = render(<BagPopupDetailRegel signaal={sig} />)
      .getByTestId('bag-popup-detail-cijfers').textContent ?? '';
    expect(cijfers).toMatch(/60 m²/);
    expect(cijfers).toMatch(/200 m² totaal/);
    expect(cijfers).toMatch(/4 VBO/);
  });
  it('contextbron huisnummer en gemengd produceren correcte labels', () => {
    const a = maakBadgeFixture({ bag_status: 'verrijkt', bag_geselecteerd_opp_m2: 50, bag_pandcontext_bron: 'huisnummer' });
    expect(render(<BagPopupDetailRegel signaal={a} />).getByTestId('bag-popup-detail-bron').textContent)
      .toBe('Huisnummercontext');
    const b = maakBadgeFixture({ bag_status: 'verrijkt', bag_geselecteerd_opp_m2: 50, bag_pandcontext_bron: 'gemengd' });
    expect(render(<BagPopupDetailRegel signaal={b} />).getByTestId('bag-popup-detail-bron').textContent)
      .toBe('Gemengde BAG-context');
  });
  it('contextbron "leeg" of null → geen bronregel', () => {
    const sig = maakBadgeFixture({ bag_status: 'verrijkt', bag_geselecteerd_opp_m2: 50, bag_pandcontext_bron: 'leeg' });
    const { queryByTestId } = render(<BagPopupDetailRegel signaal={sig} />);
    expect(queryByTestId('bag-popup-detail-bron')).toBeNull();
  });
  it('ontbrekende oude velden geven geen NaN, lege segmenten of crash', () => {
    const sig = maakBadgeFixture({
      bag_status: 'verrijkt',
      bag_geselecteerd_opp_m2: 47,
      // alle context-velden null
    });
    const cijfers = render(<BagPopupDetailRegel signaal={sig} />)
      .getByTestId('bag-popup-detail-cijfers').textContent ?? '';
    expect(cijfers).toBe('47 m²');
    expect(cijfers).not.toMatch(/NaN|undefined|null/);
    expect(cijfers).not.toMatch(/·\s*·/);
  });
  it('contextopp gelijk aan doelopp → niet dubbel tonen', () => {
    const sig = maakBadgeFixture({
      bag_status: 'verrijkt',
      bag_geselecteerd_opp_m2: 50,
      bag_pandcontext_totaal_opp_m2: 50,
    });
    const cijfers = render(<BagPopupDetailRegel signaal={sig} />)
      .getByTestId('bag-popup-detail-cijfers').textContent ?? '';
    expect(cijfers).toBe('50 m²');
  });
});

describe('Heavy JSON-velden worden nooit benaderd', () => {
  it('badges lezen geen bag_vbos, bag_match_kandidaten of ai_score_componenten', () => {
    const aangeraakt: string[] = [];
    const heavyTrap = new Proxy(
      {
        ai_score: 75,
        ai_status: 'klaar',
        bag_status: 'verrijkt',
        kadasteradvies: 'aanbevolen',
        bag_geselecteerd_opp_m2: 47,
        bag_pandcontext_totaal_opp_m2: 103,
        bag_totaal_oppervlakte_m2: 103,
        bag_pandcontext_aantal_vbo: 2,
        bag_aantal_vbo: 2,
        bag_bouwjaar: 1900,
        bag_pandcontext_bron: 'pandid',
      } as Record<string, unknown>,
      {
        get(target, prop: string) {
          aangeraakt.push(prop);
          if (prop === 'bag_vbos' || prop === 'bag_match_kandidaten' || prop === 'ai_score_componenten') {
            throw new Error(`Verboden veld benaderd: ${prop}`);
          }
          return target[prop];
        },
      },
    ) as unknown as SignaalKaartBadgeData;

    render(
      <>
        <AiScoreBadge score={heavyTrap.ai_score} status={heavyTrap.ai_status} />
        <BagKaartBadge signaal={heavyTrap} />
        <BagPopupDetailRegel signaal={heavyTrap} />
      </>,
    );

    expect(aangeraakt).not.toContain('bag_vbos');
    expect(aangeraakt).not.toContain('bag_match_kandidaten');
    expect(aangeraakt).not.toContain('ai_score_componenten');
  });
});
