// src/test/object/objectDossierProgress.test.tsx
//
// Fase 1B — Tests voor DossierProgress-strip.
// - Toont CTAs voor alle 6 onderdelen bij leeg object
// - CTA activeert juiste tab-anchor via onGoto
// - Compacte "Dossier compleet"-staat bij volledig dossier
// - Minimale quick-create data veroorzaakt geen crash
// - Toont geen e-mail of persoonsgegevens
// - Muteert geen relatievelden

import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import DossierProgress, { buildDossierCtas } from '@/components/object/DossierProgress';

function makeObject(overrides: Record<string, any> = {}) {
  return {
    id: 'obj-1',
    titel: 'Testobject',
    verkoperNaam: 'Piet Janssen',
    verkoperEmail: 'piet@voorbeeld.nl',
    eigenaarRelatieId: 'rel-1',
    ...overrides,
  };
}

describe('DossierProgress', () => {
  it('toont strip met alle 6 open CTAs bij een leeg dossier', () => {
    render(
      <DossierProgress
        object={makeObject()}
        fotosCount={0}
        documentenCount={0}
        huurdersCount={0}
        onGoto={() => {}}
      />,
    );
    expect(screen.getByTestId('dossier-progress')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /financieel aanvullen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /verhuur invullen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /pand aanvullen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /juridisch aanvullen/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1-pager voorbereiden/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /media uploaden/i })).toBeInTheDocument();
    expect(screen.getByText(/0 van 6 onderdelen ingevuld/i)).toBeInTheDocument();
  });

  it.each([
    ['financieel aanvullen', 'financieel'],
    ['verhuur invullen', 'verhuur'],
    ['pand aanvullen', 'pand'],
    ['juridisch aanvullen', 'juridisch'],
    ['1-pager voorbereiden', 'aanbieding'],
    ['media uploaden', 'documenten'],
  ])('CTA "%s" roept onGoto("%s") aan', async (label, anchor) => {
    const onGoto = vi.fn();
    const user = userEvent.setup();
    render(
      <DossierProgress
        object={makeObject()}
        fotosCount={0}
        documentenCount={0}
        huurdersCount={0}
        onGoto={onGoto}
      />,
    );
    await user.click(screen.getByRole('button', { name: new RegExp(label, 'i') }));
    expect(onGoto).toHaveBeenCalledWith(anchor);
  });

  it('toont compacte "Dossier compleet"-staat bij volledig dossier met secundaire links', () => {
    const complete = makeObject({
      vraagprijs: 500000,
      oppervlakte: 200,
      bouwjaar: 1990,
      eigendomssituatie: 'vol eigendom',
      verhuurStatus: 'verhuurd',
    });
    render(
      <DossierProgress
        object={complete}
        fotosCount={5}
        documentenCount={2}
        huurdersCount={1}
        onGoto={() => {}}
      />,
    );
    expect(screen.getByText(/dossier compleet/i)).toBeInTheDocument();
    expect(screen.getByText(/alle hoofdonderdelen zijn ingevuld/i)).toBeInTheDocument();
    // secundaire links (icon-only labels) blijven aanwezig
    const strip = screen.getByTestId('dossier-progress');
    expect(within(strip).getByRole('button', { name: /financieel/i })).toBeInTheDocument();
    expect(within(strip).getByRole('button', { name: /media/i })).toBeInTheDocument();
  });

  it('crasht niet bij minimale quick-create data (alleen titel)', () => {
    expect(() =>
      render(
        <DossierProgress
          object={{ id: 'obj-1', titel: 'Kaal object' }}
          fotosCount={0}
          documentenCount={0}
          huurdersCount={0}
          onGoto={() => {}}
        />,
      ),
    ).not.toThrow();
  });

  it('toont geen e-mail, persoonsgegevens of eigenaargegevens', () => {
    const { container } = render(
      <DossierProgress
        object={makeObject()}
        fotosCount={0}
        documentenCount={0}
        huurdersCount={0}
        onGoto={() => {}}
      />,
    );
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/piet@voorbeeld\.nl/);
    expect(text).not.toMatch(/Piet Janssen/);
    expect(text).not.toMatch(/rel-1/);
  });

  it('buildDossierCtas markeert onderdelen correct als compleet', () => {
    const ctas = buildDossierCtas(
      { vraagprijs: 1, oppervlakte: 100, eigendomssituatie: 'vol', bouwjaar: 2000 },
      3, 1, 0,
    );
    const byAnchor = Object.fromEntries(ctas.map(c => [c.anchor, c.complete]));
    expect(byAnchor.financieel).toBe(true);
    expect(byAnchor.pand).toBe(true);
    expect(byAnchor.juridisch).toBe(true);
    expect(byAnchor.aanbieding).toBe(true);
    expect(byAnchor.documenten).toBe(true); // media
    expect(byAnchor.verhuur).toBe(false);
  });

  it('mobiele CTAs hebben touch-target van minimaal 44px', () => {
    render(
      <DossierProgress
        object={makeObject()}
        fotosCount={0}
        documentenCount={0}
        huurdersCount={0}
        onGoto={() => {}}
      />,
    );
    const btn = screen.getByRole('button', { name: /financieel aanvullen/i });
    expect(btn.className).toMatch(/min-h-\[44px\]/);
  });
});
