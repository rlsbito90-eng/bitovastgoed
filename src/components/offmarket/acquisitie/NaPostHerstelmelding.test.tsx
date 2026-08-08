import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { AcquisitieNaPostActiebediening } from '@/lib/offMarket/acquisitie/acquisitieNaPostActiebediening';
import type { AcquisitieNaPostActiestatus } from '@/lib/offMarket/acquisitie/acquisitieNaPostActiestatus';
import NaPostHerstelmelding from './NaPostHerstelmelding';

function status(overrides: Partial<AcquisitieNaPostActiestatus> = {}): AcquisitieNaPostActiestatus {
  return {
    actie: 'postregistratie_herstellen',
    titel: 'Postregistratie afronden',
    toelichting: 'Niet alle expliciet geposte brieven zijn administratief verwerkt.',
    werkbak: 'geprint_posten',
    bedrijfsverwerkingGereed: false,
    volledigAfgerond: false,
    blokkeertVervolg: true,
    aantalMislukt: 1,
    operationKey: null,
    ...overrides,
  };
}

function bediening(
  overrides: Partial<AcquisitieNaPostActiebediening> = {},
): AcquisitieNaPostActiebediening {
  return {
    actie: 'postregistratie_herstellen',
    label: 'Postregistratie herstellen',
    variant: 'primair',
    zichtbaar: true,
    uitgeschakeld: false,
    bevestigingNodig: true,
    operationKey: null,
    blokkeertVervolg: true,
    ...overrides,
  };
}

describe('NaPostHerstelmelding', () => {
  it('toont de privacyveilige hersteltekst en geeft het actiecontract terug', () => {
    const onHerstel = vi.fn();
    const actie = bediening();

    render(<NaPostHerstelmelding status={status()} bediening={actie} onHerstel={onHerstel} />);

    expect(screen.getByText('Postregistratie afronden')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Postregistratie herstellen' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Postregistratie herstellen' }));
    expect(onHerstel).toHaveBeenCalledOnce();
    expect(onHerstel).toHaveBeenCalledWith(actie);
  });

  it('verbergt volledig afgeronde verwerking', () => {
    const { container } = render(
      <NaPostHerstelmelding
        status={status({ actie: 'geen', volledigAfgerond: true })}
        bediening={bediening({ actie: 'geen', zichtbaar: false, uitgeschakeld: true, variant: 'verborgen', label: '' })}
        onHerstel={vi.fn()}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('maakt de knop inert tijdens uitvoering', () => {
    const onHerstel = vi.fn();
    render(
      <NaPostHerstelmelding
        status={status()}
        bediening={bediening()}
        bezig
        onHerstel={onHerstel}
      />,
    );

    const knop = screen.getByRole('button', { name: 'Bezig…' });
    expect(knop).toBeDisabled();
    fireEvent.click(knop);
    expect(onHerstel).not.toHaveBeenCalled();
  });

  it('toont auditherstel als niet-blokkerende secundaire actie', () => {
    render(
      <NaPostHerstelmelding
        status={status({
          actie: 'audit_herstellen',
          titel: 'Auditregistratie herstellen',
          toelichting: 'De bedrijfsverwerking is afgerond; alleen de auditregistratie moet opnieuw.',
          bedrijfsverwerkingGereed: true,
          blokkeertVervolg: false,
          operationKey: 'audit:na-post:1',
        })}
        bediening={bediening({
          actie: 'audit_herstellen',
          label: 'Auditregistratie herstellen',
          variant: 'secundair',
          bevestigingNodig: false,
          operationKey: 'audit:na-post:1',
          blokkeertVervolg: false,
        })}
        onHerstel={vi.fn()}
      />,
    );

    expect(screen.getByText('De bedrijfsverwerking is afgerond; alleen de auditregistratie moet opnieuw.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Auditregistratie herstellen' })).toBeEnabled();
    expect(screen.queryByText('audit:na-post:1')).not.toBeInTheDocument();
  });
});
