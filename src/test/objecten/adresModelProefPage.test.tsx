import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import AdresModelProefPage from '@/pages/AdresModelProefPage';

function setup(){return render(<MemoryRouter><AdresModelProefPage/></MemoryRouter>);}
describe('Adresproef zonder database',()=>{
  it('start met Geuzenweg als één dossier met twee adressen',()=>{
    setup();
    expect(screen.getByLabelText('Adres 1 adres')).toHaveValue('Geuzenweg 22A');
    expect(screen.getByLabelText('Adres 2 adres')).toHaveValue('Geuzenweg 22B');
    expect(screen.getByText(/niet opgeslagen in je CRM/)).toBeInTheDocument();
  });
  it('kan een derde adres invoeren en vraagt controle bij incompleet adres',async()=>{
    const user=userEvent.setup();setup();
    await user.click(screen.getByRole('button',{name:'Adres toevoegen'}));
    expect(screen.getByLabelText('Adres 3 adres')).toBeInTheDocument();
    expect(screen.getByText(/Adres of plaats ontbreekt/)).toBeInTheDocument();
  });
  it('signaleert dubbele adresregistraties',async()=>{
    const user=userEvent.setup();setup();
    await user.clear(screen.getByLabelText('Adres 2 adres'));
    await user.type(screen.getByLabelText('Adres 2 adres'),'Geuzenweg 22A');
    expect(screen.getByText(/Mogelijk dubbel geregistreerd adres/)).toBeInTheDocument();
  });
  it('biedt drie fictieve Amsterdamse adressen zonder dat records worden aangemaakt',async()=>{
    const user=userEvent.setup();setup();
    await user.selectOptions(screen.getByRole('combobox'),'amsterdam');
    expect(screen.getByLabelText('Adres 3 adres')).toHaveValue('Voorbeeldadres 3');
  });
});
