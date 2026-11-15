import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { SandboxStoreProvider } from './sandboxStore';
import { STORAGE_KEY } from './sandboxModel';
import SandboxObjectPartsPage from './SandboxObjectPartsPage';
import TestMatchingPage from './TestMatchingPage';

const setup=()=>render(<SandboxStoreProvider>
  <MemoryRouter initialEntries={['/relaties']}>
    <Routes>
      <Route path="/relaties" element={<TestMatchingPage/>}/>
      <Route path="/objecten/samenstellingproef" element={<SandboxObjectPartsPage/>}/>
    </Routes>
  </MemoryRouter>
</SandboxStoreProvider>);

describe('Eén fictieve objectindeling voor Relaties en Matching',()=>{
  beforeEach(()=>{localStorage.clear();});
  it('start met 75% bedrijfsruimte en bevat geen controlevinkjes',()=>{
    setup();
    expect(screen.getByRole('status')).toHaveTextContent('Voldoet');
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(screen.getByText(/Bedrijfshal: 750 m² VVO/)).toBeInTheDocument();
  });
  it('65% als harde eis wordt afgevallen en blijft afzonderlijk per koper',async()=>{
    const user=userEvent.setup();setup();
    await user.selectOptions(screen.getByLabelText('Voorbeeldobject'),'gemengd');
    expect(screen.getByRole('status')).toHaveTextContent('Afgevallen — harde eis');
    await user.selectOptions(screen.getByLabelText('Fictieve belegger'),'residentieel');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
  });
  it('65% als voorkeur betekent geen harde afwijzing',async()=>{
    const user=userEvent.setup();setup();
    await user.selectOptions(screen.getByLabelText('Voorbeeldobject'),'gemengd');
    await user.selectOptions(screen.getByLabelText('Sterkte'),'voorkeur');
    expect(screen.getByRole('status')).toHaveTextContent('Afwijkende voorkeur');
  });
  it('residentieel profiel en twee GBO appartementen werken automatisch zonder dubbele invoer',async()=>{
    const user=userEvent.setup();setup();
    await user.selectOptions(screen.getByLabelText('Voorbeeldobject'),'geuzenweg');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
    await user.selectOptions(screen.getByLabelText('Fictieve belegger'),'residentieel');
    expect(screen.getByRole('status')).toHaveTextContent('Voldoet');
    expect(screen.getByText(/Appartement A: 75 m² GBO/)).toBeInTheDocument();
  });
  it('ontbrekende brongegevens leiden tot controle nodig',async()=>{
    const user=userEvent.setup();setup();
    await user.selectOptions(screen.getByLabelText('Voorbeeldobject'),'onbekend');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
  });
  it('de objectpagina deelt live dezelfde onderdelen met Relaties, zonder opnieuw invullen',async()=>{
    const user=userEvent.setup();setup();
    await user.click(screen.getByRole('link',{name:/wijzig objectonderdelen/i}));
    await user.clear(screen.getByLabelText('Onderdeel 1 oppervlakte'));
    await user.type(screen.getByLabelText('Onderdeel 1 oppervlakte'),'650');
    expect(screen.getByRole('status')).toHaveTextContent('Controle nodig');
    await user.clear(screen.getByLabelText('Onderdeel 2 oppervlakte'));
    await user.type(screen.getByLabelText('Onderdeel 2 oppervlakte'),'350');
    await user.click(screen.getByRole('link',{name:/bekijk matching/i}));
    expect(screen.getByRole('status')).toHaveTextContent('Afgevallen — harde eis');
    expect(screen.getByText(/Bedrijfshal: 650 m² VVO/)).toBeInTheDocument();
    expect(screen.getByText(/Kantoorruimte: 350 m² VVO/)).toBeInTheDocument();
    expect(localStorage.getItem(STORAGE_KEY)).toContain('"oppervlakte":"650"');
  });
  it('Alles herstellen zet alle fictieve velden terug',async()=>{
    const user=userEvent.setup();setup();
    await user.selectOptions(screen.getByLabelText('Voorbeeldobject'),'gemengd');
    await user.click(screen.getByRole('button',{name:'Alles herstellen'}));
    expect(screen.getByRole('status')).toHaveTextContent('Voldoet');
    expect(screen.getByText(/Bedrijfshal: 750 m² VVO/)).toBeInTheDocument();
  });
});
