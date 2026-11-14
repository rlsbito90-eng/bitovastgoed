import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import SamenstellingProefPage from '@/pages/SamenstellingProefPage';

const setup=()=>render(<MemoryRouter><SamenstellingProefPage/></MemoryRouter>);
describe('Samenstellingproef zonder CRM-wijzigingen',()=>{
  it('start met 75% bedrijfsruimte en een harde 70%-eis',()=>{
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('Voldoet');
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText(/slaat niets op in de CRM/)).toBeInTheDocument();
  });
  it('toont harde uitsluiting bij 65% bedrijf, ook met kantoor en wonen',async()=>{
    const u=userEvent.setup();setup();
    await u.selectOptions(screen.getByLabelText('Praktijkvoorbeeld'),'afgevallen');
    expect(screen.getByRole('status')).toHaveTextContent('Afgevallen — harde eis');
    expect(screen.getByText('35%')).toBeInTheDocument();
  });
  it('toont controle nodig wanneer GBO-bewoning wordt vergeleken met VVO of wanneer iets ontbreekt',async()=>{
    const u=userEvent.setup();setup();
    await u.selectOptions(screen.getByLabelText('Praktijkvoorbeeld'),'onbekend');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
    await u.selectOptions(screen.getByLabelText('Praktijkvoorbeeld'),'voldoet');
    await u.selectOptions(screen.getByLabelText('Onderdeel 2 meetbasis'),'gbo');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
  });
  it('kan een harde eis naar voorkeur omzetten en oppervlaktes aanpassen',async()=>{
    const u=userEvent.setup();setup();
    await u.selectOptions(screen.getByLabelText('Praktijkvoorbeeld'),'afgevallen');
    await u.selectOptions(screen.getByLabelText('Aard van de eis'),'voorkeur');
    expect(screen.getByRole('status')).toHaveTextContent('Afwijkende voorkeur');
  });
  it('onderdeel toevoegen vraagt om complete oppervlakte voordat een verhouding wordt getoond',async()=>{
    const u=userEvent.setup();setup();
    await u.click(screen.getByRole('button',{name:'Onderdeel toevoegen'}));
    expect(screen.getByLabelText('Onderdeel 3 oppervlakte')).toHaveValue('');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
  });
  it('toont bij Geuzenweg GBO eerst controle nodig als de eis VVO is',async()=>{
    const u=userEvent.setup();setup();
    await u.selectOptions(screen.getByLabelText('Praktijkvoorbeeld'),'geuzenweg');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
    await u.selectOptions(screen.getByLabelText('Meetbasis van de eis'),'gbo');
    expect(screen.getByRole('status')).toHaveTextContent('Afgevallen — harde eis');
  });
  it('een leeg drempelpercentage geldt niet als nul procent',async()=>{
    const u=userEvent.setup();setup();
    await u.clear(screen.getByLabelText('Minimaal bedrijfsruimtepercentage'));
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
  });

  it('heeft geen handmatige datakwaliteit-checkboxes meer',()=>{
    setup();
    expect(screen.getByLabelText('Automatische gegevenscontrole')).toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.queryByText(/Deze bevestigingen zijn in de proef handmatig/)).not.toBeInTheDocument();
  });
  it('controleert totaaloppervlak automatisch wanneer een gebruiker m² wijzigt',async()=>{
    const user=userEvent.setup();setup();
    await user.clear(screen.getByLabelText('Onderdeel 1 oppervlakte'));
    await user.type(screen.getByLabelText('Onderdeel 1 oppervlakte'),'700');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
    expect(screen.getByText(/wijkt af van het bekende objecttotaal/)).toBeInTheDocument();
  });

});
